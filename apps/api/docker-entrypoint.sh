#!/bin/sh
set -e
echo "[kinhale_api] Synchronizing database schema..."
pnpm --filter @kinhale/api db:push --force
echo "[kinhale_api] Starting dev server..."
exec pnpm --filter @kinhale/api dev
