// Alerts for the scheduled imports run (T25, spec §6.8).
//
// A Windows toast is not an alert: it is gone before an unattended machine's
// owner looks at it. This module writes two files that survive until a human
// reads them — logs/imports/NEEDS-ATTENTION.md and a root NEEDS-ATTENTION.md
// pointer — and posts to a board only when BOARD_TOKEN is actually present.
//
// Everything written here is counts and reason codes. The pipeline's
// sanitiseLogLine strips URLs, emails, phones and 15-digit microchips before a
// line reaches a log or an alert.
import fs from 'node:fs';
import path from 'node:path';
import { sanitiseLogLine } from './pipeline.mjs';
import { LEAD_ONLY_SUPPLIERS, OWNER_WAIVABLE_GATES } from './gates.mjs';

export const NEEDS_ATTENTION = 'NEEDS-ATTENTION.md';
export const RUN_RECORD = 'last-run.json';
export const REVIEW_BACKLOG_COUNT = 20;
export const REVIEW_BACKLOG_AGE_MS = 72 * 3600 * 1000;

const iso = (d) => new Date(d).toISOString();
const relative = (root, file) => path.relative(root, file).replace(/\\/g, '/');

/** 2026-11-14 06:15 SGT — the owner's clock, not the log's UTC date. */
export function sgtLabel(date) {
  try {
    return new Intl.DateTimeFormat('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(date)) + ' SGT';
  } catch {
    return iso(date);
  }
}

/**
 * Hard failures are the ones the scheduled run must not swallow:
 *   * a source host blocked mid-run (spec §6.4: stop, alert, never retry)
 *   * a feed photo missing from src/assets/imported (a broken card, G6)
 *   * any thrown pipeline error (feed schema/leak, busy lock, store)
 * A source that merely errored is a soft alert: one bad day is noise, and the
 * next run proves whether it is a block.
 */
export function hardFailures(summary) {
  const out = [];
  for (const e of summary?.errors || []) {
    const blocked = e.blocked || (e.stage === 'http' && /^blocked/i.test(String(e.code || '')));
    if (blocked) {
      out.push({ code: 'source-blocked', message: `${e.source || e.host || 'source'} blocked (${e.code || 'blocked'})` });
    } else if (e.stage === 'assets' && e.code === 'missing-photo') {
      out.push({ code: 'missing-photo', message: `${e.count || 'some'} published photo(s) missing from src/assets/imported` });
    }
  }
  return out;
}

/** True for any error row that hardFailures() already owns. */
function isHardError(e) {
  return !!(e?.blocked || (e?.stage === 'http' && /^blocked/i.test(String(e?.code || '')))
    || (e?.stage === 'assets' && e?.code === 'missing-photo'));
}

/** A queue item from a source that forbids republishing (gates.mjs D3/D4). */
export function isLeadOnlyItem(q) {
  if (typeof q?.leadOnly === 'boolean') return q.leadOnly;
  return LEAD_ONLY_SUPPLIERS.has(q?.source?.supplier);
}

/**
 * splitQueue(queue) — the queue by what the owner can do with it (K-139).
 *   autoReady    passed every gate; one approve publishes it
 *   review       publishable source, at least one gate needs the owner
 *     needsEdit  of those, a gate the owner cannot waive (data must change)
 *   leadOnly     lead-only source: reject or keep as a breeder lead, never publish
 *   publishable  autoReady + review — the only number the backlog alert reads
 * The three top-level counts never overlap. Publishability itself is decided
 * by gates.mjs / owner.mjs; this only reads the flags they leave on the item.
 */
export function splitQueue(queue = []) {
  const items = (queue || []).filter((q) => q && (q.disposition === 'auto-ready' || q.disposition === 'review'));
  const leads = items.filter(isLeadOnlyItem);
  const publishableItems = items.filter((q) => !isLeadOnlyItem(q));
  const autoReady = publishableItems.filter((q) => q.disposition === 'auto-ready');
  const review = publishableItems.filter((q) => q.disposition === 'review');
  const needsEdit = review.filter((q) => (q.failures || []).some((f) => f?.severity === 'reject' || !OWNER_WAIVABLE_GATES.has(f?.gate)));
  return {
    autoReady: autoReady.length,
    review: review.length,
    needsEdit: needsEdit.length,
    leadOnly: leads.length,
    publishable: publishableItems.length,
    publishableItems,
  };
}

/**
 * classifyRun({ summary, queue, error, startedAt })
 *   hard  → exit non-zero and write NEEDS-ATTENTION
 *   soft  → write NEEDS-ATTENTION, exit zero (owner action, not a broken run)
 */
export function classifyRun({ summary = null, queue = [], error = null, startedAt = new Date() } = {}) {
  const hard = [];
  const soft = [];

  if (error) {
    hard.push({ code: error.code || 'run-failed', message: error.message || String(error) });
  }

  if (summary) {
    hard.push(...hardFailures(summary));

    for (const e of summary.errors || []) {
      if (isHardError(e)) continue;
      if (e.stage === 'http') {
        soft.push({ code: 'source-error', message: `${e.source || e.host || 'source'} error (${e.code || 'error'})` });
      } else if (e.stage === 'adapter') {
        soft.push({ code: 'adapter-error', message: `${e.source || 'source'} adapter failed (${e.code || 'error'})` });
      } else {
        soft.push({ code: e.stage || 'pipeline', message: `${e.stage || 'pipeline'}: ${e.code || 'error'}` });
      }
    }

    // K-139: only publishable work counts. Lead-only records (dfsi,
    // puppies.ie) can never be approved, so they are leads, not backlog: they
    // never trigger either backlog alert, however many accumulate.
    const split = splitQueue(queue);
    if (split.publishable > REVIEW_BACKLOG_COUNT) {
      soft.push({
        code: 'review-backlog',
        message: `${split.publishable} publishable items are waiting for the owner (limit ${REVIEW_BACKLOG_COUNT}); ${split.leadOnly} lead-only not counted`,
      });
    }
    const oldest = split.publishableItems
      .map((q) => Date.parse(q?.firstFailedAt))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    if (Number.isFinite(oldest) && new Date(startedAt).getTime() - oldest > REVIEW_BACKLOG_AGE_MS) {
      soft.push({ code: 'review-backlog-age', message: 'the oldest publishable item has waited more than 72 hours' });
    }
  }

  const reasons = [...hard, ...soft];
  return {
    hard,
    soft,
    reasons,
    failed: hard.length > 0,
    status: hard.length ? 'failed' : reasons.length ? 'attention' : 'ok',
  };
}

function boardLine(board) {
  if (!board) return '- Board: not attempted';
  if (board.posted) return '- Board: posted';
  if (board.skipped === 'no-board-token') return '- Board: not posted (no BOARD_TOKEN)';
  if (board.skipped === 'no-board-url') return '- Board: not posted (BOARD_TOKEN set but BOARD_URL missing)';
  return `- Board: not posted (${sanitiseLogLine(board.error || 'unknown error')})`;
}

export function alertMarkdown({
  status, startedAt, reasons = [], summary = null, queue = [], logPath, logRel = null, board = null,
}) {
  const logLabel = logRel || (logPath ? relative(process.cwd(), logPath) : 'logs/imports/<date>.log');
  const counts = summary
    ? [
        `discovered=${summary.discovered} records=${summary.records} groups=${summary.groups}`,
        `gates pass=${summary.gates?.pass ?? 0} review=${summary.gates?.review ?? 0} reject=${summary.gates?.reject ?? 0} auto-ready=${summary.gates?.['auto-ready'] ?? 0} publish=${summary.gates?.publish ?? 0}`,
        `feedPups=${summary.feedPups} published=${summary.published} unpublished=${summary.unpublished}`,
      ].join(' · ')
    : 'pipeline did not produce a summary';
  const split = splitQueue(queue);
  const lines = [
    `# NEEDS-ATTENTION — imports ${status === 'failed' ? 'failed' : 'needs owner input'}`,
    '',
    `- Run: ${iso(startedAt)} (${sgtLabel(startedAt)})`,
    '- Task: Curious Tails Imports Sync',
    '- Command: node scripts/imports/run-daily.mjs',
    `- Status: ${status.toUpperCase()}${status === 'failed' ? ' (exit 1)' : ' (exit 0)'}`,
    `- Log: ${logLabel}`,
    '- Autopublish: ON for gate-passing items (owner decision 2026-11-18; IMPORTS_DAILY_AUTOPUBLISH=0 turns it off)',
    boardLine(board),
    '',
    '## Why',
    ...reasons.map((r) => `- **${r.code}**: ${sanitiseLogLine(r.message)}`),
    '',
    '## Queue',
    `- publishable: ${split.publishable} (the backlog alert counts only these; limit ${REVIEW_BACKLOG_COUNT})`,
    `  - auto-ready: ${split.autoReady} (waiting for the owner to approve)`,
    `  - review: ${split.review} (${split.needsEdit} need an edit before they can be approved)`,
    `- lead-only: ${split.leadOnly} (breeder leads from sources that forbid republishing; kept, never published, never alerted on)`,
    `- ${counts}`,
    '',
    '## What to do',
    '1. Open the log above; it holds counts only, never seller or source data.',
    '2. Fix the cause, then re-run `npm run sync:imports`.',
    '3. A blocked source is not retried or bypassed. Leave it blocked and check it the next day.',
    '4. Delete `logs/imports/NEEDS-ATTENTION.md` and `NEEDS-ATTENTION.md` once you have read them.',
    '',
  ];
  return lines.join('\n');
}

export function pointerMarkdown({ status, startedAt, reasons = [], logPath, detailsRel = null, logRel = null }) {
  return [
    '# NEEDS-ATTENTION',
    '',
    `The imports sync was ${status === 'failed' ? 'FAILED' : 'left needing owner input'} at ${iso(startedAt)} (${sgtLabel(startedAt)}).`,
    `Details: ${detailsRel || logRel || (logPath ? relative(process.cwd(), logPath) : 'logs/imports/NEEDS-ATTENTION.md')}`,
    '',
    ...reasons.map((r) => `- ${r.code}: ${sanitiseLogLine(r.message)}`),
    '',
  ].join('\n');
}

/**
 * writeAlertFiles — the durable alert. It deliberately does NOT delete on a
 * later success: a failure that resolved overnight still happened, and the
 * owner acknowledges it by deleting the file after reading it.
 */
export function writeAlertFiles({ repoRoot, status, startedAt, reasons, summary, queue, logPath, board }) {
  const dir = path.join(repoRoot, 'logs', 'imports');
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, NEEDS_ATTENTION);
  const pointer = path.join(repoRoot, NEEDS_ATTENTION);
  const logRel = logPath ? relative(repoRoot, logPath) : null;
  const detailsRel = relative(repoRoot, full);
  const details = alertMarkdown({ status, startedAt, reasons, summary, queue, logPath, logRel, board });
  fs.writeFileSync(full, details + '\n');
  fs.writeFileSync(pointer, pointerMarkdown({ status, startedAt, reasons, logPath, logRel, detailsRel }) + '\n');
  return { full, pointer };
}

