# Breed / Pricing Cannibalisation Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each `/puppies/{breed}/` page the single canonical answer for its own breed's price, so `/pricing/` stops outranking it for `{breed} price` / `{breed} price singapore` queries.

**Architecture:** Three defects drive the cannibalisation, all in-code and all reversible. (1) `/pricing/` emits `FAQPage` schema containing five breed-specific "How much does a {Breed} cost in Singapore?" questions that are near-verbatim duplicates of the same question on those breeds' own pages. (2) 44 of 48 breed pages carry a hardcoded, price-lagging meta description that leads with "puppies for sale" rather than the price, while the 4 templated ones lead with a month-stamped live price range — the format the page-1 SERP winners use. (3) The typical-market comparison figures live only in `pricing.astro`, so `/pricing/` holds strictly more breed-price information than any breed page. Fix: extract shared breed data into one module, delete the duplicate schema entries from `/pricing/`, and derive every breed description and market-comparison line from that module.

**Tech Stack:** Astro 7 (static output, `trailingSlash: 'always'`), TypeScript data modules under `src/data/`, Node 22 ESM verification scripts under `scripts/`. No test framework exists in this repo — the "test" for each task is a Node script that parses the built `dist/` HTML and asserts invariants. That script is a permanent addition, not scaffolding.

---

## Corrections to the original recommendation

The recommendation this plan came from said "move per-breed price blocks onto breed pages" and "point `{breed} price singapore` anchors at the breed page". Both are **already done** in the codebase:

- All 48 breed pages already have an `id="price"` section rendering that breed's own `low`/`high` from `src/data/pricing.ts` (`src/pages/puppies/cavapoo.astro:286-324`).
- `/pricing/`'s sortable table already links every breed name to `/puppies/{slug}/` (`src/pages/pricing.astro:102`, rendered by `src/components/SortableTable.astro:47`).
- Breed page titles were already retargeted to `{Breed} Singapore | Price & Puppies | Curious Tails` on 2026-07-17.

The plan below addresses what is *actually* still broken.

## Global Constraints

