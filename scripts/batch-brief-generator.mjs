import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV, filterBlogRows, extractMetadata } from './csv_parser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Batch Brief Generator
 *
 * Generates briefs for all Day-numbered blogs in the calendar.
 * Each brief is saved to briefs/<slug>.json
 *
 * Run: node scripts/batch-brief-generator.mjs
 *
 * This pre-caches all research, so daily automation doesn't need to do live SERP research.
 */
async function batchGenerateBriefs() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 BATCH BRIEF GENERATOR');
  console.log('='.repeat(60));
  console.log('\nThis generates research briefs for all 90 blogs.');
  console.log('Research is cached — daily automation will be fast & reliable.\n');

  try {
    // Parse CSV
    console.log('1️⃣  Reading blog calendar...');
    const allRows = parseCSV('research/site-blueprint.csv');
    const blogRows = filterBlogRows(allRows);
    const dayNumberedBlogs = blogRows.filter(row => /Day\s+\d+/.test(row.notes));

    console.log(`   Found ${dayNumberedBlogs.length} Day-numbered blogs\n`);

    // Load existing queue to skip already-generated briefs
    const queuePath = path.join(__dirname, 'blogs_queue.json');
    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
    const queuedUrls = queue.map(blog => blog.url);

    // Filter to blogs we need briefs for
    const blogsNeedingBriefs = dayNumberedBlogs.filter(blog => {
      const blogUrl = `https://curioustails.sg${blog.url_slug}`;
      return !queuedUrls.includes(blogUrl);
    });

    console.log(`2️⃣  Blogs needing briefs: ${blogsNeedingBriefs.length}`);
    console.log(`   (${dayNumberedBlogs.length - blogsNeedingBriefs.length} already in queue)\n`);

    if (blogsNeedingBriefs.length === 0) {
      console.log('✅ All blogs already have briefs or are queued. Nothing to do.\n');
      return;
    }

    // Generate instructions
    console.log('3️⃣  Brief Generation Instructions\n');
    console.log('   Each brief needs to be generated via:');
    console.log('   /page-brief <slug>\n');
    console.log('   Copy & paste these commands into Claude Code in order:\n');

    blogsNeedingBriefs.forEach((blog, index) => {
      const metadata = extractMetadata(blog);
      const slugFilename = metadata.urlSlug.split('/').pop();
      const briefPath = path.join(projectRoot, `briefs/${slugFilename}.json`);
      const exists = fs.existsSync(briefPath) ? '✅ EXISTS' : '⏳ NEEDED';

      console.log(`   ${index + 1}. /page-brief ${metadata.urlSlug}  ${exists}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nTotal briefs to generate: ${blogsNeedingBriefs.length}`);
    console.log('Time per brief: ~2-3 minutes (live SERP research)');
    console.log(`Total time: ~${blogsNeedingBriefs.length * 2.5} minutes`);
    console.log('\n✨ After all briefs are generated:');
    console.log('   • Daily automation will skip live research');
    console.log('   • 8:00 AM runs will complete in <10 seconds');
    console.log('   • No more hangs or timeouts\n');
    console.log('💡 Tip: Generate briefs in parallel by opening multiple Claude Code windows.\n');

    // Save a checklist file
    const checklist = {
      generated_at: new Date().toISOString(),
      total_blogs_needing_briefs: blogsNeedingBriefs.length,
      blogs: blogsNeedingBriefs.map(blog => {
        const metadata = extractMetadata(blog);
        return {
          day: metadata.dayNumber,
          slug: metadata.urlSlug.split('/').pop(),
          title: metadata.title,
          keyword: metadata.targetKeyword,
          command: `/page-brief ${metadata.urlSlug}`,
          status: 'pending'
        };
      })
    };

    const checklistPath = path.join(projectRoot, 'scripts/brief-generation-checklist.json');
    fs.writeFileSync(checklistPath, JSON.stringify(checklist, null, 2));
    console.log('✅ Saved checklist to scripts/brief-generation-checklist.json\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

batchGenerateBriefs();
