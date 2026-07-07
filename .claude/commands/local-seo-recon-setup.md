# Setup

The recon needs **one** thing: DataForSEO API credentials. Everything else is public scraping or
an optional local tool.

## 1. Python deps
```bash
pip install -r requirements.txt
```

## 2. DataForSEO credentials
Sign in at https://app.dataforseo.com, copy your API login + password, and set them as env vars:
```bash
export DATAFORSEO_USERNAME="you@example.com"
export DATAFORSEO_PASSWORD="your-api-password"
```
(Or copy `.env.example` to `.env` and fill it in, then source it.) The recon uses these for the
Google Business Profile, ranked-keyword, and competitor-authority calls.

## 3. Location codes
DataForSEO uses numeric location codes. Common ones:
- Australia: `2036`  ·  United States: `2840`  ·  United Kingdom: `2826`  ·  Canada: `2124`
Pass the right one with `--location` on `gbp.py` and `dfs_intel.py`.

## 4. Optional: Lighthouse
For the speed gauges, install the Lighthouse CLI:
```bash
npm install -g lighthouse
```
If it's not installed, skip `lighthouse.py` and the report simply omits the speed card.

## 5. Optional: first-fold screenshots
If you have Chrome + the claude-in-chrome tools, the synthesis step can screenshot the home and a
service page (desktop 1280 / mobile 390) to judge offer clarity. Not required.

## What you do NOT need
No Google Search Console access. No GA4 access. No Google Business Profile manager access. The recon
is deliberately pre-access — that all comes later, with the full audit.


