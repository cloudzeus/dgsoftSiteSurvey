#!/bin/sh
set -e

# standalone/server.js calls process.chdir(__dirname), so it resolves
# distDir from inside the standalone tree — not from the package root.
# Copy .next/static there so recursiveReadDir finds it and
# nextStaticFolderItems is populated (otherwise every /_next/static/*
# request returns 404).
STANDALONE=".next/standalone/packages/softone-admin-dashboard"

cp -r .next/static "$STANDALONE/.next/static"

# Copy public/ if it exists
if [ -d public ]; then
  cp -r public "$STANDALONE/public"
fi

exec node "$STANDALONE/server.js"
