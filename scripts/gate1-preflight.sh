#!/usr/bin/env bash
# GATE-1 PREFLIGHT — the free (curl-only) half of seo-rank-blocker-audit Gate 1.
# Usage: bash scripts/gate1-preflight.sh <DOMAIN> <CLOUDFLARE_PROJECT> [--local | --origin <url>]
#   --local          run only the rows measurable against dist/ (1-3 partially, 8-13)
#   --origin <url>   run every HOST-INDEPENDENT row against an arbitrary origin
#                    (e.g. https://<project>.pages.dev) BEFORE DNS cutover. Rows 4
#                    (www->apex), 5 (http->https) and 15 (GSC) are DNS-dependent and
#                    are the only rows deferred to the post-cutover run.
# Exit 0 when every row PASSes, 1 otherwise.
set -uo pipefail

D="${1:-}"; P="${2:-}"; MODE="full"; ORIGIN=""
shift 2 2>/dev/null || true
while [ $# -gt 0 ]; do
  case "$1" in
    --local)  MODE="--local" ;;
    --origin) MODE="--origin"; ORIGIN="${2:-}"; shift ;;
    *) echo "unknown flag: $1"; exit 2 ;;
  esac
  shift
done
[ -z "$D" ] && { echo "usage: gate1-preflight.sh <DOMAIN> <CLOUDFLARE_PROJECT> [--local | --origin <url>]"; exit 2; }
[ "$MODE" = "--origin" ] && [ -z "$ORIGIN" ] && { echo "FAIL: --origin needs a URL, e.g. --origin https://$P.pages.dev"; exit 2; }
ORIGIN="${ORIGIN:-https://$D}"; ORIGIN="${ORIGIN%/}"
# DNS-dependent rows run only against the real canonical host.
DNSROWS=1; [ "$MODE" = "--origin" ] && DNSROWS=0
[ -d dist ] || { echo "FAIL: dist/ not found — run npm run build first"; exit 1; }

PASS=0; FAIL=0
row() { # row <n> <name> <status> <detail>
  printf '| %-2s | %-56s | %-4s | %s\n' "$1" "$2" "$3" "$4"
  if [ "$3" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
}
verdict() { [ "$1" = "$2" ] && echo PASS || echo FAIL; }

SITEMAP="dist/sitemap-0.xml"
[ -f "$SITEMAP" ] || SITEMAP="$(ls dist/sitemap*.xml 2>/dev/null | grep -v index | head -1)"
# INDEXNOW_KEY is exported by the loader, never read by this script:
#   python ~/.claude/scripts/with_env.py --only INDEXNOW_KEY -- bash scripts/gate1-preflight.sh <DOMAIN> <PROJECT>
INDEXNOW_KEY="${INDEXNOW_KEY:-}"

# Sample routes: /, first money page, first blog page, first hub page (from dist/)
SAMPLES="/"
for pat in 'dist/services' 'dist/reviews' 'dist/tools'; do
  s=$(ls -d ${pat}/*/ 2>/dev/null | head -1); [ -n "$s" ] && SAMPLES="$SAMPLES ${s#dist}"
done
s=$(ls -d dist/blog/*/ 2>/dev/null | head -1); [ -n "$s" ] && SAMPLES="$SAMPLES ${s#dist}"
[ -d dist/blog ] && SAMPLES="$SAMPLES /blog/"
SAMPLES=$(echo "$SAMPLES" | tr ' ' '\n' | awk 'NF' | sort -u | head -4 | tr '\n' ' ')

echo "GATE-1 PREFLIGHT  domain=$D  project=$P  mode=$MODE  origin=$ORIGIN  samples: $SAMPLES"
echo "|  # | check                                                    | ok   | detail"

# --- Row 1: canonical == served == og:url == sitemap <loc>
bad=""
for p in $SAMPLES; do
  f="dist${p}index.html"; [ "$p" = "/" ] && f="dist/index.html"
  [ -f "$f" ] || { bad="$bad $p(no-file)"; continue; }
  can=$(grep -o 'rel="canonical" href="[^"]*"' "$f" | head -1 | sed 's/.*href="//;s/"//')
  og=$(grep -o 'property="og:url" content="[^"]*"' "$f" | head -1 | sed 's/.*content="//;s/"//')
  want="https://$D$p"
  [ "$can" = "$want" ] || bad="$bad $p(canonical=$can)"
  [ "$og" = "$want" ] || bad="$bad $p(og:url=$og)"
  [ -f "$SITEMAP" ] && { n=$(grep -c "<loc>$want</loc>" "$SITEMAP"); [ "$n" = "1" ] || bad="$bad $p(sitemap=$n)"; }
  if [ "$MODE" != "--local" ]; then
    eff=$(curl -sL -o /dev/null -w '%{http_code} %{url_effective}' "$ORIGIN$p")
    case "$eff" in "200 $ORIGIN$p") : ;; *) bad="$bad $p(live=$eff)";; esac
  fi
done
row 1 "canonical == served == og:url == sitemap <loc>" "$( [ -z "$bad" ] && echo PASS || echo FAIL )" "${bad:-all samples byte-identical}"

