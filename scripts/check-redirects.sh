#!/usr/bin/env bash
# kit:check-redirects@1.0.0 — every redirect source reaches its canonical target in ONE hop.
# Usage: bash scripts/check-redirects.sh <DOMAIN> [--legacy research/legacy-urls.txt]
#
# Sources come from public/_redirects (Cloudflare Pages syntax) plus, with --legacy,
# one URL or path per line from the legacy inventory. For each source it asserts:
#   * the first response is 301 (not 302, not 200, not 404)
#   * Location is byte-identical to the canonical target, absolute, https, on <DOMAIN>
#   * following the chain reaches exactly one 200 in ONE hop
# It also fails a catch-all `/*` rule, which silently swallows every 404 into a 301.
# Exit 0 only when every row passes. Bash + curl only.
set -uo pipefail

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { echo "FAIL usage: check-redirects.sh <DOMAIN> [--legacy <file>]" >&2; exit 2; }
shift
LEGACY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --legacy) LEGACY="${2:-}"; shift 2 ;;
    *) echo "FAIL unknown option: $1" >&2; exit 2 ;;
  esac
done
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"

REDIRECTS="public/_redirects"
fails=0; rows=0

# A catch-all turns every genuine 404 into a 301 and hides broken links from the gate.
if [ -f "$REDIRECTS" ] && grep -qE '^\s*/\*' "$REDIRECTS"; then
  echo "FAIL catch-all rule in $REDIRECTS (a /* line makes every 404 look like a 301)"
  grep -nE '^\s*/\*' "$REDIRECTS"
  fails=$((fails + 1))
fi

check_one() {   # $1 source path, $2 expected target (empty = any 200 in one hop)
  local src="$1" want="${2:-}" url code loc final
  url="https://${DOMAIN}${src}"
  rows=$((rows + 1))
  read -r code loc < <(curl -sS -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "$url" || echo "000 ")
  if [ "$code" != "301" ]; then
    echo "FAIL $src -> HTTP $code (want 301)"; fails=$((fails + 1)); return
  fi
  if [ -n "$want" ] && [ "$loc" != "$want" ]; then
    echo "FAIL $src -> Location '$loc' != canonical '$want'"; fails=$((fails + 1)); return
  fi
  case "$loc" in
    https://*) : ;;
    *) echo "FAIL $src -> Location '$loc' is not an absolute https URL"; fails=$((fails + 1)); return ;;
  esac
  final=$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "$loc" || echo 000)
  if [ "$final" != "200" ]; then
    echo "FAIL $src -> $loc responded $final (chain longer than one hop, or dead target)"
    fails=$((fails + 1)); return
  fi
  echo "PASS $src -> 301 $loc -> 200"
}

if [ -f "$REDIRECTS" ]; then
  while read -r src dst _rest; do
    case "${src:-}" in ""|\#*) continue ;; esac
    case "$src" in /\**) continue ;; esac
    case "$dst" in
      http*) want="$dst" ;;
      /*)    want="https://${DOMAIN}${dst}" ;;
      *)     want="" ;;
    esac
    check_one "$src" "$want"
  done < "$REDIRECTS"
else
  echo "WARN $REDIRECTS not found — only the legacy list is checked"
fi

if [ -n "$LEGACY" ]; then
  [ -f "$LEGACY" ] || { echo "FAIL --legacy file not found: $LEGACY" >&2; exit 2; }
  while read -r u; do
    case "${u:-}" in ""|\#*) continue ;; esac
    p="$u"
    case "$p" in http*) p="/${p#*://}"; p="/${p#*/}" ;; esac
    check_one "$p" ""
  done < "$LEGACY"
fi

echo "----"
echo "check-redirects: $rows source(s), $fails failure(s) on $DOMAIN"
[ "$fails" -eq 0 ] || exit 1
