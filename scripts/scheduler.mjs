import cron from 'node-cron';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const blogCreateSchedule = '0 8 * * *'; // 8:00 AM every day
const postSchedule = '0 11 * * *'; // 11:00 AM every day
const reviewSchedule = '0 */4 * * *'; // every 4 hours

console.log('🚀 Daily Automation Scheduler Started');
console.log('📝 Blogs created at 08:00 AM Singapore time');
console.log('📅 Blogs post to GBP at 11:00 AM Singapore time');
console.log('💬 Reviews checked every 4 hours and auto-replied via AI\n');
console.log('🔗 Pipeline: 8am (create blog) → 11am (post to GBP) → Repeat daily\n');

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

cron.schedule(blogCreateSchedule, () => runScript('blog:create', '📝 Creating daily blog'), {
  timezone: 'Asia/Singapore'
});

cron.schedule(postSchedule, () => runScript('gbp:post', '📤 Publishing blog to GBP'), {
  timezone: 'Asia/Singapore'
});

cron.schedule(reviewSchedule, () => runScript('gbp:reviews', '💬 Checking for new reviews'), {
  timezone: 'Asia/Singapore'
});

// Also allow manual trigger
console.log('💡 Manual Triggers:');
console.log('   npm run blog:create   - Create blog now');
console.log('   npm run gbp:post      - Post to GBP now');
console.log('   npm run gbp:reviews   - Check reviews now\n');

// Keep scheduler running
process.on('SIGINT', () => {
  console.log('\n⏹️  Scheduler stopped');
  process.exit(0);
});