# --- Row 2 + 3 + 4 + 5 + 6 + 7 + 9 + 14 (live only)
if [ "$MODE" != "--local" ]; then
  bad=""
  for p in $SAMPLES; do
    r=$(curl -sSI -o /dev/null -w '%{http_code} %{num_redirects}' "$ORIGIN$p")
    [ "$r" = "200 0" ] || bad="$bad $p($r)"
  done
  row 2 "canonical dereferences with ZERO redirects" "$( [ -z "$bad" ] && echo PASS || echo FAIL )" "${bad:-200 0}"

  bad=""
  for p in $SAMPLES; do
    [ "$p" = "/" ] && continue
    bare="${p%/}"
    r=$(curl -sSI -o /dev/null -w '%{http_code} %{redirect_url}' "$ORIGIN$bare")
    case "$r" in "308 $ORIGIN$p"|"301 $ORIGIN$p") : ;; *) bad="$bad $bare($r)";; esac
  done
  row 3 "bare form redirects ONCE to the slashed form" "$( [ -z "$bad" ] && echo PASS || echo FAIL )" "${bad:-308 -> slashed}"

  if [ "$DNSROWS" = "1" ]; then
    bad=""
    for p in $SAMPLES; do
      r=$(curl -sSL -o /dev/null -w '%{num_redirects} %{url_effective}' "https://www.$D$p")
      [ "$r" = "1 https://$D$p" ] || bad="$bad $p($r)"
    done
    row 4 "www -> apex, one hop" "$( [ -z "$bad" ] && echo PASS || echo FAIL )" "${bad:-1 hop to apex}"

    r=$(curl -sSI -o /dev/null -w '%{http_code} %{redirect_url}' "http://$D/")
    row 5 "http -> https" "$( case "$r" in "301 https://$D/"|"308 https://$D/") echo PASS;; *) echo FAIL;; esac )" "$r"
  else
    echo "|  4 | www -> apex, one hop                                     | DNS  | deferred: needs the apex in DNS (post-cutover run)"
    echo "|  5 | http -> https                                            | DNS  | deferred: needs the apex in DNS (post-cutover run)"
  fi

  # Row 6: in --origin mode the staging origin IS the preview host under test.
  PREVIEW="https://$P.pages.dev/"; [ "$MODE" = "--origin" ] && PREVIEW="$ORIGIN/"
  hdr=$(curl -sI "$PREVIEW" | tr -d '\r')
  if echo "$hdr" | grep -qi 'x-robots-tag:.*noindex' || echo "$hdr" | grep -qi "^location: https://$D/"; then
    row 6 "preview host not indexable" PASS "$(echo "$hdr" | grep -i 'x-robots-tag\|^location' | head -1)"
  else
    row 6 "preview host not indexable" FAIL "no noindex header and no 301 to the apex"
  fi

  rob=$(curl -s "$ORIGIN/robots.txt")
  ok=PASS
  echo "$rob" | grep -q "Sitemap: https://$D/sitemap-index.xml" || ok=FAIL
  echo "$rob" | grep -q "Disallow: /cdn-cgi/" || ok=FAIL
  row 7 "robots.txt: sitemap INDEX + Disallow /cdn-cgi/" "$ok" "$(echo "$rob" | grep -i 'sitemap\|cdn-cgi' | tr '\n' ' ')"

  # W8.5 - launch gate item 15 "AI crawlers not blocked" had NO INSTRUMENT anywhere:
  # "GPTBot" appears in no kit script, and three live zones were silently blocking
  # GPTBot / ClaudeBot / CCBot / Google-Extended through Cloudflare's MANAGED robots.txt
  # while their gate rows read PASS. An AI crawler blocked on an AI-answer-engine strategy
  # is the strategy failing at the door.
  ai_blocked=""
  for bot in GPTBot ClaudeBot CCBot Google-Extended PerplexityBot; do
    if echo "$rob" | awk -v b="$bot" '
        BEGIN{IGNORECASE=1; inblk=0}
        /^[Uu]ser-agent:/ { inblk = (index(tolower($0), tolower(b)) > 0) }
        inblk && /^[Dd]isallow:[[:space:]]*\/[[:space:]]*$/ { found=1 }
        END{ exit(found?0:1) }'; then
      ai_blocked="$ai_blocked $bot"
    fi
  done
  row 8b "AI crawlers not blocked (GPTBot/ClaudeBot/CCBot/Google-Extended)"       "$( [ -z "$ai_blocked" ] && echo PASS || echo FAIL )"       "${ai_blocked:-none disallowed}${ai_blocked:+ -- disallowed in robots.txt; if this robots.txt is Cloudflare MANAGED, turn the setting off in the zone}"

  probe="$ORIGIN/zz-$(date +%s)-does-not-exist/"
  code=$(curl -s -o /dev/null -w '%{http_code}' "$probe")
  row 9 "soft-404 negative probe" "$( case "$code" in 404|410) echo PASS;; *) echo FAIL;; esac )" "HTTP $code"

  gb=$(curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "$ORIGIN/" | grep -c '<h1')
  pl=$(curl -s "$ORIGIN/" | grep -c '<h1')
  row 14 "Googlebot UA gets the same HTML, no challenge" "$( verdict "$gb" "$pl" )" "googlebot h1=$gb plain h1=$pl"
