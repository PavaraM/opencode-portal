'use strict';
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const OC_PORT = 18749;
const OC_HOST = '127.0.0.1';
const OC = `http://${OC_HOST}:${OC_PORT}`;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webp': 'image/webp',
};

function proxyTo(target) {
  return (req, res) => {
    const headers = { ...req.headers, host: `${OC_HOST}:${OC_PORT}` };
    for (const k of ['sec-fetch-site','sec-fetch-mode','sec-fetch-dest','sec-fetch-user']) delete headers[k];

    let aborted = false;
    const pref = http.request(target + req.url, { method: req.method, headers }, (pRes) => {
      res.writeHead(pRes.statusCode, pRes.headers);
      pRes.pipe(res);
    });
    pref.on('error', () => {
      if (aborted) return;
      aborted = true;
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.on('error', () => { aborted = true; pref.destroy(); });
    res.on('close', () => { aborted = true; pref.destroy(); });
    req.pipe(pref);
  };
}

const ocProxy = proxyTo(OC);

function staticHandler(req, res) {
  let fp = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  fp = path.join(PUBLIC, fp);
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.stat(fp, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
}

function start() {
  let child = null;
  let restartTimer = null;

  function spawnOC() {
    try {
      child = spawn('opencode', ['serve', '--port', String(OC_PORT), '--hostname', OC_HOST], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || '' },
      });
      child.on('exit', (code) => {
        console.log(`opencode serve exited (${code})`);
        child = null;
        restartTimer = setTimeout(spawnOC, 2000);
      });
    } catch (e) {
      console.error('Failed to spawn opencode serve:', e.message);
      restartTimer = setTimeout(spawnOC, 5000);
    }
  }

  spawnOC();

  function shutdown() {
    clearTimeout(restartTimer);
    if (child) try { child.kill(); } catch {}
    server.close(() => process.exit());
    setTimeout(() => process.exit(1), 3000);
  }

  process.on('exit', () => { if (child) try { child.kill(); } catch {} });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (e) => {
    console.error('Uncaught:', e);
    shutdown();
  });

  const ASSET_PATHS = ['/assets/', '/favicon', '/apple-touch-icon', '/site.webmanifest', '/social-share.png'];

  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      const alive = child && child.exitCode === null;
      res.writeHead(alive ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: alive ? 'ok' : 'dead' }));
      return;
    }
    if (req.url.startsWith('/oc/') || req.url === '/oc') return ocProxy(req, res);
    if (ASSET_PATHS.some(p => req.url.startsWith(p))) return ocProxy(req, res);
    staticHandler(req, res);
  });

  server.timeout = 60000;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 62000;

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error('Server error:', e);
    }
    shutdown();
  });

  server.listen(PORT, () => console.log(`portal at http://localhost:${PORT}`));
}

start();
