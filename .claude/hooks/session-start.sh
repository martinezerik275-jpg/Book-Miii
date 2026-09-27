#!/bin/bash
# Installs dependencies so `npm test` works at the start of a Claude Code web session.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
npm ci --no-audit --no-fund
