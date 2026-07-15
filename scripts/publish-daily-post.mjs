import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Zernio API setup
const configPath = path.join(os.homedir(), '.zernio/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const ZERNIO_API_KEY = config.apiKey;
const ZERNIO_BASE = config.baseURL || 'https://zernio.com/api';

const GBP_ACCOUNT_ID = '6a4cab009d9472faaea42d63';
const POSTS_LOG_PATH = path.join(__dirname, 'posts_log.json');
const BLOGS_QUEUE_PATH = path.join(__dirname, 'blogs_queue.json');
const DOMAIN = 'https://curioustails.sg';

// Load blog posts from external queue file (allows dynamic updates from blog_creator_daily.mjs)
let blogPosts = [];

function loadBlogPosts() {
  try {
    if (fs.existsSync(BLOGS_QUEUE_PATH)) {
      blogPosts = JSON.parse(fs.readFileSync(BLOGS_QUEUE_PATH, 'utf-8'));
    } else {
      console.warn('⚠️  blogs_queue.json not found; falling back to hardcoded blogs.');
      // Fallback: hardcoded blogs for backwards compatibility
      blogPosts = [
  {
    slug: 'first-time-mistakes',
    file: 'first-time-mistakes.astro',
    url: `${DOMAIN}/blog/first-time-mistakes`,
    title: '5 First-Time Puppy Owner Mistakes to Avoid',
    image: `${DOMAIN}/_astro/5-cavapoo-puppy-settling-playpen-first-day.BwGjMc7F_1hbFgT.webp`,
    points: [
      'Choosing by routine, not photo',
      'Not over-buying gear before day one',
      'The 2am rescue (stick to night routine)',
      'Quality over quantity in socialisation',
      'Not panicking at normal week-one behaviour'
    ],
    preview: `🐾 From two years of real placements: puppies thrive with a routine + someone to call.

The five mistakes we see most?
✓ Choosing by photo, not routine
✓ Over-buying gear before day one
✓ The 2am rescue that teaches the wrong lesson
✓ Chaotic socialisation instead of calm exposure
✓ Panicking at normal week-one behaviour

Every one is preventable. Read real placement stories and how to avoid them.

📖 Read the full guide: https://curioustails.sg/blog/first-time-mistakes`
  },
  {
    slug: 'hdb-dog-guide',
    file: 'hdb-dog-guide.astro',
    url: `${DOMAIN}/blog/hdb-dog-guide`,
    title: 'HDB Dogs in Singapore: A Complete Guide',
    image: `${DOMAIN}/_astro/2-bichonpoo-white-portrait.mnLINIIf_ZMsRbB.webp`,
    points: [
      'HDB dog ownership is legal with correct breeds',
      'Approved breeds are smaller, lower-shedding types',
      'Microchipping and registration required',
      'Noise management is key for neighbours',
      'Proper training prevents complaints'
    ],
    preview: `🏢 HDB Dogs in Singapore: What You Actually Need to Know

Thinking about getting a puppy in your HDB flat? Here's what's real:

✓ HDB dogs ARE legal (with the right breeds)
✓ Approved breeds list exists—Maltipoos & Cavapoos qualify
✓ Microchip + registration are non-negotiable
✓ Neighbours matter—training matters more
✓ Done right, flat life is perfect for the right puppy

Read what HDB actually allows, which breeds work best, and how to be the neighbour everyone likes.

📖 Full guide: https://curioustails.sg/blog/hdb-dog-guide`
  },
  {
    slug: 'cavapoo-vs-maltipoo',
    file: 'cavapoo-vs-maltipoo.astro',
    url: `${DOMAIN}/blog/cavapoo-vs-maltipoo`,
    title: 'Cavapoo vs Maltipoo: Which Breed for You?',
    image: `${DOMAIN}/_astro/2-cavapoo-puppy-portrait-available.D0rsHwt9_1Yl3zv.webp`,
    points: [
      'Cavapoos are more independent, better for 9-5 families',
      'Maltipoos need more company and grooming',
      'Both are great in HDB if trained',
      'Temperament matters more than appearance',
      'Routine and consistency are what make the difference'
    ],
    preview: `🐕 Cavapoo vs Maltipoo: Which Breed Is Right for Your Singapore Home?

Can't decide between a Cavapoo and Maltipoo? Let's cut through the photo-browsing and talk routine.

✓ Cavapoos = more independent, better for working parents
✓ Maltipoos = need more company, love being with you
✓ Both are HDB-approved (if trained)
✓ Both need regular grooming in Singapore's humidity
✓ The real difference? Your daily routine, not the breed look

Read what actually matters when choosing, what each breed needs, and which one matches your life.

📖 Compare breeds: https://curioustails.sg/blog/cavapoo-vs-maltipoo`
  }
      ];
    }
  } catch (error) {
    console.error('❌ Error loading blogs_queue.json:', error.message);
    process.exit(1);
  }
}

async function getPostedBlogs() {
  if (!fs.existsSync(POSTS_LOG_PATH)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(POSTS_LOG_PATH, 'utf-8'));
}

function blogPageExists(blog) {
  if (!blog.file) return true;
  return fs.existsSync(path.join(projectRoot, 'src/pages/blog', blog.file));
}

async function getNextBlog() {
  const posted = await getPostedBlogs();
  const postedUrls = posted.map(p => p.blogUrl);

  for (const blog of blogPosts) {
    if (postedUrls.includes(blog.url)) continue;
    if (blog.skip === true) {
      console.log(`⏭  Skipping "${blog.title}" (marked skip: ${blog.skipReason || 'no reason given'})`);
      continue;
    }
    // Never post a GBP link to a page that doesn't exist on the site.
    if (!blogPageExists(blog)) {
      console.warn(`⚠️  Skipping "${blog.title}" — src/pages/blog/${blog.file} not found (would 404).`);
      continue;
    }
    return blog;
  }
  return undefined;
}

async function publishViaZernioAPI(blog) {
  const payload = {
    content: blog.preview,
    publishNow: true,
    mediaItems: [{
      type: 'image',
      url: blog.image,
      title: blog.title
    }],
    platforms: [{
      platform: 'googlebusiness',
      accountId: GBP_ACCOUNT_ID
    }]
  };

  const response = await fetch(`${ZERNIO_BASE}/v1/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZERNIO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Response (${response.status}):`, errorText.slice(0, 500));
    throw new Error(`Zernio API error: ${response.status}`);
  }

  const result = await response.json();
  const postId = result.post?._id || result._id || result.id || 'published';
  return postId;
}

async function publishPost() {
  try {
    // Load latest blogs from external queue (allows dynamic updates)
    loadBlogPosts();

    const blog = await getNextBlog();

    if (!blog) {
      console.log('📭 No more blogs available to post. All articles have been published.');
      console.log('💡 Suggestion: Write new blog content or the schedule will loop back to day 1.');
      return;
    }

    console.log(`📝 Publishing: "${blog.title}"\n   URL: ${blog.url}`);

    const postId = await publishViaZernioAPI(blog);

    console.log(`✅ Published! Post ID: ${postId}`);

    // Log it
    const posted = await getPostedBlogs();
    posted.push({
      blogUrl: blog.url,
      gbpPostId: postId,
      title: blog.title,
      postedAt: new Date().toISOString(),
      status: 'published'
    });

    fs.writeFileSync(POSTS_LOG_PATH, JSON.stringify(posted, null, 2));
    console.log('✅ Logged in posts_log.json');
    console.log(`\n📊 Progress: ${posted.length}/${blogPosts.length} blogs posted`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

publishPost();
