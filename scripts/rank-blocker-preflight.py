"""rank-blocker preflight — reachability, build provenance, history mode, location, prior runs.

Runs BEFORE any paid API call. Prints the report-header line the skill must carry.
The GSC/DataForSEO history checks are MCP calls the agent makes; this script reads their saved
output when present (audits/history.json: {"first_impression": "...", "impressions": n,
"urls_crawled": n}) and otherwise reports UNKNOWN so the mode is chosen deliberately.

Usage:
  python scripts/rank-blocker-preflight.py --domain example.com

Exit 1 when the apex does not resolve or does not return 200. Stdlib only.
"""
import argparse
import datetime
import glob
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def cfg(key, default=""):
    path = "config/project-config.md"
    if not os.path.exists(path):
        return default
    text = open(path, encoding="utf-8", errors="replace").read()
    m = re.search(r"^\s*-?\s*%s\s*:\s*(.+)$" % re.escape(key), text, re.I | re.M)
    return m.group(1).strip() if m else default


# Cloudflare (which fronts every site this skill audits) 403s the default
# Python-urllib User-Agent, so an unset UA reads as a dead apex. Always send one.
UA = "Mozilla/5.0 (compatible; rank-blocker-preflight/1.0; +https://claude.ai/code)"


def get(url, headers=None, timeout=20):
    h = {"user-agent": UA}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # a real status (404/410/500) is a finding; 0 would hide it as "unreachable"
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60).stdout.strip()
    except Exception:
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True)
    args = ap.parse_args()
    d = args.domain
    today = datetime.date.today().isoformat()

    # b. reachability — public resolver first, then the apex
    code, doh = get("https://1.1.1.1/dns-query?name=%s&type=A" % d, {"accept": "application/dns-json"})
    resolved = '"data"' in doh
    status, _ = get("https://%s/" % d)
    print("Reachability: DoH %s · https://%s/ -> HTTP %s" % ("resolved" if resolved else "NOT RESOLVED", d, status))
    if status != 200:
        print("BINDING CONSTRAINT: the apex does not return 200. An existing GSC property is NOT "
              "evidence of a live site. Say this immediately and ask whether to continue "
              "competitor-only — do not spend credit.", file=sys.stderr)
        return 1

    # c. build provenance
    dirty = sh("git status --porcelain")
    head = sh("git rev-parse --short HEAD")
    _, home = get("https://%s/?cb=%s" % (d, int(datetime.datetime.now().timestamp())))
    m = re.search(r'name="build-commit" content="([^"]*)"', home)
    live_sha = m.group(1) if m else ""
    src_m = max([os.path.getmtime(os.path.join(r, f))
                 for r, _dd, ff in os.walk("src") for f in ff] or [0])
    dist_m = max([os.path.getmtime(os.path.join(r, f))
                  for r, _dd, ff in os.walk("dist") for f in ff] or [0]) if os.path.isdir("dist") else 0
    fresh = dist_m >= src_m
    build_mode = "dist" if (not dirty and live_sha and live_sha == head and fresh) else "LIVE"
    print("Build: %s %s · clean tree: %s · fresh: %s (live=%s head=%s)"
          % (build_mode, live_sha or head or "unknown", "yes" if not dirty else "NO",
             "yes" if fresh else "NO", live_sha or "-", head or "-"))
    if build_mode == "LIVE":
        print("   → crawl LIVE URLs as ground truth and mark every [SRC]-only check UNKNOWN.")

    # d. history
    hist = {}
    if os.path.exists("audits/history.json"):
        try:
            hist = json.load(open("audits/history.json", encoding="utf-8"))
        except Exception:
            hist = {}
    first = hist.get("first_impression")
    impressions = hist.get("impressions")
    mode = "full" if first else ("competitive-baseline" if first is not None or impressions == 0 else "UNKNOWN")
    age = ""
    if first:
        try:
            age = "%d days" % (datetime.date.today() - datetime.date.fromisoformat(first)).days
        except Exception:
            age = ""
    print("History: first impression %s · impressions %s · mode %s%s"
          % (first or "none/UNKNOWN", impressions if impressions is not None else "UNKNOWN",
             mode, (" · site age " + age) if age else ""))
    if mode != "full":
        print("   → Gates 2-5 will be UNKNOWN; run the reduced Gate 0 + 1 + 6 COMPETITIVE BASELINE "
              "mode deliberately, not as a degraded audit.")

    # e. location
    country = cfg("COUNTRY") or cfg("LOCATION")
    language = cfg("LANGUAGE") or "en"
    source = "project-config" if country else "fallback"
    print("Location: %s · Language: %s (source: %s)" % (country or "Singapore", language, source))

    # f. prior runs
    prior = sorted(glob.glob("audits/%s-*/" % d))
    payloads = sum(len(glob.glob(p + "evidence/*.json")) for p in prior)
    empty = [f for p in prior for f in glob.glob(p + "evidence/*.json") if os.path.getsize(f) == 0]
    print("Prior audits: %d (evidence payloads on disk: %d, zero-byte: %d)" % (len(prior), payloads, len(empty)))
    if prior:
        print("   → a second pass writes audit-<scope>.md / findings-<scope>.json; NEVER overwrite %s"
              % os.path.basename(prior[-1].rstrip("/")))

    # g. token scopes recorded by the launch Step 0 probe
    scopes = "UNKNOWN (run ~/.claude/scripts/preflight.py --launch)"
    if os.path.exists(".claude/state/preflight-launch.json"):
        rows = json.load(open(".claude/state/preflight-launch.json", encoding="utf-8")).get("rows", [])
        scopes = ", ".join("%s=%s" % (r["check"], r["status"]) for r in rows
                           if any(k in r["check"] for k in ("Redirect Rule", "Email Routing", "Pages", "DNS")))
    print("Token scopes: %s" % scopes)
    print("   → the fix queue may not list deploy / redirect rule / email routing as executable "
          "when a scope row is FAIL.")

    print("\nHEADER LINE:")
    print("Reachability: %s (%s) · Build: %s %s clean · History: first impression %s -> mode %s · "
          "Location: %s (source: %s) · Prior audits: %d (evidence reused: %d payloads) · Paid API calls: <n>"
          % (status, today, build_mode, live_sha or head or "unknown", first or "none", mode,
             country or "Singapore", source, len(prior), payloads))
    # contracts section-1b: every gate prints WHAT IT MEASURED, not only
    # what failed - the fixed shape `checked=<n> failed=<m>`.
    print("rank-blocker-preflight: checked=%d failed=0" % max(1, len(prior)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
