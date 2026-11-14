// K-145: build the channel-join preview page (_k132_stage/index.html) from ONE array.
//
//   node scripts/k145-build-channel-stage.mjs
//
// Two self-contained sections, one per channel. CHANNELS decides the order: reorder
// the array and the page flips. The phone demo always goes to the FIRST section and
// the still post strip to the second, so a flip never clones the animation.
// The strip photos are cut once from src/assets/live into _k132_stage (sharp).
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = path.join(ROOT, '_k132_stage');
const GA_ID = 'G-S1WGGDQKQ4'; // src/data/site.ts ga4MeasurementId
const UTM = 'utm_source=website&utm_medium=channel_section&utm_campaign=channel_join';

// Telegram first: the channel observed to be alive (public t.me/s preview, 14 Nov 2026: two posts a
// day); the WhatsApp channel shows no post dates. Driven by posting activity, not preference (K-145).
const CHANNELS = ['telegram', 'whatsapp'];

const CH = {
  whatsapp: {
    ch: 'wa',
    url: 'https://www.whatsapp.com/channel/0029VaDo1HT9WtCCFm6zUn3b',
    title: 'Follow us on WhatsApp, the app you already have',
    sub: 'It is already on your phone. One tap on Follow and our puppy posts start arriving in your Updates tab. No new app to install, no new account to make.',
    stkName: 'WhatsApp',
    stkAction: 'Follow the channel',
    demoNote: 'The phone shows a WhatsApp channel post with a puppy photo, breed, price, gender, age and puppy ID, then a tap on Follow and a tap on the bell to turn notifications on.',
  },
  telegram: {
    ch: 'tg',
    url: 'https://t.me/puppysingapore',
    title: 'Prefer Telegram? Every post leads with the photo',
    sub: 'Each puppy lands photo first, and a tap opens it full-size. Joining shares nothing personal with other members, and you can leave whenever you like.',
    stkName: 'Telegram',
    stkAction: 'Join the channel',
    demoNote: 'The phone shows a Telegram channel post with a puppy photo, breed, price, gender, age and puppy ID, then a tap on Join and a tap on the bell to turn notifications on.',
  },
};

// Sample posts for the still strip, taken from real listings (src/data/available-puppies.json).
const SAMPLES = [
  { id: 2899, src: '2899-1-82f949fd.webp', breed: 'Cockapoo', gender: 'Male', age: '3 months', price: 'S$3,488', time: '10:08' },
  { id: 2954, src: '2954-1-494c6ce2.webp', breed: 'Cavachon', gender: 'Male', age: '2 months', price: 'S$4,288', time: '12:08' },
  { id: 3010, src: '3010-1-fbe5464d.webp', breed: 'Maltese', gender: 'Female', age: '', price: 'S$4,488', time: '18:08' },
];

const exists = (p) => access(p).then(() => true, () => false);

