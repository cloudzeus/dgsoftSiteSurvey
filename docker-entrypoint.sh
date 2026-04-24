#!/bin/sh
set -e

STATIC_DIR=".next/static"

if [ ! -d "$STATIC_DIR" ]; then
  echo "FATAL: $STATIC_DIR not found — all /_next/static/* requests will 404." >&2
  echo "Ensure the Dockerfile copies .next/static into the runner image." >&2
  exit 1
fi

echo "Static assets OK ($(ls "$STATIC_DIR" | wc -l | tr -d ' ') top-level entries in .next/static)"
exec "$@"
