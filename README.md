# OpenCode Portal

Web GUI for [OpenCode](https://opencode.ai) — an AI coding agent.

## Quick start

```sh
ocportal run
# Open http://localhost:3050
```

## CLI

| Command | Description |
|---|---|
| `ocportal run` | Start daemon in background (logs to `ocportal.log`) |
| `ocportal stop` | Stop daemon |
| `ocportal restart` | Restart daemon |
| `ocportal open` | Open portal in browser |
| `ocportal status` | Show running/stopped |
| `ocportal config` | Show PORT, ROOT paths |

Install globally once:

```sh
npm link   # or: npm install -g .
```

## Systemd service

```sh
sudo sh install.sh
```

Service runs on port 3050, auto-restarts. Logs: `journalctl -u opencode-portal -f`.

## How it works

`server.js` spawns `opencode serve --port 18749` and proxies two things to it:
- **API**: `/oc/*` routes (health, sessions, messages)
- **Frontend assets**: `/assets/*`, favicons, manifest, social images

The static `public/index.html` shell is served directly by the portal. The React/Vite app (from opencode serve) is loaded via the proxied assets.

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
