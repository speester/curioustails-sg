#!/usr/bin/env node
/**
 * serp-crawl.mjs — fill the competitor half of a SERP extract.
 *
 *   node scripts/serp-crawl.mjs <slug> [--force]
 *
 * Reads research/serp/<slug>.json (written by serp_extract.py), fetches every organic
 * result with curl and a browser User-Agent, and writes back, per result:
 *   words              main-content word count (chrome stripped)
 *   headings           the page's H2/H3 text, in document order
 * plus a top-level `competitor_headings` map { url: [heading, ...] } which
 * brief_scaffold.py reads for its consensus / information-gain split.
 *
 * A page that returns non-200, or whose body yields under 120 words (JS-rendered
 * shells such as d-id.com), is recorded with words:null and reason:"<why>" rather
 * than dropped, so the brief can state honestly how many competitors were measured.
 *
 * Node 20+, stdlib only. Exit 0 when at least 3 competitors were measured.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MIN_WORDS = 120;
const MIN_MEASURED = 3;

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('FAIL: usage node scripts/serp-crawl.mjs <slug> [--force]');
  process.exit(1);
}
const force = process.argv.includes('--force');
const extractPath = `research/serp/${slug}.json`;
if (!fs.existsSync(extractPath)) {
  console.error(`FAIL: ${extractPath} missing — run serp_extract.py first`);
  process.exit(1);
}
const extract = JSON.parse(fs.readFileSync(extractPath, 'utf8'));

function fetchHtml(url) {
  try {
    return execFileSync('curl', [
      '-sL', '--max-time', '45', '--connect-timeout', '10',
      '--retry', '2', '--retry-delay', '1',
      '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9',
      '-w', '\n<<<HTTPSTATUS:%{http_code}>>>', url
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    return `\n<<<HTTPSTATUS:000>>>`;
  }
}

/** Strip everything that is not prose, then count words. */
function mainText(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const article = s.match(/<(article|main)\b[\s\S]*?<\/\1>/i);
  if (article) s = article[0];
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headings(html) {
  const out = [];
  const re = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&#?\w+;/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (t && t.length >= 3 && t.length <= 120 && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 40);
}

const competitorHeadings = {};
let measured = 0;
for (const item of extract.organic || []) {
  if (!force && item.words != null && item.headings) { measured++; continue; }
  const raw = fetchHtml(item.url);
  const statusMatch = raw.match(/<<<HTTPSTATUS:(\d{3})>>>\s*$/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;
  const html = raw.replace(/\n?<<<HTTPSTATUS:\d{3}>>>\s*$/, '');
  if (status !== 200) {
    item.words = null; item.headings = []; item.reason = `http ${status || 'fetch-failed'}`;
    console.log(`  rank ${String(item.rank).padStart(2)}  ${item.domain}  ${item.reason}`);
    continue;
  }
  const text = mainText(html);
  const words = text ? text.split(/\s+/).length : 0;
  const hs = headings(html);
  if (words < MIN_WORDS) {
    item.words = null; item.headings = hs; item.reason = `js-rendered (${words} static words)`;
  } else {
    item.words = words; item.headings = hs; delete item.reason;
    measured++;
  }
  if (hs.length) competitorHeadings[item.url] = hs;
  console.log(`  rank ${String(item.rank).padStart(2)}  ${item.domain}  words=${item.words ?? 'n/a'} h2h3=${hs.length}${item.reason ? '  ' + item.reason : ''}`);
}

extract.competitor_headings = competitorHeadings;
extract.crawled_on = new Date().toISOString().slice(0, 10);
extract.competitors_measured = measured;
fs.writeFileSync(extractPath, JSON.stringify(extract, null, 2), 'utf8');

const wordList = (extract.organic || []).map(o => o.words).filter(w => w != null).sort((a, b) => b - a);
console.log(`serp-crawl ${slug}: measured=${measured}/${(extract.organic || []).length} ` +
  `headings_pages=${Object.keys(competitorHeadings).length} words=[${wordList.join(', ')}]`);
if (measured < MIN_MEASURED) {
  console.error(`FAIL: only ${measured} competitors yielded static prose (floor ${MIN_MEASURED}). ` +
    `Fall back to DataForSEO on_page content parsing for the js-rendered rows.`);
  process.exit(1);
}