fi

# --- Row 8: every sitemap URL live 200 and count == indexable routes
built=$(find dist -name index.html | wc -l | tr -d ' ')
noidx=$(grep -rl 'name="robots" content="[^"]*noindex' dist --include=index.html 2>/dev/null | wc -l | tr -d ' ')
indexable=$((built - noidx))
smcount=$(grep -c '<loc>' "$SITEMAP" 2>/dev/null || echo 0)
if [ "$MODE" != "--local" ]; then
  nonok=0
  for u in $(curl -s "$ORIGIN/sitemap-0.xml" | grep -o '<loc>[^<]*' | sed 's/<loc>//'); do
    # <loc> always carries the CANONICAL domain; re-base it onto the origin under test.
    probe_u="$u"; [ "$ORIGIN" != "https://$D" ] && probe_u="$ORIGIN${u#https://$D}"
    c=$(curl -s -o /dev/null -w '%{http_code}' "$probe_u")
    [ "$c" = "200" ] || { echo "    non-200 $c $probe_u"; nonok=$((nonok+1)); }
  done
  row 8 "every sitemap URL live 200; count == indexable pages" \
    "$( [ "$nonok" = "0" ] && [ "$smcount" = "$indexable" ] && echo PASS || echo FAIL )" \
    "non-200=$nonok sitemap=$smcount indexable=$indexable"
else
  row 8 "sitemap count == indexable pages (local)" "$( verdict "$smcount" "$indexable" )" "sitemap=$smcount indexable=$indexable"
fi

# --- Row 10: no slash-less internal href in dist
n=$(grep -rhoE 'href="/[^"#?]*[^/"#?]"' dist --include=*.html 2>/dev/null | grep -v '\.' | wc -l | tr -d ' ')
row 10 "no slash-less internal href in dist" "$( verdict "$n" 0 )" "count=$n"

# --- Row 11: no canonical without trailing slash in dist
off=$(grep -rL 'rel="canonical" href="[^"]*/"' dist --include=index.html 2>/dev/null | grep -v -e 'thank-you' -e 'could-not-send' | tr '\n' ' ')
row 11 "no canonical without trailing slash in dist" "$( [ -z "$off" ] && echo PASS || echo FAIL )" "${off:-only noindex pages}"

# --- Row 12: noindex allowlist
ALLOW='dist/404.html dist/contact/thank-you/index.html dist/contact/could-not-send/index.html'
extra=""
for f in $(grep -rl 'name="robots" content="[^"]*noindex' dist 2>/dev/null); do
  echo "$ALLOW" | grep -qF "$f" || extra="$extra $f"
done
row 12 "noindex allowlist" "$( [ -z "$extra" ] && echo PASS || echo FAIL )" "${extra:-allowlist only}"

# --- Row 13: required root files
missing=""
for f in favicon.ico favicon-96x96.png apple-touch-icon.png og-default.png llms.txt "${INDEXNOW_KEY}.txt"; do
  if [ "$MODE" = "--local" ]; then
    [ -f "dist/$f" ] || missing="$missing $f"
  else
    c=$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN/$f"); [ "$c" = "200" ] || missing="$missing $f($c)"
  fi
done
if [ -n "$INDEXNOW_KEY" ] && [ -f "dist/${INDEXNOW_KEY}.txt" ]; then
  body=$(tr -d ' \r\n' < "dist/${INDEXNOW_KEY}.txt")
  [ "$body" = "$INDEXNOW_KEY" ] || missing="$missing keyfile-body-mismatch"
fi
row 13 "required root files 200 (+ key file body == key)" "$( [ -z "$missing" ] && echo PASS || echo FAIL )" "${missing:-all present}"

# --- Row 15 is an MCP call the shell cannot make (and needs the property to exist)
if [ "$MODE" = "full" ]; then
  echo "| 15 | GSC confirming signal                                    | MAN  | run mcp__gscServer__inspect_url_enhanced on / and confirm no 'Google chose X instead of user-declared Y'"
fi

TOTAL=$((PASS+FAIL))
if [ "$MODE" = "--local" ]; then
  echo "GATE-1 LOCAL: $PASS/$TOTAL PASS"
elif [ "$MODE" = "--origin" ]; then
  echo "GATE-1 STAGING: $PASS/$TOTAL PASS   (origin=$ORIGIN; rows 4 www->apex, 5 http->https and 15 GSC are DNS-dependent and deferred to the post-cutover run)"
else
  echo "GATE-1 PREFLIGHT: $PASS/$TOTAL PASS"
fi
[ "$FAIL" -eq 0 ] || { echo "BLOCKED: fix at the GENERATING layer, rebuild, redeploy, re-run the whole table."; exit 1; }
exit 0
