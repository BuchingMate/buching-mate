#!/bin/sh
set -e

echo "[entrypoint] running DB migrations"
bun dist/migrate.js

echo "[entrypoint] starting server"
exec "$@"
