import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const zernioConfig = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.zernio/config.json'), 'utf-8'));
const ZERNIO_API_KEY = zernioConfig.apiKey;
const ZERNIO_BASE = zernioConfig.baseURL || 'https://zernio.com/api';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';

const ZERNIO_ACCOUNT_ID = '6a4cab009d9472faaea42d63';
const REVIEWS_LOG_PATH = path.join(__dirname, 'reviews_log.json');

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found in .env');
  process.exit(1);
}

const BRAND_VOICE = `You are replying as Curious Tails, a dog breeder and pet shop in Singapore (2 Balestier Rd).
Brand voice: warm, friendly, knowledgeable, passionate about puppy welfare, professional but approachable.
Keep replies to 1-2 short sentences. Be genuine and specific to what the reviewer said, not generic.
Do not invent facts about the customer's puppy or situation beyond what's in the review text.
Never mention price, discounts, or make guarantees not already implied by the review.`;

function getRepliedLog() {
  if (!fs.existsSync(REVIEWS_LOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(REVIEWS_LOG_PATH, 'utf-8'));
}

async function fetchReviews() {
  const response = await fetch(
    `${ZERNIO_BASE}/v1/accounts/${ZERNIO_ACCOUNT_ID}/gmb-reviews?pageSize=50`,
    { headers: { 'Authorization': `Bearer ${ZERNIO_API_KEY}` } }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zernio list-reviews error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.reviews || [];
}

async function generateReply(review) {
  const rating = review.rating;
  const text = review.comment || '(no written review, star rating only)';
  const name = review.reviewer?.isAnonymous ? '' : review.reviewer?.displayName || '';

  const prompt = `A customer${name ? ` named ${name}` : ''} left a ${rating}-star review:\n\n"${text}"\n\nWrite the business owner reply.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: BRAND_VOICE },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function postReply(reviewId, comment) {
  const res = await fetch(
    `${ZERNIO_BASE}/v1/accounts/${ZERNIO_ACCOUNT_ID}/gmb-reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZERNIO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ comment })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zernio reply error ${res.status}: ${errText.slice(0, 300)}`);
  }

  return res.json();
}

async function run() {
  const reviews = await fetchReviews();
  const unreplied = reviews.filter(r => !r.reviewReply);

  if (unreplied.length === 0) {
    console.log('📭 No unreplied reviews found.');
    return;
  }

  console.log(`💬 Found ${unreplied.length} review(s) without a reply.\n`);
  const log = getRepliedLog();

  for (const review of unreplied) {
    const name = review.reviewer?.isAnonymous ? 'Anonymous' : (review.reviewer?.displayName || 'Customer');
    console.log(`⭐ ${review.rating}/5 — ${name}: "${review.comment || '(no text)'}"`);

    try {
      const replyText = await generateReply(review);
      console.log(`   ↳ Reply: ${replyText}`);

      await postReply(review.id, replyText);
      console.log('   ✅ Posted\n');

      log.push({
        reviewId: review.id,
        reviewer: name,
        rating: review.rating,
        reviewText: review.comment || '',
        replyText,
        repliedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`);
    }
  }

  fs.writeFileSync(REVIEWS_LOG_PATH, JSON.stringify(log, null, 2));
  console.log(`✅ Done. ${log.length} total replies logged.`);
}

run().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