export function writeRunRecord({ repoRoot, record }) {
  const dir = path.join(repoRoot, 'logs', 'imports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, RUN_RECORD);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows can refuse a rename over a file another process has open.
    fs.writeFileSync(file, fs.readFileSync(tmp));
    try { fs.unlinkSync(tmp); } catch {}
  }
  return file;
}

/**
 * postToBoard — only when a token exists. BOARD_URL names the board's alert
 * endpoint; there is no default because guessing another service's URL is how
 * an alert silently goes nowhere.
 */
export async function postToBoard({ env = process.env, payload, fetchImpl = globalThis.fetch } = {}) {
  const token = String(env.BOARD_TOKEN || '').trim();
  if (!token) return { posted: false, skipped: 'no-board-token' };
  const url = String(env.BOARD_URL || '').trim();
  if (!url) return { posted: false, skipped: 'no-board-url' };
  if (typeof fetchImpl !== 'function') return { posted: false, error: 'fetch is unavailable' };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok ? { posted: true, status: res.status } : { posted: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { posted: false, error: e?.message || String(e) };
  }
}

/** A board payload is counts and reason codes, never a seller or source field. */
export function boardPayload({ status, startedAt, reasons = [], logPath, repoRoot }) {
  return {
    source: 'curious-tails-imports',
    severity: status === 'failed' ? 'error' : 'warning',
    title: status === 'failed' ? 'Curious Tails imports sync failed' : 'Curious Tails imports need attention',
    body: reasons.map((r) => `${r.code}: ${sanitiseLogLine(r.message)}`).join('\n'),
    at: iso(startedAt),
    log: logPath ? relative(repoRoot, logPath) : null,
  };
}
