#!/usr/bin/env bash
# kit:pre-cutover@1.0.0 — the read-and-rollback record taken BEFORE any DNS write.
# Usage: bash scripts/pre-cutover.sh <DOMAIN> [--history]
#
# launch REFUSES the cutover if this exits non-zero. It does four things, in order:
#   0. GATE-1 STAGING — scripts/gate1-preflight.sh must print "GATE-1 STAGING: 12/12 PASS".
#      Every host-independent Gate-1 row is proven on the staging origin BEFORE DNS moves.
#   1. READ the domain's CURRENT live state (who serves apex and www, status, title,
#      canonical, generator, robots, sitemap) and write it to audits/pre-cutover-<date>.md.
#   2. ROLLBACK RECORD — the exact current DNS answers, so the previous state can be
#      restored without asking anyone to remember it.
#   3. Print the explicit human go-ahead line. This script never writes DNS.
# --history additionally records whether the domain already serves a real site (a
# cutover onto a live site is a migration, not a launch, and needs the legacy inventory).
# Bash + curl + dig only. Nothing here mutates anything outside audits/.
set -uo pipefail

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { echo "FAIL usage: pre-cutover.sh <DOMAIN> [--history]" >&2; exit 2; }
shift
HISTORY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --history) HISTORY=1; shift ;;
    *) echo "FAIL unknown option: $1" >&2; exit 2 ;;
  esac
done
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"

DATE=$(date +%F)
OUT="audits/pre-cutover-${DATE}.md"
mkdir -p audits
fails=0

CF_PROJECT=$(grep -E '^CLOUDFLARE_PROJECT:' config/project-config.md 2>/dev/null \
             | cut -d: -f2- | sed 's/#.*//' | xargs || true)

{
  echo "# PRE-CUTOVER READ — ${DOMAIN} — ${DATE}"
  echo
  echo "Taken BEFORE any custom-domain attach or DNS write. Nothing below was changed by"
  echo "this script; it is the state to roll back to."
  echo
} > "$OUT"

echo "== 0. GATE-1 STAGING =="
if [ -n "$CF_PROJECT" ] && [ -f scripts/gate1-preflight.sh ]; then
  g1=$(bash scripts/gate1-preflight.sh "$DOMAIN" "$CF_PROJECT" \
         --origin "https://${CF_PROJECT}.pages.dev" 2>&1) || true
  echo "$g1" | tail -3
  { echo "## Gate-1 staging"; echo '```'; echo "$g1" | tail -20; echo '```'; echo; } >> "$OUT"
  if ! printf '%s' "$g1" | grep -q "GATE-1 STAGING: 12/12 PASS"; then
    echo "FAIL Gate-1 staging is not 12/12 — a red staging table blocks the cutover"
    fails=$((fails + 1))
  fi
else
  echo "FAIL cannot run Gate-1: CLOUDFLARE_PROJECT unset in config/project-config.md, or scripts/gate1-preflight.sh missing"
  fails=$((fails + 1))
fi

echo "== 1. CURRENT LIVE STATE =="
{ echo "## Current live state"; echo; echo '| host | code | final URL | title | generator |'; echo '|---|---|---|---|---|'; } >> "$OUT"
for host in "$DOMAIN" "www.${DOMAIN}"; do
  code=$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://${host}/" || echo 000)
  final=$(curl -sSL -o /dev/null -m 20 -w '%{url_effective}' "https://${host}/" || echo "-")
  body=$(curl -sSL -m 20 "https://${host}/" || true)
  title=$(printf '%s' "$body" | tr '\n' ' ' | sed -n 's;.*<title[^>]*>\(.*\)</title>.*;\1;p' | cut -c1-70)
  gen=$(printf '%s' "$body" | tr '\n' ' ' | sed -n 's;.*name="generator" content="\([^"]*\)".*;\1;p' | cut -c1-40)
  echo "  ${host}: ${code} -> ${final}"
  echo "| ${host} | ${code} | ${final} | ${title:--} | ${gen:--} |" >> "$OUT"
done
{ echo; echo "robots.txt: $(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://${DOMAIN}/robots.txt" || echo 000)"; \
  echo "sitemap-index.xml: $(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://${DOMAIN}/sitemap-index.xml" || echo 000)"; echo; } >> "$OUT"

echo "== 2. ROLLBACK RECORD (current DNS) =="
{ echo "## Rollback record — the DNS answers as they stand NOW"; echo '```'; } >> "$OUT"
for rec in A AAAA CNAME NS MX TXT; do
  ans=$(dig +short "$DOMAIN" "$rec" 2>/dev/null | paste -sd' ' -)
  wans=$(dig +short "www.${DOMAIN}" "$rec" 2>/dev/null | paste -sd' ' -)
  [ -n "$ans" ]  && { echo "${DOMAIN} ${rec} ${ans}"      | tee -a /dev/stderr >> "$OUT"; }
  [ -n "$wans" ] && { echo "www.${DOMAIN} ${rec} ${wans}" | tee -a /dev/stderr >> "$OUT"; }
done
{ echo '```'; echo; } >> "$OUT"

if [ "$HISTORY" -eq 1 ]; then
  echo "== 2b. PRIOR SITE =="
  code=$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://${DOMAIN}/" || echo 000)
  if [ "$code" = "200" ]; then
    n=$(wc -l < research/legacy-urls.txt 2>/dev/null || echo 0)
    echo "  domain already serves 200 — this is a MIGRATION, legacy inventory rows: ${n}"
    { echo "## Prior site"; echo "- ${DOMAIN} already answers 200: this is a migration, not a first launch."; \
      echo "- research/legacy-urls.txt rows: ${n}"; echo; } >> "$OUT"
    if [ "$n" -eq 0 ]; then
      echo "FAIL domain serves a live site but research/legacy-urls.txt is empty — build the legacy inventory before cutover"
      fails=$((fails + 1))
    fi
  else
    { echo "## Prior site"; echo "- ${DOMAIN} answers ${code}: no live site to migrate."; echo; } >> "$OUT"
  fi
fi

{
  echo "## Go-ahead"
  echo
  echo "- [ ] Owner has read this file and said GO, in writing, in the session."
  echo "- [ ] Rollback record above is sufficient to restore the previous DNS."
  echo
} >> "$OUT"

echo "----"
echo "pre-cutover: wrote $OUT; $fails blocking failure(s)"
echo "NEXT: the cutover needs an EXPLICIT human go-ahead. This script never writes DNS."
[ "$fails" -eq 0 ] || exit 1
