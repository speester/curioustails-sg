"""AI visibility check: ask Claude, ChatGPT, Gemini and Perplexity (web search on)
the prompts in research/ai-visibility/prompts.csv via DataForSEO, and record
whether each answer cites curioustails.sg or another owner domain.

Usage: python scripts/ai_visibility_check.py [--label baseline]
Writes research/ai-visibility/<label>-<date>.json and prints a score table.
"""
import argparse, base64, csv, datetime, json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "research", "ai-visibility")
ENGINES = ["claude", "chat_gpt", "gemini", "perplexity"]
CT = "curioustails.sg"
OWNER = ["curioustails.sg", "cavapoopuppy.sg", "maltipoo.sg", "puppysingapore.com", "corgi.sg"]


def load_env():
    for line in open(r"C:\Users\admin\.claude\.env", encoding="utf-8"):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            os.environ.setdefault(k, v.strip().strip('"'))


def call(path, body=None):
    auth = base64.b64encode(f"{os.environ['DATAFORSEO_USERNAME']}:{os.environ['DATAFORSEO_PASSWORD']}".encode()).decode()
    req = urllib.request.Request("https://api.dataforseo.com/v3/" + path,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Basic " + auth, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=300))


def pick_model(engine):
    res = call(f"ai_optimization/{engine}/llm_responses/models")["tasks"][0]["result"]
    return next(m["model_name"] for m in res if m.get("web_search_supported"))


def ask(engine, model, prompt, web=True):
    try:
        r = call(f"ai_optimization/{engine}/llm_responses/live",
                 [{"user_prompt": prompt, "model_name": model, "web_search": web}])
        t = r["tasks"][0]
        blob = json.dumps(t.get("result"))
        text = " ".join(re.findall(r'"text": "((?:[^"\\]|\\.)*)"', blob))
        urls = sorted(set(re.findall(r'https?://[^\s"\\)]+', blob)))
        err = None if t["status_code"] == 20000 else t["status_message"]
    except Exception as e:  # keep the run going; record the failure
        text, urls, err = "", [], str(e)
    low = (text + " " + " ".join(urls)).lower()
    return {"engine": engine, "model": model, "prompt": prompt, "error": err,
            "ct_cited": CT in low or "curious tails" in low,
            "owner_cited": [d for d in OWNER if d in low],
            "urls": urls, "text": text[:4000]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default="baseline")
    ap.add_argument("--no-search", action="store_true", help="test training-data recall only")
    ap.add_argument("--engines", default=",".join(ENGINES))
    a = ap.parse_args()
    load_env()
    prompts = [r["prompt"] for r in csv.DictReader(open(os.path.join(OUT, "prompts.csv"), encoding="utf-8"))]
    engines = a.engines.split(",")
    models = {e: pick_model(e) for e in engines}
    jobs = [(e, models[e], p, not a.no_search) for e in engines for p in prompts]
    with ThreadPoolExecutor(8) as ex:
        rows = list(ex.map(lambda j: ask(*j), jobs))
    out = os.path.join(OUT, f"{a.label}-{datetime.date.today()}.json")
    json.dump({"models": models, "rows": rows}, open(out, "w", encoding="utf-8"), indent=1)
    print(f"{'engine':12} {'ok':>3} {'CT':>4} {'owner':>6}")
    for e in engines:
        rs = [r for r in rows if r["engine"] == e and not r["error"]]
        n = len(rs) or 1
        print(f"{e:12} {len(rs):>3} {sum(r['ct_cited'] for r in rs)/n:>4.0%} {sum(bool(r['owner_cited']) for r in rs)/n:>6.0%}")
    print("saved", out)


if __name__ == "__main__":
    sys.exit(main())
