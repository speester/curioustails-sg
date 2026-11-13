#!/usr/bin/env node
// Imports pipeline entry point (T14; spec §1, §6.6).
//
// The private store guard (T1) runs before anything is fetched or written.
// The pipeline itself lives in lib/pipeline.mjs so it can be tested offline.
//
// It never prints secret.key, seller fields, source URLs, microchips or source
// listing ids. Console output is counts and public imp- ids only.
import { pathToFileURL } from 'node:url';
import { openStore, StoreError } from './lib/store.mjs';
import { parseArgs, runPipeline, USAGE, RunBusyError, FeedValidationError, sanitiseLogLine } from './lib/pipeline.mjs';

export { parseArgs };

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`imports: ${e.message}`);
    console.error(USAGE);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  let store;
  try {
    store = openStore();
  } catch (e) {
    // StoreError messages are written for the operator; anything else is unexpected.
    console.error(`imports: ${e instanceof StoreError ? e.message : `unexpected error: ${e?.message || e}`}`);
    return 1;
  }

  try {
    const { exitCode, summary } = await runPipeline({ args, store });
    const lines = [
      `imports: ${summary.mode} — sources ${Object.keys(summary.sources).join(', ') || 'none'}`,
      `  discovered=${summary.discovered} records=${summary.records} groups=${summary.groups} merged=${summary.merged} rejected=${summary.rejected}`,
      `  gates pass=${summary.gates.pass} review=${summary.gates.review} reject=${summary.gates.reject} auto-ready=${summary.gates['auto-ready']} publish=${summary.gates.publish}`,
      `  images downloaded=${summary.images.downloaded} failed=${summary.images.failed}`,
      `  feedPups=${summary.feedPups} published=${summary.published} unpublished=${summary.unpublished}`,
      ...(summary.logPath ? [`  log=${summary.logPath}`] : []),
    ];
    for (const line of lines) console.log(sanitiseLogLine(line));
    return exitCode;
  } catch (e) {
    if (e instanceof RunBusyError || e instanceof FeedValidationError) {
      console.error(`imports: ${e.message}`);
      return 1;
    }
    console.error(`imports: unexpected error: ${e?.message || e}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => {
    console.error(`imports: unexpected error: ${e?.message || e}`);
    process.exitCode = 1;
  });
}
