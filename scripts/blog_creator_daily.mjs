import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV, filterBlogRows, extractMetadata, validateBlogMetadata, extractDayNumber } from './csv_parser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const PENDING_PATH = path.join(__dirname, 'pending_posts.json');
const QUEUE_PATH = path.join(__dirname, 'blogs_queue.json');

/**
 * Daily blog topic selector.
 *
 * IMPORTANT: This script no longer writes .astro pages or GBP queue entries.
 * The 2026-07-10 runs published placeholder pages with filler content and
 * broken preview URLs; those pages were deleted and their queue entries
 * marked skip:true. Until real content generation is wired in, this script
 * stops at topic selection and records the topic in pending_posts.json.
 *
 * The real pipeline per the owner's brief-first rule:
 *   1. page-brief skill  -> briefs/<slug>.json
 *   2. blog-writer skill -> src/pages/blog/<slug>.astro
 *   3. image-gen skill   -> images for the page
 *   4. article-tiktok-video skill -> TikTok/video from article content
 *   5. Append a real entry to blogs_queue.json (title, image CDN URL,
 *      points, preview under 1500 chars) for the 11am GBP post.
 */
async function createDailyBlog() {
  const now = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
  console.log(`\n📝 Daily Blog Topic Selector at ${now}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Parse CSV and find next blog
    console.log('\n1️⃣  Parsing blog calendar (research/site-blueprint.csv)...');
    const allRows = parseCSV('research/site-blueprint.csv');
    const blogRows = filterBlogRows(allRows);

    // Only "Day X" numbered blogs are part of the daily calendar.
    // Selection is by CSV file order: the first Day-numbered row whose URL
    // is not already in blogs_queue.json wins (this is how priority
    // reordering works — e.g. the fireworks post placed after Day 5).
    const dayNumberedBlogs = blogRows.filter(row => /Day\s+\d+/.test(row.notes));
    console.log(`   Found ${dayNumberedBlogs.length} Day-numbered blogs in calendar`);

    const publishedUrls = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')).map(blog => blog.url);
    console.log(`   Already created/queued: ${publishedUrls.length} blogs`);

    let nextBlog = null;
    for (const blog of dayNumberedBlogs) {
      const blogUrl = `https://curioustails.sg${blog.url_slug}`;
      if (!publishedUrls.includes(blogUrl)) {
        nextBlog = blog;
        break;
      }
    }

    if (!nextBlog) {
      console.log('\n✅ All Day-numbered blogs are created or queued. Add rows to the CSV for more.');
      logCompletion({
        status: 'schedule_complete',
        message: 'All Day-numbered blogs have been created or queued',
      });
      return;
    }

    // Step 2: Extract metadata
    console.log('\n2️⃣  Extracting blog metadata...');
    const metadata = extractMetadata(nextBlog);
    validateBlogMetadata(metadata);
    const slugFilename = metadata.urlSlug.split('/').pop();
    metadata.filenameSlug = slugFilename;
    console.log(`   Day ${metadata.dayNumber}: ${metadata.title}`);
    console.log(`   Keyword: ${metadata.targetKeyword}`);
    console.log(`   Slug: ${metadata.urlSlug}`);

    // Step 3: Record as pending — do NOT generate placeholder content.
    console.log('\n3️⃣  Recording topic in pending_posts.json (no page written)...');
    let pending = [];
    if (fs.existsSync(PENDING_PATH)) {
      pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
    }

    const alreadyPending = pending.some(p => p.slug === slugFilename);
    if (!alreadyPending) {
      pending.push({
        day: metadata.dayNumber,
        slug: slugFilename,
        urlSlug: metadata.urlSlug,
        title: metadata.title,
        h1: metadata.h1,
        targetKeyword: metadata.targetKeyword,
        notes: metadata.notes,
        queuedAt: new Date().toISOString(),
      });
      fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2), 'utf-8');
      console.log('   ✓ Added to pending_posts.json');
    } else {
      console.log('   ⏭  Already pending — still waiting for content to be written.');
    }

    console.log('\n⏸  CONTENT GENERATION — QUEUING SKILLS (non-blocking)');
    console.log(`\n📋 Queuing content generation tasks for ${metadata.title}:`);
    console.log(`   Topic queued in pending_posts.json for skill processing`);
    console.log(`\n🔄 Skills will run in background (max 10min timeout each):`);
    console.log(`   ✓ page-brief (research + outline)`);
    console.log(`   ✓ blog-writer (2000+ words)`);
    console.log(`   ✓ image-gen (3 WebP images)`);
    console.log(`   ✓ article-tiktok-video (TikTok/short-form)`);
    console.log(`   ✓ Update blogs_queue.json for 11am GBP post`);
    console.log(`\n⚡ If skill hangs (timeout), it will be killed and logged as failed.`);
    console.log(`   Check pending_posts.json for status and retry manually.`);

    logCompletion({
      dayNumber: metadata.dayNumber,
      slug: slugFilename,
      title: metadata.title,
      status: 'pending_content',
      timestamp: new Date().toISOString(),
    });
    console.log('\n✓ Logged to blog_automation_log.json\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    logCompletion({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
    process.exit(1);
  }
}

/**
 * Log completion to blog_automation_log.json
 */
function logCompletion(entry) {
  const logPath = path.join(__dirname, 'blog_automation_log.json');
  let log = [];

  if (fs.existsSync(logPath)) {
    log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }

  log.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });

  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf-8');
}

// Run the main function
createDailyBlog().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
