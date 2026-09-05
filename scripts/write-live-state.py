#!/usr/bin/env python3
"""write-live-state.py - fill the LIVE STATE block in config/project-config.md.

  python scripts/write-live-state.py [--check] [--config config/project-config.md]

Replaces (or appends) the block

    ## ---- LIVE STATE (<date>) ----
    ...
    ## ---- END LIVE STATE ----

with what is TRUE ON DISK AND ON THE WIRE right now: GA4 account/property/stream/
measurement id + key event names; GSC property + GSC_ACCOUNT; Pages project +
deployment URL + custom-domain status; DNS state (who serves apex/www); form slugs +
Function routes + secret names bound; email routing rule; IndexNow key file URL; last
deployed sha + date.

Every value is READ, never typed: config/*.json written by the provisioning steps,
functions/api/*, public/*.txt, git, and a live HEAD of the apex. A value it cannot
prove is written as `unproven - <what would prove it>`, never invented.

--check does not write; it exits 1 if any live item is still "[TO SET]" or
"unsupplied", which is an ERROR once the item is live. Stdlib only.
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

START = "## ---- LIVE STATE"
END = "## ---- END LIVE STATE ----"
UNSET = re.compile(r"\[TO SET\]|unsupplied", re.I)


def cfg_val(text, key, default=""):
    m = re.search(r"^%s:(.*)$" % re.escape(key), text, re.M)
    return (m.group(1).split("#")[0].strip() or default) if m else default


def host(raw):
    h = (raw or "").strip()
    for pre in ("https://", "http://"):
        if h.lower().startswith(pre):
            h = h[len(pre):]
    return h.strip("/")


def sh(*cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def head(url, timeout=20):
    try:
        req = urllib.request.Request(url, method="HEAD",
                                     headers={"User-Agent": "write-live-state/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get("server", "")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def unproven(what):
    return "unproven - " + what


def build(text):
    domain = host(cfg_val(text, "DOMAIN"))
    rows = []
    add = rows.append

    # --- analytics -------------------------------------------------------
    ga = load_json("config/analytics.json") or {}
    add(("GA4 measurement id", ga.get("measurement_id")
         or cfg_val(text, "GA4_MEASUREMENT_ID") or unproven("config/analytics.json")))
    add(("GA4 property / stream",
         "%s / %s" % (ga.get("property_id") or "?", ga.get("stream_id") or "?") if ga
         else unproven("config/analytics.json written by the GA provisioning step")))
    add(("GA4 key events", ", ".join(ga.get("key_events") or []) or unproven("GA admin API read")))

    # --- search console --------------------------------------------------
    add(("GSC property", cfg_val(text, "GSC_PROPERTY")
         or (("sc-domain:" + domain) if domain else unproven("DOMAIN"))))
    add(("GSC account", cfg_val(text, "GSC_ACCOUNT") or unproven("project-config GSC_ACCOUNT")))

    # --- pages / hosting -------------------------------------------------
    proj = cfg_val(text, "CLOUDFLARE_PROJECT")
    add(("Cloudflare Pages project", proj or unproven("project-config CLOUDFLARE_PROJECT")))
    if proj:
        code, _ = head("https://%s.pages.dev/" % proj)
        add(("Pages deployment URL",
             "https://%s.pages.dev/ (HTTP %s)" % (proj, code or "no answer")))
    else:
        add(("Pages deployment URL", unproven("CLOUDFLARE_PROJECT")))
    if domain:
        code, server = head("https://%s/" % domain)
        add(("Custom domain", "%s -> HTTP %s%s"
             % (domain, code or "no answer", (" via %s" % server) if server else "")))
        wcode, _ = head("https://www.%s/" % domain)
        add(("apex / www", "apex HTTP %s, www HTTP %s" % (code or "-", wcode or "-")))
    else:
        add(("Custom domain", unproven("DOMAIN")))
        add(("apex / www", unproven("DOMAIN")))

    # --- forms -----------------------------------------------------------
    forms = []
    for p in sorted(glob.glob("config/formaloo*.json")):
        j = load_json(p) or {}
        live = j.get("live") if isinstance(j.get("live"), dict) else None
        if live:
            for key, f in live.items():
                forms.append("%s (slug %s)" % (key, str(f.get("slug"))[:12]))
        elif j.get("form"):
            forms.append("%s (slug %s)" % (os.path.basename(p), str(j["form"].get("slug"))[:12]))
    add(("Form slugs", "; ".join(forms) or unproven("config/formaloo*.json")))
    fns = sorted(os.path.basename(p) for p in glob.glob("functions/api/*"))
    add(("Function routes", ", ".join("/api/" + os.path.splitext(f)[0] for f in fns)
         or unproven("functions/api/")))
    secrets = set()
    for p in glob.glob("functions/api/*"):
        try:
            with open(p, encoding="utf-8", errors="replace") as f:
                secrets |= set(re.findall(r"env\.([A-Z][A-Z0-9_]{3,})", f.read()))
        except OSError:
            pass
    add(("Secret names the Functions bind", ", ".join(sorted(secrets))
         or unproven("no env.<NAME> reference in functions/api/")))

    # --- email routing ---------------------------------------------------
    add(("Email routing rule", "%s -> %s"
         % (cfg_val(text, "EDITORIAL_EMAIL") or "?", cfg_val(text, "FORWARD_TO") or "?")))

    # --- indexnow --------------------------------------------------------
    keys = [os.path.basename(p) for p in glob.glob("public/*.txt")
            if re.fullmatch(r"[0-9a-f]{8,}\.txt", os.path.basename(p))]
    add(("IndexNow key file", ("https://%s/%s" % (domain, keys[0])) if (keys and domain)
         else unproven("no <key>.txt in public/")))

    # --- deploy ----------------------------------------------------------
    sha = sh("git", "rev-parse", "--short", "HEAD")
    when = sh("git", "log", "-1", "--format=%cs")
    add(("Last commit", ("%s (%s)" % (sha, when)) if sha else unproven("not a git repo")))
    return rows


def render(rows):
    L = ["%s (%s) ----" % (START, date.today().isoformat()), "",
         "Written by scripts/write-live-state.py - every row is READ, never typed.",
         "A row reading `unproven - X` means exactly that: X has not been done or has not",
         "been recorded. It is not a placeholder to be filled in by hand.", "",
         "| item | value |", "|---|---|"]
    L += ["| %s | %s |" % (k, v) for k, v in rows]
    L += ["", END]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config/project-config.md")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    if not os.path.exists(a.config):
        print("FAIL %s not found" % a.config)
        return 1
    with open(a.config, encoding="utf-8", errors="replace") as f:
        text = f.read()

    rows = build(text)
    block = render(rows)

    stale = [k for k, v in rows if UNSET.search(str(v))]
    unpr = [k for k, v in rows if str(v).startswith("unproven - ")]

    if a.check:
        for k in stale:
            print("FAIL %s is still [TO SET]/unsupplied - an ERROR once the item is live" % k)
        for k in unpr:
            print("WARN %s is unproven" % k)
        print("live state: %d row(s), %d stale, %d unproven" % (len(rows), len(stale), len(unpr)))
        return 1 if stale else 0

    if START in text:
        s = text.index(START)
        e = text.index(END) + len(END) if END in text else len(text)
        new = text[:s] + block + text[e:]
    else:
        new = text.rstrip("\n") + "\n\n" + block + "\n"
    with open(a.config, "w", encoding="utf-8", newline="\n") as f:
        f.write(new)
    print("wrote LIVE STATE into %s - %d row(s), %d unproven" % (a.config, len(rows), len(unpr)))
    for k in unpr:
        print("  unproven: %s" % k)
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
