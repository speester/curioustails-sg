#!/usr/bin/env node
// Imports pipeline entry point (T14; spec §1, §6.6).
//
// The private store guard (T1) runs before anything is fetched or written.
// The pipeline itself lives in lib/pipeline.mjs so it can be tested offline.
//
// It never prints secret.key, seller fields, source URLs, microchips or source
// listing ids. Console output is counts and public imp- ids only.
//
// runSync() is the reusable half: the daily scheduler calls it so the scheduled
// run and the human command exercise exactly the same pipeline.
import { pathToFileURL } from 'node:url';
import { openStore, StoreError } from './lib/store.mjs';
import { parseArgs, runPipeline, USAGE, RunBusyError, FeedValidationError, sanitiseLogLine } from './lib/pipeline.mjs';
import { hardFailures } from './lib/alert.mjs';

export { parseArgs };

/**
 * runSync({ argv, store, repoRoot, env, now, adapters, createHttpFn, fetchImpl })
 * Returns the pipeline result plus a CLI-style `code`. A blocked source or a
 * missing published photo is a hard failure and exits non-zero (T25).
 */
export async function runSync({
  argv = process.argv.slice(2),
  store,
  repoRoot,
  env = process.env,
  now,
  adapters,
  createHttpFn,
  fetchImpl,
} = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    return { code: 2, phase: 'args', error: e, args: null };
  }
  if (args.help) return { code: 0, phase: 'help', args };

  let s = store;
  if (!s) {
    try {
      s = openStore({ env });
    } catch (e) {
      return { code: 1, phase: 'store', error: e, args };
    }
  }

  try {
    const result = await runPipeline({
      args,
      store: s,
      env,
      ...(repoRoot ? { repoRoot } : {}),
      ...(now ? { now } : {}),
      ...(adapters ? { adapters } : {}),
      ...(createHttpFn ? { createHttpFn } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    });
    const hard = hardFailures(result.summary);
    return { ...result, code: hard.length ? 1 : result.exitCode, hard, args };
  } catch (e) {
    return { code: 1, phase: 'run', error: e, args };
  }
}

export async function main(argv = process.argv.slice(2)) {
  const result = await runSync({ argv });

  if (result.phase === 'args') {
    console.error(`imports: ${result.error.message}`);
    console.error(USAGE);
    return 2;
  }
  if (result.help) {
    console.log(USAGE);
    return 0;
  }
  if (result.phase === 'store') {
    // StoreError messages are written for the operator; anything else is unexpected.
    console.error(`imports: ${result.error instanceof StoreError ? result.error.message : `unexpected error: ${result.error?.message || result.error}`}`);
    return 1;
  }
  if (result.phase === 'run') {
    if (result.error instanceof RunBusyError || result.error instanceof FeedValidationError) {
      console.error(`imports: ${result.error.message}`);
      return 1;
    }
    console.error(`imports: unexpected error: ${result.error?.message || result.error}`);
    return 1;
  }

  const { summary } = result;
  const lines = [
    `imports: ${summary.mode} · sources ${Object.keys(summary.sources).join(', ') || 'none'}`,
    `  discovered=${summary.discovered} records=${summary.records} groups=${summary.groups} merged=${summary.merged} rejected=${summary.rejected}`,
    `  gates pass=${summary.gates.pass} review=${summary.gates.review} reject=${summary.gates.reject} auto-ready=${summary.gates['auto-ready']} publish=${summary.gates.publish}`,
    `  images downloaded=${summary.images.downloaded} failed=${summary.images.failed}`,
    `  feedPups=${summary.feedPups} published=${summary.published} unpublished=${summary.unpublished}`,
    ...(summary.logPath ? [`  log=${summary.logPath}`] : []),
  ];
  for (const line of lines) console.log(sanitiseLogLine(line));
  if (result.hard?.length) {
    console.error(sanitiseLogLine(`imports: hard failure: ${result.hard.map((h) => `${h.code}: ${h.message}`).join('; ')}`));
  }
  return result.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => {
    console.error(`imports: unexpected error: ${e?.message || e}`);
    process.exitCode = 1;
  });
}
