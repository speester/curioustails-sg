// kit:page-updated@1.0.0 - dates derive from revision history, never from a literal.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cacheUpdated = new Map<string, string>();
const cachePublished = new Map<string, string>();

function git(argv: string[]): string | null {
  try {
    return execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last revision date (YYYY-MM-DD) of a page file. Falls back to mtime outside a repo. */
export function updatedFor(pageFile: string): string {
  const file = path.relative(process.cwd(), pageFile).replace(/\\/g, '/');
  if (cacheUpdated.has(file)) return cacheUpdated.get(file)!;
  let d = git(['log', '-1', '--format=%cs', '--', file]);
  if (!d && fs.existsSync(pageFile)) d = toIsoDate(fs.statSync(pageFile).mtime);
  if (!d) d = toIsoDate(new Date());
  cacheUpdated.set(file, d);
  return d;
}

/** First commit date (YYYY-MM-DD) of a page file; falls back to the ledger's copy_date, then to updatedFor. */
export function publishedFor(pageFile: string): string {
  const file = path.relative(process.cwd(), pageFile).replace(/\\/g, '/');
  if (cachePublished.has(file)) return cachePublished.get(file)!;
  let d = git(['log', '--diff-filter=A', '--follow', '--format=%cs', '-1', '--', file]);
  if (!d) d = ledgerCopyDate(file);
  if (!d) d = updatedFor(pageFile);
  cachePublished.set(file, d);
  return d;
}

function ledgerCopyDate(file: string): string | null {
  const ledger = path.join('config', 'pipeline-ledger.csv');
  if (!fs.existsSync(ledger)) return null;
  const slug = path.basename(file).replace(/\.astro$/, '');
  const rows = fs.readFileSync(ledger, 'utf8').trim().split(/\r?\n/);
  const head = rows[0].split(',').map((h) => h.trim());
  const iSlug = head.indexOf('slug');
  const iDate = head.indexOf('copy_date');
  if (iSlug === -1 || iDate === -1) return null;
  for (const r of rows.slice(1)) {
    const c = r.split(',');
    if ((c[iSlug] || '').trim() === slug) {
      const v = (c[iDate] || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    }
  }
  return null;
}

/** Sitemap `serialize` hook helper: map a built URL back to its page file's revision date. */
export function lastModFor(url: string): string {
  let p: string;
  try { p = new URL(url).pathname; } catch { p = url; }
  const slug = p.replace(/^\/+|\/+$/g, '');
  const candidates = slug
    ? [`src/pages/${slug}.astro`, `src/pages/${slug}/index.astro`]
    : ['src/pages/index.astro'];
  for (const c of candidates) if (fs.existsSync(c)) return updatedFor(c);
  return toIsoDate(new Date());
}
