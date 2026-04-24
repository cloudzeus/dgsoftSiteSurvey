#!/bin/sh
set -e

# Start Next.js on the internal port (3001)
PORT=3001 node server.js &
NEXT_PID=$!

# Propagate SIGTERM/SIGINT to Next.js when container stops
trap 'kill $NEXT_PID 2>/dev/null; exit 0' TERM INT

# Start the static-file proxy on the external port (3000).
# This serves /_next/static/* directly from the filesystem and proxies
# everything else to Next.js — bypassing the broken static-file scan
# in Next.js standalone mode.
exec node /usr/local/lib/static-proxy.cjs
