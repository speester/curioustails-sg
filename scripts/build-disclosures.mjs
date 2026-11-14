// K-131/K-141: regenerate config/disclosures.json from src/data/buying-terms.ts before every build.
// The registry is generated (rtp-v3 disclosures.py reads the exports through esbuild), so any edit to
// buying-terms.ts, related or not, changes the source hash; running the generator here keeps copy_lint C16
// from reporting a stale registry. A generator failure fails the build: the registry must match the source.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const script = join(homedir(), '.claude', 'skills', 'rtp-v3', 'scripts', 'disclosures.py');
if (!existsSync(script)) {
  console.error(`build-disclosures: ${script} not found; cannot regenerate config/disclosures.json`);
  process.exit(1);
}
const python = process.platform === 'win32' ? 'python' : 'python3';
const r = spawnSync(python, [script, 'build', '--project', '.'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
