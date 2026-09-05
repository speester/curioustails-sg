#!/usr/bin/env node
// check-cards.mjs — CARD FEATURE-IMAGE RULE + interactive-pattern count on BUILT html.
// Fails when a card that links to a page has no <img>, when a card carries an
// arrow/chevron glyph outside an <a>, or when a page ships <3 interactive patterns.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = join(process.env.PROJECT_ROOT || process.cwd(), "dist");
const MIN_PATTERNS = 3;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (e.endsWith(".html")) out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) { console.log("FAIL dist/ not found — run npm run build"); process.exit(1); }

let cards = 0, noImg = 0, inert = 0, thin = 0, pages = 0, minPatterns = Infinity;
const bad = [];

for (const file of walk(DIST)) {
  pages++;
  const html = readFileSync(file, "utf8");
  const route = "/" + relative(DIST, file).replace(/\\/g, "/").replace(/index\.html$/, "");
  const cardBlocks = [...html.matchAll(/<a\b[^>]*(?:data-card|class="[^"]*\bcard\b)[^>]*>[\s\S]*?<\/a>/gi)];
  cards += cardBlocks.length;
  for (const m of cardBlocks) if (!/<img\b/i.test(m[0])) { noImg++; bad.push(`${route} card without <img>`); }
  // arrow/chevron glyph outside an anchor
  const stripped = html.replace(/<a\b[\s\S]*?<\/a>/gi, " ");
  const glyphs = (stripped.match(/[→›»▸⟶]|&rarr;|&raquo;/g) || []).length;
  if (glyphs) { inert += glyphs; bad.push(`${route} ${glyphs} arrow glyph(s) outside <a>`); }
  const patterns = new Set();
  for (const attr of html.matchAll(/data-pattern=["']([^"']+)["']/gi)) patterns.add(attr[1]);
  for (const cls of ["card-feature", "card-figure", "quote-carder", "triage-lanes",
                     "tilt-panel", "proof-panel", "anchor-index"]) {
    if (html.includes(cls)) patterns.add(cls);
  }
  minPatterns = Math.min(minPatterns, patterns.size);
  if (patterns.size < MIN_PATTERNS) { thin++; bad.push(`${route} only ${patterns.size} interactive pattern(s)`); }
}

// A GATE THAT MEASURED NOTHING IS NOT A PASS (contracts: every 3-exit instrument that
// reads dist/ carries this HALT). Letter (c) used to print three PASS rows and exit 0 on
// an empty dist/ — i.e. on every run made before the build or from the wrong cwd.
if (pages === 0) {
  console.log("HALT: no dist/**/index.html — there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.");
  process.exit(1);
}

console.log("CHECK                                RESULT  DETAIL");
console.log("-".repeat(78));
console.log(`${"every card renders an <img>".padEnd(36)} ${noImg ? "FAIL" : "PASS"}    ${noImg} of ${cards} card(s)`);
console.log(`${"no arrow glyph outside <a>".padEnd(36)} ${inert ? "FAIL" : "PASS"}    ${inert}`);
console.log(`${">=3 interactive patterns per page".padEnd(36)} ${thin ? "FAIL" : "PASS"}    ${thin} page(s) below`);
for (const b of bad.slice(0, 10)) console.log("   " + b);
console.log("-".repeat(78));
console.log(`pages=${pages} cards=${cards} without-img=${noImg} inert-arrows=${inert} interactive_patterns=${
  minPatterns === Infinity ? 0 : minPatterns}`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words.
console.log(`check-cards: checked=${cards} failed=${noImg + inert + thin}`);
process.exit(noImg || inert || thin ? 1 : 0);
