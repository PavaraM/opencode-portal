#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const PID_FILE = path.join(ROOT, '.ocportal.pid');
const LOCK_FILE = path.join(ROOT, '.ocportal.lock');
const LOG_FILE = path.join(ROOT, 'ocportal.log');
const PORT = process.env.PORT || '3000';

function pid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10); } catch { return null; }
}

function alive(p) {
  try { return process.kill(p, 0); } catch { return false; }
}

function waitDead(p, timeout) {
  const start = Date.now();
  while (alive(p) && Date.now() - start < timeout) {
    try { process.kill(p, 0); } catch { return; }
    require('child_process').execSync('sleep 0.1 2>/dev/null || ping -n 1 127.0.0.1 >nul 2>&1', { stdio: 'ignore' });
  }
}

function lockPid() {
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch { return false; }
}

function unlockPid() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

function writePid(p) {
  const tmp = PID_FILE + '.tmp';
  fs.writeFileSync(tmp, String(p));
  fs.renameSync(tmp, PID_FILE);
}

function removePid() {
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function daemonize() {
  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn('node', ['server.js'], {
    cwd: ROOT, detached: true, stdio: ['ignore', out, out],
    env: { ...process.env, PORT },
  });
  child.unref();
  writePid(child.pid);
  return child.pid;
}

const sub = process.argv[2];
const args = process.argv.slice(3);
const force = args.includes('--force');

function existingPid() {
  const p = pid();
  if (!p) return null;
  if (alive(p)) return p;
  if (force) { removePid(); return null; }
  console.log('stale PID ' + p + ' found (use --force to override)');
  process.exit(1);
}

if (sub === 'run') {
  const p = pid();
  if (p && alive(p)) { console.log('ocportal already running (pid ' + p + ')'); process.exit(0); }
  if (!lockPid()) { console.log('another ocportal command is running'); process.exit(1); }
  try {
    removePid();
    const np = daemonize();
    console.log('ocportal started (pid ' + np + ') on port ' + PORT);
  } finally { unlockPid(); }
  process.exit(0);
}

if (sub === 'stop') {
  const p = pid();
  if (!p || !alive(p)) { console.log('ocportal not running'); removePid(); process.exit(0); }
  process.kill(p, 'SIGTERM');
  waitDead(p, 5000);
  if (alive(p)) {
    console.log('force killing...');
    try { process.kill(p, 'SIGKILL'); } catch {}
    waitDead(p, 2000);
  }
  removePid();
  console.log('ocportal stopped');
  process.exit(0);
}

if (sub === 'restart') {
  const p = pid();
  if (p && alive(p)) {
    process.kill(p, 'SIGTERM');
    waitDead(p, 5000);
    if (alive(p)) {
      console.log('force killing...');
      try { process.kill(p, 'SIGKILL'); } catch {}
      waitDead(p, 2000);
    }
    removePid();
    console.log('stopped');
  }
  if (!lockPid()) { console.log('another ocportal command is running'); process.exit(1); }
  try {
    removePid();
    const np = daemonize();
    console.log('ocportal restarted (pid ' + np + ') on port ' + PORT);
  } finally { unlockPid(); }
  process.exit(0);
}

if (sub === 'open') {
  const url = 'http://localhost:' + PORT;
  const plat = process.platform;
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args2 = plat === 'win32' ? ['/c', 'start', url] : [url];
  spawn(cmd, args2, { stdio: 'ignore', detached: true }).on('error', () => {
    console.error('failed to open browser (no ' + cmd + ')');
    console.log('open ' + url);
  });
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

if (sub === 'logs') {
  const logSize = args.includes('--size');
  if (logSize) {
    try {
      const s = fs.statSync(LOG_FILE);
      console.log('log size: ' + (s.size / 1024).toFixed(1) + ' KB');
    } catch { console.log('log file not found'); }
    process.exit(0);
  }
  const child = spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' });
  process.on('SIGINT', () => { child.kill(); process.exit(); });
  process.on('SIGTERM', () => { child.kill(); process.exit(); });
  return;
}

if (sub === 'foreground') {
  const child = spawn('node', ['server.js'], {
    cwd: ROOT, stdio: 'inherit',
    env: { ...process.env, PORT },
  });
  child.on('exit', (code) => process.exit(code));
  process.on('SIGINT', () => { child.kill(); process.exit(); });
  process.on('SIGTERM', () => { child.kill(); process.exit(); });
  return;
}

if (sub === '--help' || sub === '-h' || !sub) {
  console.log('Usage: ocportal <command>');
  console.log('');
  console.log('Commands:');
  console.log('  run         Start daemon in background');
  console.log('  stop        Stop daemon');
  console.log('  restart     Restart daemon');
  console.log('  open        Open portal in browser');
  console.log('  status      Show running/stopped');
  console.log('  config      Show PORT, ROOT, PID_FILE, LOG_FILE');
  console.log('  logs        Tail log file');
  console.log('  logs --size Show log file size');
  console.log('  foreground  Run in foreground (no daemon)');
  console.log('  --version   Show version');
  process.exit(0);
}

if (sub === '--version' || sub === '-v') {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  console.log('ocportal v' + pkg.version);
  process.exit(0);
}

console.log('Unknown command: ' + sub);
console.log('Usage: ocportal --help');
process.exit(1);