- **Single source of truth for prices:** `src/data/pricing.ts`. No page may hardcode a dollar figure that also exists in `breedPricing`. Descriptions, schema, and copy derive from it.
- **Link contract (from the 2026-07-18 SEO retrofit):** body links are exactly 3 per page (Root-Seed-Node, cap 5). Supplementary links live in a per-page `<aside data-supplementary>` and are excluded from the contract and the anchor registry. **This plan must not add or remove any body link.** Every link change in this plan happens inside `<aside data-supplementary>` or is an anchor-text-only change.
- **Anchor registry:** `config/anchor-registry.json` (gitignored) caps an anchor text at 3 site-wide uses — **body links only**. Aside links are exempt.
- **Breed page keyword targets (owner rule, 2026-07-17):** target `{breed} singapore`; secondary `{breed} price`, `{breed} for sale singapore`. Do not change any `const title`. Do not force exact-match phrasing into H1s.
- **Trailing slash:** all internal hrefs use the trailing-slash form (`/puppies/cavapoo/`).
- **Meta description hard cap: 175 characters.** The verification script fails the build above this.
- **48 breed pages** under `src/pages/puppies/*.astro`, excluding `index.astro`.
- **16 breeds are NOT HDB-approved:** beagle, border-collie, chow-chow, cocker-spaniel, corgi, english-bulldog, french-bulldog, german-shepherd, golden-retriever, goldendoodle, labradoodle, pomsky, samoyed, shiba-inu, siberian-husky, whippet. The other 32 are HDB-approved.
- **Commit style:** Conventional Commits. End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/check-price-cannibalisation.mjs` | **Create.** Parses `dist/` and asserts the three invariants. Run after every `npm run build`. |
| `src/data/breeds.ts` | **Create.** Per-breed display name, HDB-approval flag, typical-market note, and the `breedMetaDescription()` helper. Sits alongside `pricing.ts` and imports from it. |
| `src/pages/pricing.astro` | **Modify.** Delete the local `breedDisplayNames` and `breedMarketNotes` maps (lines 35-93) and import from `breeds.ts`. Delete the 5 breed-specific FAQ entries (lines 158-182). |
| `src/pages/puppies/*.astro` (48 files) | **Modify.** Replace the hand-written `const description` with a `breedMetaDescription()` call. Add the market-comparison line to the `#price` section where a market note exists. |
| `scripts/codemod-breed-descriptions.mjs` | **Create, then delete in Task 4.** One-shot codemod that rewrites the 48 descriptions mechanically. |

---

### Task 1: Verification script (the failing test)

**Files:**
- Create: `scripts/check-price-cannibalisation.mjs`

**Interfaces:**
- Consumes: nothing (reads `dist/` and `src/data/pricing.ts`)
- Produces: `node scripts/check-price-cannibalisation.mjs` exits 0 on pass, 1 on failure, printing one line per violation. Later tasks re-run this exact command.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-price-cannibalisation.mjs`:

```js
// Guards against /pricing/ cannibalising the 48 breed pages for {breed} price queries.
// Run after `npm run build`. Exits 1 on any violation.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { breedPricing, fmtPrice } from '../src/data/pricing.ts';

const DIST = path.resolve('dist');
const MAX_DESC = 175;
const failures = [];

function fail(msg) {
  failures.push(msg);
}

// Pull every JSON-LD block out of an HTML string.
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      fail('Unparseable JSON-LD block found');
    }
  }
  return out;
}

// Flatten @graph / arrays into a list of nodes.
function nodes(blocks) {
  const out = [];
  for (const b of blocks) {
    const items = Array.isArray(b) ? b : [b];
    for (const item of items) {
      if (item && Array.isArray(item['@graph'])) out.push(...item['@graph']);
      else if (item) out.push(item);
    }
  }
  return out;
}

// Every "How much does a X cost in Singapore?" question in a page's FAQPage schema.
function faqQuestions(html) {
  return nodes(jsonLdBlocks(html))
    .filter((n) => n['@type'] === 'FAQPage')
    .flatMap((n) => (Array.isArray(n.mainEntity) ? n.mainEntity : []))
    .map((q) => String(q.name ?? '').trim())
    .filter(Boolean);
}

function metaDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? m[1] : null;
}

// Decode the handful of HTML entities Astro emits inside attribute values.
function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const PRICE_Q = /^How much does an? (.+) cost in Singapore\?$/;

async function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ not found. Run `npm run build` first.');
    process.exit(1);
  }

  const slugs = Object.keys(breedPricing);

  // --- Invariant A: a breed price question appears on exactly one page ---
  const askedBy = new Map(); // question -> [urls]

  const pricingHtml = await readFile(path.join(DIST, 'pricing', 'index.html'), 'utf8');
  for (const q of faqQuestions(pricingHtml)) {
    if (PRICE_Q.test(q)) {
      askedBy.set(q, [...(askedBy.get(q) ?? []), '/pricing/']);
    }
  }

  for (const slug of slugs) {
    const file = path.join(DIST, 'puppies', slug, 'index.html');
    if (!existsSync(file)) {
      fail(`Missing built page: /puppies/${slug}/`);
      continue;
    }
    const html = await readFile(file, 'utf8');
    for (const q of faqQuestions(html)) {
      if (PRICE_Q.test(q)) {
        askedBy.set(q, [...(askedBy.get(q) ?? []), `/puppies/${slug}/`]);
      }
    }
  }

  for (const [q, urls] of askedBy) {
    if (urls.length > 1) {
      fail(`Duplicate breed-price FAQ "${q}" on: ${urls.join(', ')}`);
    }
  }

  // --- Invariant B + C: every breed page's meta description carries its own
  // live price range and stays under the length cap ---
  for (const slug of slugs) {
    const file = path.join(DIST, 'puppies', slug, 'index.html');
    if (!existsSync(file)) continue;
    const html = await readFile(file, 'utf8');
    const raw = metaDescription(html);
    if (!raw) {
      fail(`/puppies/${slug}/ has no meta description`);
      continue;
    }
    const desc = decode(raw);
    const { low, high } = breedPricing[slug];
    const wantLow = `$${fmtPrice(low)}`;
    const wantHigh = `$${fmtPrice(high)}`;
    if (!desc.includes(wantLow) || !desc.includes(wantHigh)) {
      fail(`/puppies/${slug}/ description missing live range ${wantLow} to ${wantHigh}: "${desc}"`);
    }
    if (desc.length > MAX_DESC) {
      fail(`/puppies/${slug}/ description is ${desc.length} chars (cap ${MAX_DESC}): "${desc}"`);
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} violation(s):\n`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`✓ price-cannibalisation checks passed (${slugs.length} breed pages)`);
}

main();
```

- [ ] **Step 2: Add the npm script and the TS-import loader flag**

The script imports a `.ts` module. Node 22.12 can strip types natively with `--experimental-strip-types`. Add to `package.json` `scripts`:

```json
"check:cannibalisation": "node --experimental-strip-types scripts/check-price-cannibalisation.mjs"
```

- [ ] **Step 3: Run it to verify it fails**

Run:

```bash
npm run build && npm run check:cannibalisation
```

Expected: build succeeds, checker exits 1 with roughly this shape —

```
5 violation(s):

  ✗ Duplicate breed-price FAQ "How much does a Cavapoo cost in Singapore?" on: /pricing/, /puppies/cavapoo/
  ✗ Duplicate breed-price FAQ "How much does a Bichon Frise cost in Singapore?" on: /pricing/, /puppies/bichon-frise/
  ✗ Duplicate breed-price FAQ "How much does a Chihuahua cost in Singapore?" on: /pricing/, /puppies/chihuahua/
  ✗ Duplicate breed-price FAQ "How much does a Corgi cost in Singapore?" on: /pricing/, /puppies/corgi/
  ✗ Duplicate breed-price FAQ "How much does a Cockapoo cost in Singapore?" on: /pricing/, /puppies/cockapoo/
```

plus ~44 `description missing live range` violations.

If the duplicate-FAQ count is **not** 5, stop and re-read `src/pages/pricing.astro` `faqItems` — the plan assumes exactly the five breed questions at lines 158-182.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-price-cannibalisation.mjs package.json
git commit -m "test: add price-cannibalisation invariant checker

Asserts each breed-price FAQ question appears on exactly one URL and
every breed page's meta description carries its own live price range.
Currently failing: 5 duplicate FAQs, 44 stale descriptions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared breed data module

**Files:**
- Create: `src/data/breeds.ts`
- Modify: `src/pages/pricing.astro:32-106` (imports and the two local maps)

**Interfaces:**
- Consumes: `breedPricing`, `fmtPrice`, `BreedSlug` from `src/data/pricing.ts`
- Produces:
  - `breedDisplayName: Record<BreedSlug, string>`
  - `breedHdbApproved: Record<BreedSlug, boolean>`
  - `breedMarketNote: Partial<Record<BreedSlug, string>>`
  - `monthStamp(): string` → e.g. `"July 2026"`
  - `breedMetaDescription(slug: BreedSlug, tail: string): string`

  Task 4 and Task 5 call `breedMetaDescription` and `breedMarketNote`.

- [ ] **Step 1: Create the module**

Create `src/data/breeds.ts`:

```ts
// Per-breed facts that more than one page needs. Prices live in ./pricing.ts —
// this module never restates a number that exists there.
import { breedPricing, fmtPrice, type BreedSlug } from './pricing';

export const breedDisplayName: Record<BreedSlug, string> = {
  'cavapoo': 'Cavapoo',
  'maltipoo': 'Maltipoo',
  'maltese': 'Maltese',
  'mini-dachshund': 'Mini Dachshund',
  'cockapoo': 'Cockapoo',
  'bichonpoo': 'Bichonpoo',
  'bichon-frise': 'Bichon Frise',
  'cavapoochon': 'Cavapoochon',
  'chihuahua': 'Chihuahua',
  'cavachon': 'Cavachon',
  'havanese': 'Havanese',
  'coton-de-tulear': 'Coton de Tulear',
  'shihpoo': 'Shihpoo',
  'toy-poodle': 'Toy Poodle',
  'pomeranian': 'Pomeranian',
  'japanese-spitz': 'Japanese Spitz',
  'shih-tzu': 'Shih Tzu',
  'pug': 'Pug',
  'yorkshire-terrier': 'Yorkshire Terrier',
  'silky-terrier': 'Silky Terrier',
  'miniature-schnauzer': 'Miniature Schnauzer',
  'miniature-pinscher': 'Miniature Pinscher',
  'papillon': 'Papillon',
  'pekingese': 'Pekingese',
  'japanese-chin': 'Japanese Chin',
  'cavalier-king-charles-spaniel': 'Cavalier King Charles Spaniel',
  'jack-russell-terrier': 'Jack Russell Terrier',
  'westie': 'Westie',
  'scottish-terrier': 'Scottish Terrier',
  'boston-terrier': 'Boston Terrier',
  'italian-greyhound': 'Italian Greyhound',
  'sheltie': 'Sheltie',
  'corgi': 'Corgi',
  'shiba-inu': 'Shiba Inu',
  'french-bulldog': 'French Bulldog',
  'golden-retriever': 'Golden Retriever',
  'samoyed': 'Samoyed',
  'chow-chow': 'Chow Chow',
  'siberian-husky': 'Siberian Husky',
  'border-collie': 'Border Collie',
  'pomsky': 'Pomsky',
  'beagle': 'Beagle',
  'cocker-spaniel': 'Cocker Spaniel',
  'english-bulldog': 'English Bulldog',
  'german-shepherd': 'German Shepherd',
  'goldendoodle': 'Goldendoodle',
  'labradoodle': 'Labradoodle',
  'whippet': 'Whippet',
};

// HDB's approved-breed list. False = private housing only; every page for a
// false breed already says so in body copy, and the meta description must match.
const NOT_HDB_APPROVED: readonly BreedSlug[] = [
  'beagle',
  'border-collie',
  'chow-chow',
  'cocker-spaniel',
  'corgi',
  'english-bulldog',
  'french-bulldog',
  'german-shepherd',
  'golden-retriever',
  'goldendoodle',
  'labradoodle',
  'pomsky',
  'samoyed',
  'shiba-inu',
  'siberian-husky',
  'whippet',
];

export const breedHdbApproved: Record<BreedSlug, boolean> = Object.fromEntries(
  (Object.keys(breedPricing) as BreedSlug[]).map((slug) => [slug, !NOT_HDB_APPROVED.includes(slug)]),
) as Record<BreedSlug, boolean>;

// What the same breed commonly costs elsewhere in Singapore. Only breeds with a
// figure we can stand behind get an entry; the rest fall back to enquiry-only copy.
export const breedMarketNote: Partial<Record<BreedSlug, string>> = {
  'cavapoo': '$4,300 to $6,500',
  'maltipoo': '$5,000 to $9,000',
  'maltese': 'Commonly $2,500 to $6,000',
  'corgi': 'Commonly $7,880 to $8,500',
  'bichon-frise': 'Commonly $3,000 to $7,000',
  'chihuahua': 'Commonly $2,500 to $6,000',
};

export const MARKET_NOTE_FALLBACK = 'Enquiry-only at most shops';

// "July 2026" — build-time freshness stamp. The daily automation deploy keeps
// it current, which is why it is computed rather than written down.
export function monthStamp(): string {
  return new Date().toLocaleString('en-SG', { month: 'long', year: 'numeric' });
}

// The one meta-description shape for every breed page: price first (that is what
// the page-1 SERP winners lead with), then licence + housing, then the breed's
// own differentiator. `tail` is the hand-written clause carried over per page.
// Keep the whole string under 175 chars — scripts/check-price-cannibalisation.mjs
// fails the build otherwise.
export function breedMetaDescription(slug: BreedSlug, tail: string): string {
  const { low, high } = breedPricing[slug];
  const name = breedDisplayName[slug];
  const housing = breedHdbApproved[slug] ? 'AVS licensed and HDB-approved' : 'AVS licensed, private housing only';
  return `${name} price in Singapore (${monthStamp()}): $${fmtPrice(low)} to $${fmtPrice(high)} all-in at Curious Tails, ${housing}. ${tail}`;
}
```

- [ ] **Step 2: Point `pricing.astro` at the shared module**

In `src/pages/pricing.astro`, replace the import block at line 32:

```ts
import { OVERALL_LOW, OVERALL_HIGH, breedPricing, fmtPrice, type BreedSlug } from '../data/pricing';
```

with:

```ts
import { OVERALL_LOW, OVERALL_HIGH, breedPricing, fmtPrice, type BreedSlug } from '../data/pricing';
import { breedDisplayName, breedMarketNote, MARKET_NOTE_FALLBACK } from '../data/breeds';
```

Then delete the two local maps entirely — `const breedDisplayNames: Record<BreedSlug, string> = { ... };` (lines 35-84) and `const breedMarketNotes: Partial<Record<BreedSlug, string>> = { ... };` (lines 86-93) — and rewrite `sortableBreedRows` (lines 95-106) to:

```ts
const sortableBreedRows = (Object.keys(breedPricing) as BreedSlug[])
  .sort((a, b) => breedDisplayName[a].localeCompare(breedDisplayName[b]))
  .map((slug) => {
    const { low, high } = breedPricing[slug];
    const market = breedMarketNote[slug] ?? MARKET_NOTE_FALLBACK;
    return {
      label: breedDisplayName[slug],
      href: `/puppies/${slug}/`,
      cells: [`$${fmtPrice(low)} to $${fmtPrice(high)} all-in`, market],
      sort: [breedDisplayName[slug], low, market],
    };
  });
```

- [ ] **Step 3: Build and confirm the pricing table is unchanged**

Run:

```bash
npm run build
```

Expected: build succeeds, 71+ pages. This step is a pure refactor — the rendered `/pricing/` table must be byte-identical. Verify:

```bash
node -e "const h=require('fs').readFileSync('dist/pricing/index.html','utf8');const n=(h.match(/\/puppies\/[a-z-]+\//g)||[]).length;console.log('breed links on /pricing/:',n)"
```

Expected: a count of at least 48 (48 table rows plus the 5 prose links).

- [ ] **Step 4: Confirm the checker still fails the same way**

Run:

```bash
npm run check:cannibalisation
```

Expected: still exits 1, still 5 duplicate-FAQ violations plus ~44 description violations. Nothing should have been fixed yet — this task only moved data.

- [ ] **Step 5: Commit**

```bash
git add src/data/breeds.ts src/pages/pricing.astro
git commit -m "refactor: extract shared breed data into src/data/breeds.ts

Display names, HDB approval, and typical-market notes move out of
pricing.astro so breed pages can use the same source. Adds
breedMetaDescription() for the price-led description format.
No rendered output change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove the duplicate breed-price FAQs from /pricing/

**Files:**
- Modify: `src/pages/pricing.astro:158-182` (five `faqItems` entries)

**Interfaces:**
- Consumes: nothing new
- Produces: `/pricing/`'s `FAQPage` schema contains zero `How much does a {Breed} cost in Singapore?` questions. Those questions remain, unchanged, on the five breed pages.

**Why:** `/pricing/` and `/puppies/cavapoo/` both emit `FAQPage` schema answering "How much does a Cavapoo cost in Singapore?" with near-identical text. Google picks one URL for that question and it picks `/pricing/`, which is linked from 49 files site-wide. Deleting the question from `/pricing/` leaves the breed page as the only candidate.

- [ ] **Step 1: Delete the five breed-specific entries**

In `src/pages/pricing.astro`, delete these five objects from the `faqItems` array — the Cavapoo entry (lines 158-162), Bichon Frise (163-167), Chihuahua (168-172), Corgi (173-177), and Cockapoo (178-182). Each begins `{ question: 'How much does a {Breed} cost in Singapore?',`.

Leave every other entry untouched, including the general `'How much does a puppy cost at Curious Tails?'` entry at lines 123-127 — that one is `/pricing/`'s own head question and must stay.

- [ ] **Step 2: Add two breed-agnostic replacements**

`/pricing/` loses five FAQ entries; give it back questions only a pricing page should own. Append these two objects to the end of the `faqItems` array, after the adoption entry:

```ts
  {
    question: 'Why does the same breed cost different amounts at different shops?',
    answer:
      'Four things move the number: how many litters of that breed are available locally against how many families want one, adult size, coat type and colour, and age at sale. The fifth is what listings never show — the cost of selling a puppy legally, which covers AVS licensing, proper housing, vet checks, vaccinations, and microchipping. A price far below the market usually means a seller who skipped those steps.',
  },
  {
    question: 'Where can I see the price for one specific breed?',
    answer:
      'Every breed we carry has its own page with that breed\u2019s published all-in range, what the same breed typically costs elsewhere in Singapore, and the housing rules that apply to it. Use the price guide table above to jump straight to the breed you are considering, or browse all 40+ breeds.',
  },
```

- [ ] **Step 3: Rebuild and run the checker**

Run:

```bash
npm run build && npm run check:cannibalisation
```

Expected: the five `Duplicate breed-price FAQ` lines are **gone**. The ~44 `description missing live range` violations remain — Task 4 fixes those. Exit code is still 1.

- [ ] **Step 4: Confirm the breed pages kept their questions**

Run:

```bash
node -e "for(const s of ['cavapoo','bichon-frise','chihuahua','corgi','cockapoo']){const h=require('fs').readFileSync(\`dist/puppies/\${s}/index.html\`,'utf8');console.log(s, /How much does an? .+ cost in Singapore/.test(h))}"
```

Expected: all five print `true`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/pricing.astro
git commit -m "fix(seo): drop duplicate breed-price FAQs from /pricing/

/pricing/ and five breed pages emitted FAQPage schema answering the
same 'How much does a {Breed} cost in Singapore?' question. /pricing/
won that query because it is linked from 49 files; the breed page is
the correct answer. Replaced with two pricing-page-specific questions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Price-led meta descriptions on all 48 breed pages

**Files:**
- Create: `scripts/codemod-breed-descriptions.mjs` (deleted at the end of this task)
- Modify: all 48 files in `src/pages/puppies/*.astro` except `index.astro`

**Interfaces:**
- Consumes: `breedMetaDescription` from `src/data/breeds.ts` (Task 2)
- Produces: every breed page's `const description` is a single `breedMetaDescription(slug, tail)` call. No breed page hardcodes a dollar figure in its description.

**Why:** 44 of 48 descriptions hardcode `from $4,288`-style figures that can silently drift from `src/data/pricing.ts`, and they lead with "puppies for sale in Singapore" instead of the price. The page-1 winners for `cavapoo singapore` lead their snippets with either a price range (prettypetskennel: "typically ranges from $4,300 to $6,500") or the housing rule (wagatail: "HDB approved and apartment friendly"). The 4 already-templated pages (cavapoo, maltipoo, corgi, mini-dachshund) are the target format.

- [ ] **Step 1: Write the codemod**

Create `scripts/codemod-breed-descriptions.mjs`:

```js
// One-shot: rewrite each breed page's `const description` into a
// breedMetaDescription(slug, tail) call, preserving the hand-written tail.
// Delete this file once it has run and the result is committed.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('src/pages/puppies');

// Strip the generated lead so only the breed's own differentiator remains.
// Handles both existing shapes:
//   "Cavapoo price in Singapore (July 2026): $A to $B all-in at Curious Tails, AVS licensed and HDB-approved. TAIL"
//   "Chihuahua puppies for sale in Singapore from $4,288, AVS licensed and HDB-approved. TAIL"
function extractTail(desc) {
  const templated = desc.match(/all-in at Curious Tails,[^.]*\.\s*(.*)$/s);
  if (templated) return templated[1].trim();
  const hardcoded = desc.match(/^.*?\$[\d,]+(?:\s+all-in)?,?\s*(?:AVS licensed[^.]*)?\.\s*(.*)$/s);
  if (hardcoded && hardcoded[1]) return hardcoded[1].trim();
  return null;
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.astro') && f !== 'index.astro');
const report = [];

for (const file of files) {
  const slug = file.replace(/\.astro$/, '');
  const full = path.join(DIR, file);
  let src = await readFile(full, 'utf8');

  // Match `const description =` through the terminating semicolon.
  const m = src.match(/const description =\s*([\s\S]*?);\n/);
  if (!m) {
    report.push([slug, 'SKIP', 'no description found']);
    continue;
  }

  // Evaluate the literal to a plain string. Template literals here only ever
  // interpolate monthStamp/fmtPrice, so strip those to their rendered shape.
  const literal = m[1]
    .replace(/\$\{monthStamp\}/g, 'MONTH')
    .replace(/\$\{fmtPrice\(price\.low\)\}/g, 'LOW')
    .replace(/\$\{fmtPrice\(price\.high\)\}/g, 'HIGH');
  let value;
  try {
    value = eval(literal); // literal is from our own source tree
  } catch {
    report.push([slug, 'SKIP', 'literal did not evaluate']);
    continue;
  }

  const tail = extractTail(value);
  if (!tail) {
    report.push([slug, 'MANUAL', value]);
    continue;
  }

  const escaped = tail.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  src = src.replace(m[0], `const description = breedMetaDescription('${slug}', '${escaped}');\n`);

  // Ensure the import exists.
  if (!src.includes("from '../../data/breeds'")) {
    src = src.replace(
      /import \{ breedPricing, fmtPrice \} from '\.\.\/\.\.\/data\/pricing';/,
      "import { breedPricing, fmtPrice } from '../../data/pricing';\nimport { breedMetaDescription } from '../../data/breeds';",
    );
  }

  await writeFile(full, src, 'utf8');
  report.push([slug, 'OK', tail]);
}

for (const [slug, status, note] of report) {
  console.log(`${status.padEnd(7)} ${slug.padEnd(32)} ${note}`);
}
console.log(`\n${report.filter((r) => r[1] === 'OK').length}/${files.length} rewritten`);
```

- [ ] **Step 2: Run the codemod**

Run:

```bash
node scripts/codemod-breed-descriptions.mjs
```

Expected: mostly `OK` lines. Any `MANUAL` or `SKIP` line is a page whose description did not match either shape — edit those by hand in Step 4.

- [ ] **Step 3: Verify the import landed on every page**

Run:

```bash
cd "D:/Claude Code/Curious Tails" && grep -L "breedMetaDescription" src/pages/puppies/*.astro | grep -v index
```

Expected: no output. Any file listed still needs the import and the call added by hand:

```ts
import { breedMetaDescription } from '../../data/breeds';
```

- [ ] **Step 4: Build, then trim every description over the cap**

Run:

```bash
npm run build && npm run check:cannibalisation
```

The `description missing live range` violations should all be gone. What remains is a list of `description is N chars (cap 175)` failures — the generated lead is longer than the old hardcoded one, so long tails now overflow.

For each failing page, shorten **only the tail argument** until the total fits. The lead is fixed and must not be edited. Worked examples:

`src/pages/puppies/chihuahua.astro` — tail was `Real prices, temperament, coat types and the $500+ starter kit included. WhatsApp us.` → change to:

```ts
const description = breedMetaDescription('chihuahua', 'Coat types, temperament and the $500+ starter kit included.');
```

`src/pages/puppies/pug.astro` — tail was `Real prices, temperament, heat care for flat faces and the $500+ starter kit included.` → change to:

```ts
const description = breedMetaDescription('pug', 'Heat care for flat faces, plus the $500+ starter kit.');
```

`src/pages/puppies/westie.astro` — tail was `Real prices, temperament, skin care honesty and the $500+ starter kit.` → change to:

```ts
const description = breedMetaDescription('westie', 'Skin-care honesty and the $500+ starter kit included.');
```

`src/pages/puppies/samoyed.astro` — the housing clause is now generated, so drop the duplicate from the tail. Tail was `Honest part first: Samoyeds are not HDB-approved, and the Arctic coat is real work here. Private housing? We match you.` → change to:

```ts
const description = breedMetaDescription('samoyed', 'The Arctic coat is real work in this climate. We match you honestly.');
```

`src/pages/puppies/golden-retriever.astro` — same duplicate-housing trim. Change to:

```ts
const description = breedMetaDescription('golden-retriever', 'Exercise reality, heat care, and the $500+ starter kit.');
```

Apply the same two rules to every remaining failure: **(a)** delete any "not HDB-approved" / "AVS licensed" phrasing from the tail, because the lead now says it, and **(b)** cut filler like "Real prices, temperament," keeping the breed's genuine differentiator.

Re-run `npm run build && npm run check:cannibalisation` after each batch until it exits 0.

- [ ] **Step 5: Delete the codemod**

Run:

```bash
rm scripts/codemod-breed-descriptions.mjs
```

- [ ] **Step 6: Confirm a clean pass**

Run:

```bash
npm run build && npm run check:cannibalisation
```

Expected:

```
✓ price-cannibalisation checks passed (48 breed pages)
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/puppies/ package.json
git commit -m "fix(seo): price-led, derived meta descriptions on all 48 breed pages

44 pages hardcoded a dollar figure that could drift from pricing.ts and
led with 'puppies for sale' rather than the price. All 48 now derive
from breedMetaDescription(), leading with the live range and the housing
rule — the shape the page-1 SERP winners use. All under 175 chars.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Give breed pages the market comparison /pricing/ has

**Files:**
- Modify: `src/pages/puppies/*.astro` — the six pages with a market note (cavapoo, maltipoo, maltese, corgi, bichon-frise, chihuahua), in the `id="price"` section
- Modify: `src/pages/puppies/*.astro` (48 files) — one anchor text in the `<aside data-supplementary>`

**Interfaces:**
- Consumes: `breedMarketNote` from `src/data/breeds.ts` (Task 2)
- Produces: no new exports. This is the last task; nothing depends on it.

**Why:** `/pricing/` currently holds strictly more breed-price information than any breed page — it publishes all 48 ranges *and* the typical-market figure for six breeds. As long as that is true, `/pricing/` is the better answer for a breed-price query. Surfacing the market note on the breed page removes the asymmetry. Separately, all 48 breed pages link to `/pricing/` with the anchor "Transparent pricing"; retargeting that anchor stops 48 price-flavoured internal links from voting for `/pricing/` on price queries. These links live in `<aside data-supplementary>`, so this is an anchor-text change only and does not touch the body-link contract.

- [ ] **Step 1: Add the market note to the six breed pages that have one**

In each of `cavapoo.astro`, `maltipoo.astro`, `maltese.astro`, `corgi.astro`, `bichon-frise.astro`, `chihuahua.astro`:

Add the import next to the existing pricing import:

```ts
import { breedMarketNote } from '../../data/breeds';
```

(In `cavapoo.astro` and `maltipoo.astro` this merges with the `breedMetaDescription` import added in Task 4: `import { breedMetaDescription, breedMarketNote } from '../../data/breeds';`)

Then, inside the `id="price"` block, in the prose `<div>` that follows `<ComparisonSplit ... />`, add this as the **first** paragraph. Exact text for `cavapoo.astro` (insert immediately after the opening `<p class="text-sm leading-relaxed text-[var(--color-cream-600)]">`'s parent div at line 316, before the existing "Why is the price lower?" paragraph):

```astro
      <p class="text-sm leading-relaxed text-[var(--color-cream-600)]">
        For reference, the typical Cavapoo price across Singapore shops is {breedMarketNote['cavapoo']}. Ours is {priceRange} all-in, and the gap is what we don't spend on advertising.
      </p>
```

Repeat for the other five, swapping the breed name and the slug key. `corgi.astro` uses `{breedMarketNote['corgi']}`, `bichon-frise.astro` uses `{breedMarketNote['bichon-frise']}`, and so on. Each page already defines `priceRange` in its frontmatter (see `src/pages/puppies/cavapoo.astro:52`); if a page does not, add it:

```ts
const priceRange = `$${fmtPrice(price.low)} to $${fmtPrice(price.high)}`;
```

- [ ] **Step 2: Retarget the supplementary anchor on all 48 pages**

Run:

```bash
cd "D:/Claude Code/Curious Tails" && sed -i 's|>Transparent pricing</a>|>What'"'"'s included in every price</a>|g' src/pages/puppies/*.astro
```

- [ ] **Step 3: Verify the anchor changed and nothing else moved**

Run:

```bash
cd "D:/Claude Code/Curious Tails" && echo "old anchor remaining:" && grep -c "Transparent pricing" src/pages/puppies/*.astro | grep -v ':0' | wc -l && echo "new anchor count:" && grep -l "What's included in every price" src/pages/puppies/*.astro | wc -l
```

Expected: `old anchor remaining: 0` and `new anchor count: 48`.

- [ ] **Step 4: Confirm the body-link contract is untouched**

Run:

```bash
cd "D:/Claude Code/Curious Tails" && git diff --stat src/pages/puppies/ && git diff src/pages/puppies/cavapoo.astro | grep '^[+-]' | grep 'href=' | sort | uniq -c
```

Expected: the only `href=` lines in the diff are the `/pricing/` aside link (one `-`, one `+`, same href, different anchor text). If any other `href` appears in the diff, revert and redo — the plan must not add or remove a body link.

- [ ] **Step 5: Build and run the full check**

Run:

```bash
npm run build && npm run check:cannibalisation
```

Expected: build succeeds, checker prints `✓ price-cannibalisation checks passed (48 breed pages)`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/puppies/
git commit -m "feat(seo): market comparison on breed pages, retarget pricing anchor

/pricing/ held strictly more breed-price info than any breed page,
including the typical-market figure for six breeds. Those six now carry
it themselves. The 48 supplementary links to /pricing/ move off the
'Transparent pricing' anchor so they stop voting for /pricing/ on breed
price queries. No body-link contract change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Ship and request recrawl

**Files:**
- None modified. This task deploys and submits.

**Interfaces:**
- Consumes: a green `npm run check:cannibalisation`
- Produces: nothing in code.

- [ ] **Step 1: Full clean build**

Run:

```bash
cd "D:/Claude Code/Curious Tails" && rm -rf dist && npm run build && npm run check:cannibalisation
```

Expected: build reports 71+ pages, checker exits 0.

- [ ] **Step 2: Confirm the sitemap still lists every breed page**

Run:

```bash
cd "D:/Claude Code/Curious Tails" && grep -o 'puppies/[a-z-]*/' dist/sitemap-0.xml | sort -u | wc -l
```

Expected: 49 (48 breeds plus the `/puppies/` hub).

- [ ] **Step 3: Push and let Cloudflare Pages deploy**

```bash
git push origin main
```

Wait for the Cloudflare Pages build to go green before continuing. If a dependency changed, regenerate the lock file with `npx npm@10.9.2 install` first — Cloudflare builds on npm 10.9.2.

- [ ] **Step 4: Verify production**

Run:

```bash
curl -sL https://curioustails.sg/puppies/chihuahua/ | grep -o '<meta name="description" content="[^"]*"'
```

Expected: a description beginning `Chihuahua price in Singapore (` with the live range.

- [ ] **Step 5: Resubmit the sitemap and request indexing**

Follow the standard indexing workflow: confirm each changed URL returns 200 on its canonical trailing-slash form, POST the changed URLs to IndexNow, resubmit `https://curioustails.sg/sitemap-index.xml` in GSC, then run `inspect_url_enhanced` on `/pricing/` and the six breed pages changed in Task 5 and report each `inspection_result_link` for the manual **Request Indexing** click.

- [ ] **Step 6: Record the baseline to measure against**

Note these current GSC figures so the effect is measurable in 4-6 weeks:

| Query | Position (28d to 2026-07-23) | Impressions |
|---|---|---|
| `maltipoo price` | 20.2 | 17 |
| `cavapoo price` | 9.9 | 12 |
| `cavapoo singapore` | 43.2 | 10 |
| `maltipoo singapore` | 46 | 8 |
| `corgi price singapore` | 46.9 | 7 |
| `chihuahua price` | 7.2 | 6 |
| `/pricing/` page | 20.2 (167 impressions, 3 clicks, 1.8% CTR over 6mo) | — |

**Success looks like:** breed pages replacing `/pricing/` as the ranking URL for `{breed} price` queries, and `{breed} singapore` positions improving from the 40s. **This will not, on its own, move the site to page 1** — the domain still has zero referring domains, which is the binding constraint. This task family is a relevance fix, not an authority fix.

---

## Self-Review

**Spec coverage.** The original recommendation had four clauses. Clause 1 ("move per-breed price blocks onto breed pages") and clause 3 ("point `{breed} price singapore` anchors at the breed page") were already implemented in the codebase before this plan — documented in *Corrections* above, no task needed. Clause 2 (stop `/pricing/` cannibalising) is Task 3 plus Task 5. Clause 4 ("page-1 winners lead with a price range or HDB approved; yours doesn't") is Task 4 — and was already true for 4 of 48 pages, now true for all 48.

**Type consistency.** `breedDisplayName` (singular) is the new export name; `pricing.astro`'s old local was `breedDisplayNames` (plural) and is deleted in Task 2 Step 2, with `sortableBreedRows` rewritten in the same step. `breedMarketNote` (singular) likewise replaces the local `breedMarketNotes`. `breedMetaDescription(slug, tail)` takes two arguments everywhere — the codemod in Task 4 emits exactly that shape, and Task 5 does not change the signature. `MARKET_NOTE_FALLBACK` is exported in Task 2 Step 1 and consumed in Task 2 Step 2.

**Known risk.** Task 4's codemod uses `eval` on a string taken from the project's own source tree. That is acceptable here because the input is version-controlled code the engineer just read, and the script is deleted in Step 5 of the same task. Do not generalise it or keep it around.
