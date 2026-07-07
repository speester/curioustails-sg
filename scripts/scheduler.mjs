import cron from 'node-cron';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const postSchedule = '0 11 * * *'; // 11:00 AM every day
const reviewSchedule = '0 */4 * * *'; // every 4 hours

console.log('🚀 GBP Daily Scheduler Started');
console.log('📅 Posts publish at 11:00 AM Singapore time');
console.log('📊 Your blog will auto-post daily until all 3 articles are published');
console.log('💡 Then it loops back to day 1, or write new blog posts for continuous daily content');
console.log('💬 Reviews are checked every 4 hours and auto-replied via AI\n');

function runScript(npmScript, label) {
  const now = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
  console.log(`⏰ [${now}] ${label}...`);

  exec(`npm run ${npmScript}`, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return;
    }
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  });
}

cron.schedule(postSchedule, () => runScript('gbp:post', "Publishing today's post"), {
  timezone: 'Asia/Singapore'
});

cron.schedule(reviewSchedule, () => runScript('gbp:reviews', 'Checking for new reviews to reply to'), {
  timezone: 'Asia/Singapore'
});

// Also allow manual trigger
console.log('💡 Tip: Run "npm run gbp:post" or "npm run gbp:reviews" anytime to trigger immediately\n');

// Keep scheduler running
process.on('SIGINT', () => {
  console.log('\n⏹️  Scheduler stopped');
  process.exit(0);
});
