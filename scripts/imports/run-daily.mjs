#!/usr/bin/env node
// Curious Tails — daily imports runner (T25, spec §6.8).
//
//   node scripts/imports/run-daily.mjs [--no-fetch] [--source NAME] [--max-detail N]
//                                      [--dotenv <path>] [--repo <dir>]
//
// It runs the SAME pipeline as `npm run sync:imports` (fetch → normalise →
// dedupe → gates → images → public JSON) and then:
//   * auto-publishes gate-passing records (owner decision 2026-11-18; kill
//     switch IMPORTS_DAILY_AUTOPUBLISH=0) and, with --push, commits only the
//     public feed + its WebPs to GitHub main, which deploys the site
//   * appends a counts-only run line to logs/imports/<UTC date>.log
//   * writes logs/imports/last-run.json (the clean-run record)
//   * on a hard failure or a soft owner action, writes NEEDS-ATTENTION.md in
//     logs/imports/ and at the repo root, and posts to the board when
//     BOARD_TOKEN (and BOARD_URL) are set
// It never builds; it commits and pushes only with --push (see lib/publish-feed.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openStore, readDotenvValue } from './lib/store.mjs';
import { runSync } from './sync-imports.mjs';
import { publishFeed } from './lib/publish-feed.mjs';
import { sanitiseLogLine, FeedValidationError, RunBusyError } from './lib/pipeline.mjs';
import {
  classifyRun,
  splitQueue,
  postToBoard,
  boardPayload,
  writeAlertFiles,
  writeRunRecord,
  sgtLabel,
} from './lib/alert.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const USAGE = [
  'usage: node scripts/imports/run-daily.mjs [--dry-run] [--no-fetch] [--source NAME] [--max-detail N]',
  '       [--dotenv <path>] [--repo <dir>]',
  '  --dotenv PATH   dotenv file holding IMPORTS_PRIVATE_DIR (default: ~/.claude/.env,',
  '                  or IMPORTS_DOTENV). The scheduled task passes the owner path explicitly',
  '                  so a SYSTEM task does not look in the system profile.',
  '  --repo DIR      repository root (default: this checkout)',
  '  --push          after a run that did not fail, commit the public feed + WebPs to main and push',
  '  every other flag is handed to the imports pipeline unchanged.',
].join('\n');

/** Strip the two runner-only flags; everything else belongs to parseArgs(). */
export function parseDailyArgs(argv = []) {
  const pipelineArgv = [];
  let dotenv = null;
  let repoRoot = null;
  let help = false;
  let push = false;
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--push') {
      push = true;
    } else if (k === '--dotenv' || k === '--repo') {
      const v = argv[++i];
      if (!v) throw new Error(`${k} needs a value`);
      if (k === '--dotenv') dotenv = v;
      else repoRoot = v;
    } else if (k === '--help' || k === '-h') {
      help = true;
    } else {
      pipelineArgv.push(k);
    }
  }
  return { pipelineArgv, dotenv, repoRoot, help, push };
}

function appendLog(logPath, lines) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, lines.map(sanitiseLogLine).join('\n') + '\n');
}

// K-139: three non-overlapping counts. review and leadOnly used to be one
// number, so 70 lead-only records read as 73 items of owner work.
function queueCounts(queue = [], summary = null, nowMs = Date.now()) {
  const split = splitQueue(queue);
  return {
    autoReady: split.autoReady,
    review: split.review,
    leadOnly: split.leadOnly,
    publishable: split.publishable,
    needsEdit: split.needsEdit,
    oldestReviewHours: split.publishableItems
      .filter((q) => q?.disposition === 'review')
      .map((q) => Date.parse(q?.firstFailedAt))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
      .map((t) => Math.round((nowMs - t) / 3600000))[0] ?? null,
    rejected: summary?.rejected ?? null,
    unpublished: summary?.unpublished ?? null,
  };
}

/**
 * runDaily({ argv, repoRoot, env, now, store, storeDir, adapters, createHttpFn, fetchImpl, boardFetch })
 * Returns { exitCode, status, classification, summary, queue, logPath, alert, record, board }.
 * Tests call this directly with a temp repo and store; the CLI is the same code.
 */
