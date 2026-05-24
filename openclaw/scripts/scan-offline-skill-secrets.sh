#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-skills}"
if [[ ! -d "$ROOT" ]]; then
  echo "missing directory: $ROOT" >&2
  exit 2
fi
rg -n --hidden -g '!*.png' -g '!*.jpg' -g '!*.jpeg' -g '!*.gif' -g '!*.webp' -g '!*.pdf' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' \
  -e 'github_pat_[A-Za-z0-9_]+' \
  -e 'ghp_[A-Za-z0-9]+' \
  -e '(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+' \
  "$ROOT" || true
