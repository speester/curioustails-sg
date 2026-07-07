# SEOmator Setup & Usage Guide

## Installation Status ✅
- SEOmator (`@seomator/seo-audit`) is **installed globally**
- Configuration file `seomator.toml` is ready in project root

## Quick Start

### Option 1: Using System Browser (Recommended)
SEOmator automatically detects and uses your installed Chrome, Chromium, or Edge browser:

```bash
seomator audit https://curioustails.sg
```

This will:
- Measure Core Web Vitals (LCP, CLS, FCP, TTFB, INP)
- Crawl the site (up to 50 pages based on seomator.toml config)
- Check performance, security, accessibility, technical SEO
- Generate reports in JSON, HTML, and Markdown formats

### Option 2: Audit Specific Page
```bash
seomator audit https://curioustails.sg/puppies/cavapoo
```

### Option 3: Use Config File
```bash
seomator audit --config seomator.toml
```

## Workflow Integration

### Step 1: Page Content Complete
After your page content is complete and images added, run the **current skill**:
```bash
/seo-audit-and-fix /path/to/page "primary keyword"
```
**This handles:** Content quality, keyword optimization, schema, structure

### Step 2: Site-Wide Performance & Security Check
After content passes SEO audit, run **SEOmator**:
```bash
seomator audit https://curioustails.sg
```
**This handles:** Core Web Vitals, performance, security headers, accessibility, redirects

## Output Files

SEOmator generates reports in `./seo-audit-reports/`:
- `report.json` — Full structured data for analysis
- `report.html` — Interactive dashboard
- `report.md` — Markdown summary

## Configuration

Edit `seomator.toml` to customize:
- Crawl depth and concurrent requests
- Which audit rules to enable/disable
- Output formats
- Exclusion paths

## Troubleshooting

**Issue:** "No Chromium browser found"
**Solution:** Install Chrome or Edge on your system, or run:
```bash
# Only if you have disk space available:
npx playwright install chromium
```

**Issue:** "ENOSPC: no space left on device"
**Solution:** This is a system disk space issue. Free up space, then retry. For now, use your system's existing Chrome/Edge browser — SEOmator will find it automatically.

## Integration with `/seo-audit-and-fix` Skill

| Phase | Tool | Focus |
|-------|------|-------|
| **Content & Structure** | `/seo-audit-and-fix` | Keywords, H1/H2, schema, internal links, images, E-E-A-T |
| **Performance & Security** | `seomator audit` | Core Web Vitals, HTTPS, CSP, accessibility, multi-page crawl |
| **Quality Gate** | Both + Google Rich Results Test | Final validation before merge |

## Next Steps

1. **Test SEOmator:**
   ```bash
   seomator audit https://curioustails.sg --dry-run
   ```

2. **Review first report** and identify priority fixes

3. **Update CLAUDE.md** with new step in per-page workflow (see RUN-THE-PROJECT.md)

4. **Schedule site-wide audits** as part of your quality gates
