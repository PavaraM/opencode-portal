# OpenCode Portal

Web GUI for [OpenCode](https://opencode.ai) — the AI coding agent that lives in your terminal.

```
┌─────────────────────────────────────────────────┐
│           Your Browser (port 3000)               │
│                                                   │
│   ┌───────────────────────────────────────────┐   │
│   │  public/index.html  ← served directly     │   │
│   │  React/Vite SPA     ← proxied from :18749 │   │
│   └──────────────┬────────────────────────────┘   │
│                  │                                 │
└──────────────────┼─────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│           OpenCode Portal (server.js)             │
│                                                   │
│    Static files  ◄─── /  /index.html              │
│    Health check  ◄─── /api/health                 │
│    Proxy to OC   ◄─── /oc/*  /assets/*  /favicon* │
│                                                   │
│    Child process: opencode serve --port 18749     │
│    Auto-restarts on crash (2s delay)             │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│     opencode serve  (port 18749, localhost only)  │
│                                                   │
│    Chat API, sessions, file tree, SSE streaming   │
└──────────────────────────────────────────────────┘
```

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | >= 18 | Runtime |
| [opencode CLI](https://opencode.ai) | latest | Backend — the portal wraps this |
| systemd (optional) | — | For auto-start on boot via `install.sh` |

The portal does **not** include the opencode CLI — install it separately:

```sh
# macOS / Linux
curl -fsSL https://opencode.ai/install.sh | sh

# Or via npm
npm install -g @opencode/cli
```

## Quick start

```sh
ocportal run
# Open http://localhost:3000
```

Or run directly without the CLI wrapper:

```sh
node server.js
# Open http://localhost:3000
```

## CLI reference

### Global install

```sh
npm link           # dev install from this repo
npm install -g .   # or install from local path
```

### Commands

| Command | Description | Notes |
|---|---|---|
| `ocportal run` | Start daemon in background | Logs to `ocportal.log` |
| `ocportal stop` | Stop daemon | Waits 5s, force-kills if stuck |
| `ocportal restart` | Restart daemon | Waits for port release |
| `ocportal open` | Open portal in browser | macOS/Win/Linux |
| `ocportal status` | Show running/stopped | Reads PID file |
| `ocportal config` | Show PORT, ROOT, PID_FILE, LOG_FILE | Debug info |
| `ocportal logs` | Tail live log | `ocportal logs --size` for file size |
| `ocportal foreground` | Run in foreground | For debugging, no daemon |

### CLI flags

| Flag | Works with | Effect |
|---|---|---|
| `--force` | `run`, `stop` | Override stale PID |
| `--size` | `logs` | Show log file size (KB) |
| `--help` / `-h` | any | Show help |
| `--version` / `-v` | any | Show version |

### Lifecycle

```
ocportal run ────► [spawns node server.js as daemon]
                      │
                      ├──► writes PID to .ocportal.pid
                      ├──► writes logs to ocportal.log
                      └──► locks with .ocportal.lock (O_EXCL)

ocportal stop ───► [SIGTERM → wait 5s → SIGKILL if alive]
                      │
                      └──► removes .ocportal.pid

ocportal restart ──► [stop] → [wait dead] → [run]
```

## Installation methods

### 1. Quick daemon (systemd)

```sh
sudo sh install.sh
```

The install script:

1. Checks prerequisites: `node`, `opencode`, `systemctl`
2. Templates the service file with your user, directory, and node path
3. Installs to `/etc/systemd/system/opencode-portal.service`
4. Enables and starts the service

```
install.sh
    │
    ├──► Pre-flight checks
    │      ├── node --version
    │      ├── opencode --version
    │      └── systemctl --version
    │
    ├──► sed -e "s|__USER__|$(whoami)|g" \
    │        -e "s|__DIR__|$(pwd)|g"     \
    │        -e "s|__NODE__|$(which node)|g"
    │
    ├──► cp → /etc/systemd/system/opencode-portal.service
    ├──► systemctl daemon-reload
    ├──► systemctl enable
    └──► systemctl restart
```

**Management:**

```sh
# Check status
systemctl status opencode-portal --no-pager

# View logs
journalctl -u opencode-portal -f

# Stop
sudo systemctl stop opencode-portal
```

### 2. Direct (no systemd)

```sh
# Foreground (for testing)
./start.sh
# or
node server.js

# Daemon (via CLI)
ocportal run
```

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Portal HTTP port (for `server.js`) |
| `OPENCODE_SERVER_PASSWORD` | `''` (empty) | Password for internal opencode serve |
| `LOG_REQUESTS` | `0` | Set to `1` to log each HTTP request with method, URL, status, duration |

> **Note on `PORT`:** The CLI wrapper passes `PORT` through. `server.js` defaults to `3000`. `start.sh` defaults to `3000`. If you run `ocportal run` without setting `PORT`, the portal listens on `3000`.

### Internal ports

| Port | Process | Access |
|---|---|---|
| `3000` | Portal (server.js) | Public (LAN/all interfaces if bound to 0.0.0.0) |
| `18749` | opencode serve | localhost only (127.0.0.1) — not exposed |

## API

### Portal endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check. Returns `{"status":"ok"}` or `{"status":"dead"}`. Used by frontend badge. |

### Proxied endpoints (to opencode serve on `localhost:18749`)

All paths starting with `/oc/` or `/oc` are transparently proxied to opencode serve including query strings and request body. Same for `/assets/*`, `/favicon*`, `/apple-touch-icon*`, `/site.webmanifest`, and `/social-share.png`.

**Key proxied routes:**

| Method | Path | Purpose |
|---|---|---|
| GET | `/oc/global/health` | Backend health |
| POST | `/oc/session` | Create new session |
| GET | `/oc/session` | List sessions |
| POST | `/oc/session/:id/message` | Send message |
| GET | `/oc/session/:id/message` | Get messages |
| POST | `/oc/session/:id/message/stream` | Stream response (SSE) |
| GET | `/oc/context` | List context files |
| GET | `/oc/files` | File tree |

> The portal is a pass-through proxy for these — it doesn't inspect or modify the request. Refer to the [opencode API docs](https://opencode.ai/docs) for full schema.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌──────────────┐  ┌──────────────────┐                 │
│  │ index.html   │  │ React/Vite SPA   │                 │
│  │ (loading     │  │ (chat, sessions, │                 │
│  │  screen,     │  │  file tree,      │                 │
│  │  health      │  │  settings)       │                 │
│  │  badge,      │  │                  │                 │
│  │  keyboard    │  │  loaded from     │                 │
│  │  shortcuts)  │  │  /assets/* via   │                 │
│  └──────┬───────┘  │  proxy           │                 │
│         │          └────────┬─────────┘                 │
│         └─────────┬─────────┘                           │
│                   │                                     │
│            HTTP :3000                                    │
└──────────────────┼──────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│               server.js (portal)                         │
│                                                          │
│   ┌─────────────────┐   ┌────────────────────────┐      │
│   │ Static handler  │   │   Proxy handler         │      │
│   │                 │   │                        │      │
│   │ / → index.html │   │  /oc/* → :18749        │      │
│   │ /api/health    │   │  /assets/* → :18749     │      │
│   │                │   │  /favicon* → :18749     │      │
│   └────────────────┘   └───────────┬────────────┘      │
│                                    │                    │
│   ┌────────────────────────────────┴──────────┐         │
│   │  Child process manager                    │         │
│   │                                           │         │
│   │  spawn("opencode serve --port 18749")     │         │
│   │       │                                    │         │
│   │       ├── on exit → restart after 2s       │         │
│   │       └── on SIGTERM/SIGINT → kill + close │         │
│   └────────────────────────────────────────────┘         │
│                                                          │
│   Graceful shutdown: server.close() → process.exit()     │
│   Uncaught exception: shutdown() → kill child → close    │
│   Server error (EADDRINUSE): shutdown() → exit           │
└──────────────────────┬───────────────────────────────────┘
                       │
                   HTTP :18749 (localhost only)
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              opencode serve                               │
│                                                          │
│   Chat engine, session management, file context,         │
│   SSE streaming, tool execution                          │
└──────────────────────────────────────────────────────────┘
```

### File structure

```
opencode-portal/
├── server.js                     # HTTP server + proxy + child process manager
├── cli.js                        # CLI: run/stop/restart/open/logs/etc.
├── package.json                  # Metadata, bin, scripts
├── install.sh                    # systemd service installer (template vars)
├── start.sh                      # Foreground launcher for testing
├── opencode-portal.service       # systemd unit file (templated)
├── .gitignore
├── README.md
├── public/
│   ├── index.html                # SPA shell + enhancement script
│   ├── favicon-96x96-v3.png
│   ├── favicon-v3.svg
│   ├── favicon-v3.ico
│   ├── apple-touch-icon-v3.png
│   ├── site.webmanifest
│   └── social-share.png
└── .opencode-workspace/          # Project memories (not shipped)
    └── opencodememories/
        ├── ISSUE_LOG.md
        ├── MEMORIES.md
        └── USER.md
```

## Security

| Concern | Status |
|---|---|
| Internal opencode auth | Disabled by default (`OPENCODE_SERVER_PASSWORD=''`) |
| External access | Portal binds `0.0.0.0:3000` — LAN-accessible |
| opencode serve | `127.0.0.1:18749` — localhost only |
| TLS/HTTPS | Not supported (localhost-only by design; use a reverse proxy for LAN) |
| CSP header | Conservative: `self` + inline styles/scripts only |

**Recommendations for production-like setups:**
- Set `OPENCODE_SERVER_PASSWORD` if opencode serve needs auth
- Put behind nginx/Caddy with TLS for LAN access
- Use firewall rules to restrict port 3000

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Failed to spawn opencode serve` | opencode CLI not installed or not in PATH | `which opencode` / install from [opencode.ai](https://opencode.ai) |
| `Address already in use :3000` | Port conflict | `PORT=3001 ocportal run` or kill the process on port 3000 |
| Dashboard says "disconnected" in red | opencode serve crashed | Check `ocportal.log` or `journalctl -u opencode-portal -f` |
| Connection resets / 502 errors | opencode serve restarting | Wait 2-3s for auto-restart |
| Blank white page after loading screen | App failed to load in 8s | Check browser console for errors, reload |
| `ocportal open` does nothing | No xdg-open/open/cmd | Manually open `http://localhost:3000` |
| Systemd service won't start | `set -e` aborted install | Run `systemctl status opencode-portal --no-pager` |
| `PORT=abc` behaves unexpectedly | Non-numeric PORT | Server falls back to 3000 |

### Logs

| Source | Location | How to read |
|---|---|---|
| Portal log | `ocportal.log` (in project root) | `ocportal logs` or `tail -f ocportal.log` |
| Systemd service | journald | `journalctl -u opencode-portal -f` |
| Server stdout | Inherited from parent process | `ocportal foreground` |

Enable request logging for debugging:

```sh
LOG_REQUESTS=1 ocportal run
# Now ocportal.log shows: GET /api/health 200 2ms
```

## Known limitations

- **No TLS** — The portal doesn't support HTTPS. Use a reverse proxy (nginx/Caddy) for encrypted LAN access.
- **No log rotation** — `ocportal.log` grows unbounded. Monitor with `ocportal logs --size` or set up `logrotate`.
- **Single process** — No clustering. One Node.js process handles all requests.
- **Linux-focused** — systemd service and `xdg-open` assumption. macOS works via `open`; Windows supported in CLI but not systemd.
- **opencode required** — The portal is useless without the opencode CLI installed separately.

## Development

```sh
git clone https://github.com/PavaraM/opencode-portal.git
cd opencode-portal

# Run in foreground with auto-reload
node server.js

# Edit public/index.html — all enhancement logic is inline
# Edit server.js — proxy config, static serving, process management
```

## License

ISC
