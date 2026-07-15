import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Run a Claude Code skill with timeout protection.
 * Prevents automation from hanging on slow/stuck skills.
 *
 * @param {string} skillName - e.g. "page-brief", "blog-writer", "image-gen"
 * @param {string} args - skill arguments, e.g. "/blog/puppy-fireworks-singapore"
 * @param {number} timeoutMs - max runtime in milliseconds (default 10 minutes)
 * @returns {Promise<boolean>} true if succeeded, false if timed out/failed
 */
export async function runSkillWithTimeout(skillName, args, timeoutMs = 600000) {
  return new Promise((resolve) => {
    let timedOut = false;

    // Start the skill via Claude CLI
    const process = spawn('claude', ['code', skillName, args], {
      cwd: projectRoot,
      stdio: 'pipe'
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      timedOut = true;
      console.warn(`⚠️  TIMEOUT: ${skillName} exceeded ${timeoutMs}ms, killing process`);
      process.kill('SIGTERM');
    }, timeoutMs);

    process.on('close', (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        console.error(`❌ ${skillName} was killed due to timeout`);
        resolve(false);
      } else if (code === 0) {
        console.log(`✅ ${skillName} completed successfully`);
        resolve(true);
      } else {
        console.error(`❌ ${skillName} failed with code ${code}`);
        resolve(false);
      }
    });

    process.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`❌ ${skillName} error:`, err.message);
      resolve(false);
    });
  });
}

/**
 * Run multiple skills in parallel with timeout protection.
 * Does NOT block on individual skill completion.
 */
export function queueSkillsNonBlocking(skillQueue) {
  console.log(`\n📨 Queuing ${skillQueue.length} skills to run in background (non-blocking)...`);

  skillQueue.forEach(({ skill, args }, index) => {
    setTimeout(() => {
      console.log(`   [${index + 1}/${skillQueue.length}] Starting ${skill}...`);
      runSkillWithTimeout(skill, args, 600000).then((success) => {
        const status = success ? '✅' : '❌';
        console.log(`   ${status} ${skill} finished`);
      });
    }, index * 1000); // Stagger starts by 1 second to avoid collisions
  });

  console.log('   (Skills are running in background — automation continues)\n');
}

/**
 * Wait for a skill to complete with timeout.
 * BLOCKING version (use only when result is critical).
 */
export async function waitForSkill(skill, args, timeoutMs = 600000) {
  return runSkillWithTimeout(skill, args, timeoutMs);
}
