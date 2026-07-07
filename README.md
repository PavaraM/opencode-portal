# OpenCode Portal

Web GUI for [OpenCode](https://opencode.ai) — an AI coding agent. Chat interface, session management, file browser, all wired to the real OpenCode API.

## Quick start

```sh
PORT=3050 OPENCODE_SERVER_PASSWORD='' node server.js
# Open http://localhost:3050
```

## Install as systemd service

```sh
sudo sh install.sh
```

Service runs on port 3050, auto-restarts on failure.

## Manage

```sh
sudo systemctl status opencode-portal
sudo journalctl -u opencode-portal -f
sudo systemctl stop opencode-portal
sudo systemctl start opencode-portal
```

## How it works

`server.js` spawns `opencode serve --port 18749` and proxies `/oc/*` requests to it. Frontend is a single HTML file at `public/index.html` with no build step.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PORT` | `3050` | Portal HTTP port |
| `OPENCODE_SERVER_PASSWORD` | `''` | Auth for opencode serve |

## API (proxied)

| Method | Path | Purpose |
|---|---|---|
| GET | `/oc/global/health` | Health check |
| POST | `/oc/session` | Create session |
| GET | `/oc/session` | List sessions |
| POST | `/oc/session/:id/message` | Send message |
| GET | `/oc/session/:id/message` | Get messages |
