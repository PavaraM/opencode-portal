#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const PID_FILE = path.join(ROOT, '.ocportal.pid');
const LOG_FILE = path.join(ROOT, 'ocportal.log');
const PORT = process.env.PORT || '3050';

function pid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10); } catch { return null; }
}

function alive(pid) {
  try { return process.kill(pid, 0); } catch { return false; }
}

function waitAlive(url, retries) {
  return new Promise((resolve) => {
    const check = (n) => {
      if (n <= 0) return resolve(false);
      const req = http.get(url, () => { req.destroy(); resolve(true); });
      req.on('error', () => setTimeout(() => check(n - 1), 300));
    };
    check(retries);
  });
}

const http = require('http');
const sub = process.argv[2];

if (sub === 'run') {
  const existing = pid();
  if (existing && alive(existing)) { console.log('ocportal already running (pid ' + existing + ')'); process.exit(0); }

  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn('node', ['server.js'], {
    cwd: ROOT, detached: true, stdio: ['ignore', out, out],
    env: { ...process.env, PORT, OPENCODE_SERVER_PASSWORD: '' },
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  console.log('ocportal started (pid ' + child.pid + ') on port ' + PORT);
  process.exit(0);
}

if (sub === 'stop') {
  const p = pid();
  if (p && alive(p)) { process.kill(p, 'SIGTERM'); console.log('ocportal stopped'); }
  else console.log('ocportal not running');
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
}

if (sub === 'restart') {
  const p = pid();
  if (p && alive(p)) { process.kill(p, 'SIGTERM'); console.log('stopped'); }
  try { fs.unlinkSync(PID_FILE); } catch {}

  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn('node', ['server.js'], {
    cwd: ROOT, detached: true, stdio: ['ignore', out, out],
    env: { ...process.env, PORT, OPENCODE_SERVER_PASSWORD: '' },
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  console.log('ocportal restarted (pid ' + child.pid + ') on port ' + PORT);
  process.exit(0);
}

if (sub === 'open') {
  const url = 'http://localhost:' + PORT;
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
  console.log('opening ' + url);
  process.exit(0);
}

if (sub === 'config') {
  console.log('PORT=' + PORT);
  console.log('ROOT=' + ROOT);
  console.log('PID_FILE=' + PID_FILE);
  console.log('LOG_FILE=' + LOG_FILE);
  process.exit(0);
}

if (sub === 'status') {
  const p = pid();
  console.log(p && alive(p) ? 'running (pid ' + p + ')' : 'stopped');
  process.exit(0);
}

console.log('Usage: ocportal <run|stop|restart|open|config|status>');
process.exit(1);
