#!/bin/sh
# Start portal in foreground (for testing/debugging)
# Usage: ./start.sh [--port PORT]
PORT="${2:-${PORT:-3000}}" node server.js
