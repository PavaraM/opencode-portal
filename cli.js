#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const PID_FILE = path.join(ROOT, '.ocportal.pid');
const LOG_FILE = path.join(ROOT, 'ocportal.log');
const PORT = process.env.PORT || '3000';

function pid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10); } catch { return null; }
}

function alive(pid) {
  try { return process.kill(pid, 0); } catch { return false; }
}

function writePid(pid) {
  const tmp = PID_FILE + '.tmp';
  fs.writeFileSync(tmp, String(pid));
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

if (sub === 'run') {
  const existing = pid();
  if (existing && alive(existing)) { console.log('ocportal already running (pid ' + existing + ')'); process.exit(0); }
  const p = daemonize();
  console.log('ocportal started (pid ' + p + ') on port ' + PORT);
  process.exit(0);
}

if (sub === 'stop') {
  const p = pid();
  if (p && alive(p)) { process.kill(p, 'SIGTERM'); console.log('ocportal stopped'); }
  else console.log('ocportal not running');
  removePid();
  process.exit(0);
}

if (sub === 'restart') {
  const p = pid();
  if (p && alive(p)) { process.kill(p, 'SIGTERM'); console.log('stopped'); }
  removePid();
  const np = daemonize();
  console.log('ocportal restarted (pid ' + np + ') on port ' + PORT);
  process.exit(0);
}

if (sub === 'open') {
  const url = 'http://localhost:' + PORT;
  const plat = process.platform;
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args = plat === 'win32' ? ['/c', 'start', url] : [url];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
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