async function cutStripPhotos() {
  for (const s of SAMPLES) {
    const out = path.join(STAGE, `post-${s.id}.webp`);
    if (await exists(out)) continue;
    await sharp(path.join(ROOT, 'src/assets/live', s.src))
      .resize(320, 360, { fit: 'cover', position: 'attention' })
      .webp({ quality: 62 })
      .toFile(out);
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sticker(key) {
  const c = CH[key];
  const href = `${c.url}?${UTM}&utm_content=section_${key}`;
  return `      <div class="cj-stickers">
        <a class="cj-stk ${c.ch}" href="${esc(href)}" target="_blank" rel="noopener" data-cj-channel="${key}" data-cj-section="section_${key}">
          <span class="cj-stk-sh" aria-hidden="true"></span>
          <span class="cj-stk-face">
            <span class="cj-stk-ico" aria-hidden="true"><svg><use href="#i-${c.ch}"/></svg></span>
            <span class="cj-stk-txt"><b>${c.stkName}</b><small>${c.stkAction}</small></span>
          </span>
        </a>
      </div>`;
}

function phoneDemo(key) {
  const c = CH[key];
  return `    <div class="cj-demo">
      <p class="cj-sr">${esc(c.demoNote)}</p>
      <div class="cj-phone" aria-hidden="true">
        <div class="cj-screen">
          <div class="cj-status"><span>9:41</span><span><i></i><i></i></span></div>
          <div class="cj-head">
            <svg class="cj-back"><use href="#i-back"/></svg>
            <span class="cj-ava"><svg><use href="#i-paw"/></svg></span>
            <span class="cj-name"><b>Puppy Singapore</b><small><span data-show="tg">channel</span><span data-show="wa">Channel</span></small></span>
            <span class="cj-bell">
              <span class="cj-bell-off"><svg><use href="#i-bell-off"/></svg></span>
              <span class="cj-bell-on"><svg><use href="#i-bell-on"/></svg></span>
            </span>
          </div>

          <div class="cj-feed">
            <div class="cj-day">Today</div>
            <div class="cj-post">
              <img src="puppy-2950.webp" width="480" height="643" alt="" decoding="async">
              <div class="cj-cap">
                <div><b>Maltipoo</b> · Male · 2 months</div>
                <div class="cj-price">S$3,888</div>
                <div class="cj-meta"><span>Puppy ID 2950</span><time>10:24</time></div>
              </div>
            </div>
          </div>

          <div class="cj-toast"><i><svg><use href="#i-check"/></svg></i><span><span data-show="tg">Joined.</span><span data-show="wa">Following.</span> Notifications are on.</span></div>

          <div class="cj-bar">
            <div class="cj-cta">
              <span class="cj-cta-a"><span data-show="tg">JOIN</span><span data-show="wa">Follow</span><i class="cj-press"></i></span>
              <span class="cj-cta-b"><svg><use href="#i-check"/></svg><span data-show="tg">Joined</span><span data-show="wa">Following</span></span>
            </div>
          </div>

          <span class="cj-rip cj-rip-join"></span>
          <span class="cj-rip cj-rip-bell"></span>
          <span class="cj-tap"></span>
        </div>
      </div>
    </div>`;
}

function postStrip() {
  const cards = SAMPLES.map((s) => `          <li class="cj-sp">
            <img src="post-${s.id}.webp" width="320" height="360" alt="${esc(`${s.breed} puppy, ${s.gender.toLowerCase()}, puppy ID ${s.id}`)}" loading="lazy" decoding="async">
            <div class="cj-sp-cap">
              <div><b>${s.breed}</b></div>
              <div>${[s.gender, s.age].filter(Boolean).join(' · ')}</div>
              <div class="cj-sp-price">${s.price}</div>
              <div class="cj-sp-meta"><span>Puppy ID ${s.id}</span><time>${s.time}</time></div>
            </div>
          </li>`).join('\n');
  return `    <figure class="cj-strip">
      <figcaption class="cj-strip-label">What a post looks like</figcaption>
      <ul class="cj-strip-row">
${cards}
      </ul>
      <p class="cj-strip-note">Sample posts, taken from recent listings.</p>
    </figure>`;
}

function section(key, i) {
  const c = CH[key];
  const proof = i === 0 ? phoneDemo(key) : postStrip();
  return `<!-- ===================== section_${key} ===================== -->
<section class="cj" id="section_${key}" aria-labelledby="cj-${c.ch}-title">
  <div class="cj-k132 ${i === 0 ? 'cj-has-demo' : 'cj-has-strip'}" data-ch="${c.ch}">

    <div class="cj-copy">
      <h2 class="cj-title" id="cj-${c.ch}-title">${esc(c.title)}</h2>
      <p class="cj-sub">${esc(c.sub)}</p>
${sticker(key)}
    </div>

${proof}

  </div>
</section>`;
}

// Icon sprite, copied verbatim from the K-132 page.
const ICONS = (await readFile(path.join(ROOT, 'scripts/k145-channel-icons.svg'), 'utf8')).trim();

// Same hostname guard as src/layouts/BaseLayout.astro: only curioustails.sg reaches the
// property. ?ga_test=1 is the one opt-in, for DebugView checks: it lifts the flag for this
// page view and marks every hit debug_mode with environment=staging. With the flag set the
// library is not even fetched, so a plain staging view makes no GA request at all.
const GA = `<script>
(function () {
  var id = '${GA_ID}';
  var prod = /^(www\\.)?curioustails\\.sg$/.test(location.hostname);
  var test = /[?&]ga_test=1(&|$)/.test(location.search);
  window.cjEnv = prod ? 'production' : 'staging';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  if (!prod && !test) { window['ga-disable-' + id] = true; return; }
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', id, test ? { debug_mode: true } : {});
})();
</script>`;

async function main() {
  await cutStripPhotos();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Channel Join Sections</title>
${GA}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;600;800&display=swap">
<link rel="stylesheet" href="channel-join.css">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: #fff; color: var(--cj-ink); font: 16px/1.5 var(--cj-font-body); }
  .pv-bar { max-width: 1180px; margin: 0 auto; padding: 14px 16px; font-size: 13px; color: var(--cj-ink-soft); display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .pv-bar b { color: var(--cj-ink); }
  .pv-wrap { max-width: 1180px; margin: 0 auto; padding: 8px 16px 64px; display: grid; gap: 28px; }
  .pv-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; margin: -1px; }
</style>
</head>
<body>

${ICONS}

<div class="pv-bar"><b>K-145 preview</b><span>Channel join sections for Curious Tails, one per channel. Staging only, not indexed.</span></div>
<h1 class="pv-sr">Channel join sections preview</h1>

<main class="pv-wrap">

${CHANNELS.map(section).join('\n\n')}

</main>

<script src="channel-join.js" defer></script>
</body>
</html>
`;
  await writeFile(path.join(STAGE, 'index.html'), html);
  console.log('wrote _k132_stage/index.html, order:', CHANNELS.join(' > '));
}

main().catch((e) => { console.error(e); process.exit(1); });
