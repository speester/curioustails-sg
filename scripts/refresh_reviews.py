#!/usr/bin/env python
"""refresh_reviews.py - weekly pull of Google reviews into /reviews.

  python scripts/refresh_reviews.py            # pull, rebuild, commit, push if changed
  python scripts/refresh_reviews.py --no-push  # pull and rebuild only
  python scripts/refresh_reviews.py --dry-run  # pull and report, write nothing

Steps:
  1. Pull the newest reviews for the Google place via DataForSEO (task_post, then task_get).
  2. Merge into sme/raw/google-reviews.json by review_id. Existing rows are kept, so reviews
     that drop out of the newest-50 window stay on the page.
  3. Drop any review_id listed in scripts/review_exclusions.json (owner decisions).
  4. Sort newest first and rebuild src/data/reviews.ts, review-wall.ts and review media.
  5. If the generated files changed, check the site builds, then commit only those paths
     and push origin main. Pushing main is the deploy (Cloudflare Pages builds from GitHub).

Credentials come from C:\\Users\\admin\\.claude\\.env (DATAFORSEO_USERNAME / _PASSWORD).
Values are never printed.
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "sme" / "raw" / "google-reviews.json"
EXCLUDE = ROOT / "scripts" / "review_exclusions.json"
ENV_FILE = Path(os.path.expanduser("~")) / ".claude" / ".env"
PLACE_CID = str(int("b4c1905c6481624", 16))  # Curious Tails, 2 Balestier Rd (from the review_url feature id)
LOCATION_CODE = 2702  # Singapore
API = "https://api.dataforseo.com/v3/business_data/google/reviews"
GENERATED = [
    "src/data/reviews.ts",
    "src/data/review-wall.ts",
    "src/data/review-media.json",
    "src/assets/reviews",
    "sme/raw/google-reviews.json",
]


def log(msg):
    print("[%s] %s" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg), flush=True)


def load_env():
    env = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def dfs_call(url, auth, body=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Basic " + auth, "Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req, timeout=120))


def pull_newest(auth, depth=100):
    posted = dfs_call(API + "/task_post", auth, [{
        "cid": PLACE_CID, "language_code": "en", "location_code": LOCATION_CODE,
        "depth": depth, "sort_by": "newest",
    }])
    task = posted["tasks"][0]
    if task.get("status_code") not in (20000, 20100):  # 20100 = "Task Created"
        raise RuntimeError("task_post failed: %s" % task.get("status_message"))
    tid = task["id"]
    for _ in range(40):
        time.sleep(10)
        t = dfs_call(API + "/task_get/" + tid, auth)["tasks"][0]
        if t.get("status_code") == 20000 and t.get("result"):
            return t["result"][0].get("items") or []
    raise RuntimeError("task %s did not finish in time" % tid)


def merge(existing, fresh, excluded):
    by_id = {r["review_id"]: r for r in existing if r.get("review_id")}
    added = 0
    for r in fresh:
        rid = r.get("review_id")
        if not rid or rid in by_id:
            continue
        by_id[rid] = r
        added += 1
    dropped = [rid for rid in list(by_id) if rid in excluded]
    for rid in dropped:
        del by_id[rid]
    rows = sorted(by_id.values(), key=lambda r: r.get("timestamp") or "", reverse=True)
    return rows, added, len(dropped)


def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8")


def git_changed():
    out = run(["git", "status", "--porcelain", "--"] + GENERATED).stdout
    return bool(out.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-push", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    env = load_env()
    auth = base64.b64encode(
        ("%s:%s" % (env["DATAFORSEO_USERNAME"], env["DATAFORSEO_PASSWORD"])).encode()
    ).decode()
    excluded = set(json.loads(EXCLUDE.read_text(encoding="utf-8")).get("review_ids", []))

    log("pulling newest reviews from Google via DataForSEO")
    fresh = pull_newest(auth)
    existing = json.loads(RAW.read_text(encoding="utf-8"))
    rows, added, dropped = merge(existing, fresh, excluded)
    log("pulled %d; %d new; %d excluded; total now %d" % (len(fresh), added, dropped, len(rows)))

    if a.dry_run:
        log("dry run: nothing written")
        return 0
    if added == 0 and dropped == 0 and not git_changed():
        log("no new reviews; page already current")
        return 0

    RAW.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for step in (
        ["python", "scripts/build_reviews.py"],
        ["python", "scripts/fetch_review_media.py"],
        ["python", "scripts/build_review_wall.py"],
    ):
        log("running " + " ".join(step[1:]))
        run(step)

    if not git_changed():
        log("generated files unchanged after rebuild")
        return 0

    log("checking the site builds")
    build = subprocess.run(["npm", "run", "build"], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", shell=True)
    if build.returncode != 0:
        log("BUILD FAILED; nothing committed. Check the build output.")
        log(build.stdout[-1500:] + build.stderr[-1500:])
        return 1

    if a.no_push:
        log("changes staged in working tree; --no-push so not committed")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    run(["git", "add", "--"] + GENERATED)
    run(["git", "commit", "-m",
         "content(reviews): weekly refresh %s (+%d new, newest first)\n\n"
         "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>" % (stamp, added)])
    run(["git", "pull", "--rebase", "--autostash", "-q", "origin", "main"])
    run(["git", "push", "-q", "origin", "main"])
    log("pushed weekly refresh; Cloudflare Pages will deploy it")
    return 0


if __name__ == "__main__":
    sys.exit(main())
