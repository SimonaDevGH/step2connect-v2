#!/bin/bash
# Post-merge setup — eseguito automaticamente dopo ogni merge di task.
# Idempotent, non-interactive, fail-fast.
set -e

echo "==> npm install"
npm install --prefer-offline --no-audit --no-fund

echo "==> post-merge setup complete"
