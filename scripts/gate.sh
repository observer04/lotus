#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIER="${1:-}"
if [[ "$TIER" != "0" && "$TIER" != "1" ]]; then echo "usage: scripts/gate.sh <0|1>" >&2; exit 2; fi
cd "$ROOT"
exec node scripts/gate-report.mjs "$TIER"
