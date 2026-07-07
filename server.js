const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = parseInt(process.env.PORT || '3000', 10);
const OC_PORT = 18749;
const OC_HOST = '127.0.0.1';
const OC = `http://${OC_HOST}:${OC_PORT}`;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function proxyTo(target) {
  return (req, res) => {
    const headers = { ...req.headers, host: `${OC_HOST}:${OC_PORT}` };
    for (const k of ['sec-fetch-site','sec-fetch-mode','sec-fetch-dest','sec-fetch-user']) delete headers[k];

    const pref = http.request(target + req.url, { method: req.method, headers }, (pRes) => {
      res.writeHead(pRes.statusCode, pRes.headers);
      pRes.pipe(res);
    });
    pref.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.on('error', () => pref.destroy());
    res.on('close', () => pref.destroy());
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
      fs.readFile(path.join(PUBLIC, 'index.html'), (_, data) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
}

function start() {
  const child = spawn('opencode', ['serve', '--port', String(OC_PORT), '--hostname', OC_HOST], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, OPENCODE_SERVER_PASSWORD: '' },
  });
  child.on('exit', (code) => { console.log(`opencode serve exited (${code})`); });
  process.on('exit', () => { try { child.kill(); } catch {} });
  process.on('SIGINT', () => { try { child.kill(); } catch {}; process.exit(); });
  process.on('SIGTERM', () => { try { child.kill(); } catch {}; process.exit(); });

  const ASSET_PATHS = ['/assets/', '/favicon', '/apple-touch-icon', '/site.webmanifest', '/social-share.png']

  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      const alive = child.exitCode === null;
      res.writeHead(alive ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: alive ? 'ok' : 'dead' }));
      return;
    }
    if (req.url.startsWith('/oc')) return ocProxy(req, res);
    if (ASSET_PATHS.some(p => req.url.startsWith(p))) return ocProxy(req, res);
    staticHandler(req, res);
  });
  server.listen(PORT, () => console.log(`portal at http://localhost:${PORT}`));
}

start();