export async function runDaily({
  argv = process.argv.slice(2),
  repoRoot = REPO_ROOT,
  env = process.env,
  now = () => new Date(),
  store,
  storeDir,
  adapters,
  createHttpFn,
  fetchImpl,
  boardFetch,
  pushFeed,
} = {}) {
  let parsed;
  try {
    parsed = parseDailyArgs(argv);
  } catch (e) {
    console.error(`imports-daily: ${e.message}`);
    console.error(USAGE);
    return { exitCode: 2, status: 'failed', classification: classifyRun({ error: { code: 'args', message: e.message } }) };
  }
  if (parsed.help) {
    console.log(USAGE);
    return { exitCode: 0, status: 'help' };
  }

  const root = path.resolve(repoRoot);
  const started = new Date(now());
  const logPath = path.join(root, 'logs', 'imports', `${started.toISOString().slice(0, 10)}.log`);
  const envIn = { ...env };
  const dotenvFile = parsed.dotenv ? path.resolve(parsed.dotenv) : (envIn.IMPORTS_DOTENV ? path.resolve(envIn.IMPORTS_DOTENV) : null);
  if (dotenvFile) {
    envIn.IMPORTS_DOTENV = dotenvFile;
    // The board token is optional; the dotenv file is the same place the
    // private store lives, so it is the natural place to keep it.
    for (const key of ['BOARD_TOKEN', 'BOARD_URL']) {
      if (!envIn[key]) {
        const value = readDotenvValue(dotenvFile, key);
        if (value) envIn[key] = value;
      }
    }
  }
  const autopublishEnvPresent = Object.prototype.hasOwnProperty.call(envIn, 'IMPORTS_AUTOPUBLISH');
  // Owner decision 2026-11-18 (PLAN-puppy-sales-recovery D2), taken before the
  // T17 counsel sign-off: the scheduled run auto-publishes every gate-passing
  // item. The gates, the lead-only rule (dfsi, puppies.ie), the leak check and
  // the takedown path all still apply; only the first-run safety valve (14 days
  // / first 20 per supplier held as auto-ready) is switched off.
  // Kill switch: IMPORTS_DAILY_AUTOPUBLISH=0 restores queue-only behaviour.
  // An inherited IMPORTS_AUTOPUBLISH is still ignored: this runner decides.
  const dailyAutopublish = !['0', 'false', 'no', 'off'].includes(
    String(envIn.IMPORTS_DAILY_AUTOPUBLISH ?? '').trim().toLowerCase(),
  );
  delete envIn.IMPORTS_AUTOPUBLISH;
  if (dailyAutopublish) {
    envIn.IMPORTS_AUTOPUBLISH = '1';
    envIn.IMPORTS_SAFETY_VALVE = '0';
  }

  appendLog(logPath, [
    `run-daily start ${started.toISOString()} (${sgtLabel(started)}) mode=${parsed.pipelineArgv.includes('--no-fetch') ? 'no-fetch' : parsed.pipelineArgv.includes('--dry-run') ? 'dry-run' : 'live'} autopublish=${dailyAutopublish ? 'on' : 'off'}${autopublishEnvPresent ? ' (env had IMPORTS_AUTOPUBLISH; ignored)' : ''} push=${parsed.push ? 'on' : 'off'}`,
  ]);

  let summary = null;
  let queue = [];
  let failure = null;
  let result = null;
  try {
    const s = store || openStore({ ...(storeDir ? { dir: storeDir } : {}), env: envIn });
    result = await runSync({
      argv: parsed.pipelineArgv,
      store: s,
      repoRoot: root,
      env: envIn,
      now: () => started,
      ...(adapters ? { adapters } : {}),
      ...(createHttpFn ? { createHttpFn } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    });
    summary = result.summary || null;
    queue = result.queue || [];
    if (result.phase === 'run' || result.phase === 'store' || result.phase === 'args') {
      const e = result.error;
      failure = {
        code: e instanceof FeedValidationError ? 'feed-validation'
          : e instanceof RunBusyError ? 'run-busy'
            : result.phase === 'store' ? 'store' : result.phase === 'args' ? 'args' : (e?.code || 'run-failed'),
        message: e?.message || String(e),
      };
    } else if (result.hard?.length) {
      // classifyRun() reads these hard failures from the summary; adding a
      // second "error" here would list every reason twice in the alert.
      failure = null;
    } else if (result.code !== 0) {
      failure = { code: 'pipeline-exit', message: `pipeline exited ${result.code}` };
    }
  } catch (e) {
    failure = {
      code: e instanceof FeedValidationError ? 'feed-validation'
        : e instanceof RunBusyError ? 'run-busy' : (e?.code || 'run-failed'),
      message: e?.message || String(e),
    };
  }

  const classification = classifyRun({ summary, queue, error: failure, startedAt: started });
  let status = classification.status;
  const reasons = classification.reasons;

  // Ship the public feed (--push, the scheduled task's mode): only after a run
  // that did not fail, and never on a dry run.
  let push = null;
  if (parsed.push && !classification.failed && !parsed.pipelineArgv.includes('--dry-run')) {
    try {
      push = (pushFeed || publishFeed)({ repoRoot: root });
    } catch (e) {
      push = { pushed: false, error: sanitiseLogLine(e?.message || String(e)) };
      reasons.push({ code: 'push-failed', message: `the feed was written but not pushed to main: ${push.error}` });
      if (status === 'ok') status = 'attention';
    }
    appendLog(logPath, [
      `run-daily push ${push.pushed ? `pushed ${push.commit}` : push.error ? 'FAILED' : push.reason}`,
    ]);
  }

  const recordLog = relativeLog(root, logPath);
  appendLog(logPath, [
    `run-daily result ${new Date().toISOString()} status=${status} hard=${classification.hard.length} soft=${classification.soft.length} reasons=${reasons.map((r) => r.code).join(',') || '-'}`,
    ...(failure ? [`run-daily failure ${failure.code}: ${failure.message}`] : []),
  ]);

  let board = null;
  if (reasons.length) {
    board = await postToBoard({
      env: envIn,
      payload: boardPayload({ status, startedAt: started, reasons, logPath, repoRoot: root }),
      ...(boardFetch ? { fetchImpl: boardFetch } : {}),
    });
  }

  let alert = null;
  if (reasons.length) {
    alert = writeAlertFiles({
      repoRoot: root,
      status,
      startedAt: started,
      reasons,
      summary,
      queue,
      logPath,
      board,
    });
  }

  const record = {
    at: started.toISOString(),
    atSGT: sgtLabel(started),
    status,
    exitCode: classification.failed ? 1 : 0,
    mode: summary?.mode || (parsed.pipelineArgv.includes('--no-fetch') ? 'no-fetch' : parsed.pipelineArgv.includes('--dry-run') ? 'dry-run' : 'live'),
    autopublish: dailyAutopublish,
    autopublishEnvPresent,
    push,
    counts: summary
      ? {
          discovered: summary.discovered,
          records: summary.records,
          groups: summary.groups,
          merged: summary.merged,
          rejected: summary.rejected,
          gates: summary.gates,
          images: summary.images,
          feedPups: summary.feedPups,
          published: summary.published,
          unpublished: summary.unpublished,
        }
      : null,
    queue: queueCounts(queue, summary, started.getTime()),
    alerts: reasons,
    log: recordLog,
    alert: alert ? { full: relativeLog(root, alert.full), pointer: relativeLog(root, alert.pointer) } : null,
    board,
    errors: (summary?.errors || []).map((e) => ({ stage: e.stage, code: e.code, source: e.source || null, blocked: !!e.blocked })),
  };
  const recordPath = writeRunRecord({ repoRoot: root, record });

  return {
    exitCode: record.exitCode,
    status,
    classification,
    summary,
    queue,
    logPath,
    alert,
    record,
    recordPath,
    board,
  };
}

function relativeLog(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDaily().then((r) => {
    process.exitCode = r.exitCode;
    if (r.status === 'failed') {
      console.error(`imports-daily: ${r.classification.reasons.map((x) => `${x.code}: ${x.message}`).join('; ')}`);
    }
  }, (e) => {
    console.error(`imports-daily: unexpected error: ${e?.message || e}`);
    process.exitCode = 1;
  });
}
