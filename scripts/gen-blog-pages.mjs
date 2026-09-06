#!/usr/bin/env node
// kit:gen-blog-pages@1.1.0 - emit blog posts from typed data.
// Usage: node --experimental-strip-types scripts/gen-blog-pages.mjs --check | --write
import fs from 'node:fs';
import path from 'node:path';
import { emit, rotateLink } from './lib/generate.mjs';

const write = process.argv.includes('--write');

// OWNERSHIP GATE. This generator emits src/pages/blog/*.astro from typed data. A project
// that hand-authors those pages owns them, and has no blog-content.ts by design - the
// static import used to kill the script at module load, so check:blog reported the
// command's failure and never the site's state. Detect it and stand down.
const DATA = 'src/data/blog-content.ts';
const handAuthored = !fs.existsSync(DATA)
  && fs.existsSync(path.join('src', 'pages', 'blog'))
  && fs.readdirSync(path.join('src', 'pages', 'blog')).some((f) => f.endsWith('.astro') && f !== 'index.astro');
// SECOND OWNERSHIP SHAPE (2026-09-05): the outer tier does not have to live under
// /blog/. On a silo site the guides sit at their pillar's path (/water-damage/how-fast-
// does-mold-grow/) and /blog/ is only their archive hub, so src/pages/blog holds nothing
// but index.astro. Reading that as "the blog tier exists nowhere on disk" failed a site
// whose entire outer tier is hand-authored and shipping. src/data/posts.ts naming built
// routes is the same ownership claim as a hand-authored src/pages/blog/*.astro.
const POSTS_TS = path.join('src', 'data', 'posts.ts');
// 'built: true' was one generator's field name. gen-posts.mjs writes the same ownership
// claim as an entry naming the page FILE on disk ("file": "src/pages/corgi-names.astro"),
// and reading only the first shape failed a site whose whole outer tier ships.
const postsText = fs.existsSync(POSTS_TS) ? fs.readFileSync(POSTS_TS, 'utf8') : '';
const OWNS = /built:\s*true/.test(postsText) || /["']file["']\s*:\s*["']src[^"']*pages/.test(postsText);
const handAuthoredElsewhere = !fs.existsSync(DATA) && fs.existsSync(POSTS_TS) && OWNS;
if (handAuthoredElsewhere && !handAuthored) {
  const n = (postsText.match(/built:\s*true/g) ?? postsText.match(/["']file["']\s*:\s*["']src[^"']*pages/g) ?? []).length;
  console.log('blog posts                   | ' + n + ' hand-authored pages at their pillar paths (src/data/posts.ts)');
  console.log(DATA.padEnd(28) + ' | PROJECT-OWNED (no ' + DATA + '; this generator is not in play)');
  console.log('PASS gen-blog-pages - nothing to generate');
  process.exit(0);
}
if (handAuthored) {
  const n = fs.readdirSync(path.join('src', 'pages', 'blog')).filter((f) => f.endsWith('.astro') && f !== 'index.astro').length;
  console.log('blog posts                   | ' + n + ' hand-authored .astro pages');
  console.log(DATA.padEnd(28) + ' | PROJECT-OWNED (no ' + DATA + '; this generator is not in play)');
  console.log('PASS gen-blog-pages - nothing to generate');
  process.exit(0);
}
if (!fs.existsSync(DATA)) {
  console.log('FAIL ' + DATA + ' missing and src/pages/blog carries no hand-authored pages either -');
  console.log('     the blog tier is declared in the blueprint and exists nowhere on disk.');
  process.exit(1);
}

// The registry module moved aside on projects that own src/data/site.ts (gen-registry.mjs).
const REG = fs.existsSync('src/data/registry.ts') ? '../src/data/registry.ts' : '../src/data/site.ts';
const { POSTS_CONTENT } = await import('../src/data/blog-content.ts');
const { HUBS } = await import(REG);

const esc = (s) => String(s).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const records = POSTS_CONTENT.map((p) => ({
  ...p,
  outPath: path.join('src', 'pages', 'blog', `${p.slug}.astro`),
}));

process.exit(emit({
  script: 'gen-blog-pages.mjs',
  records,
  write,
  render: (r, { index }) => {
    const link = rotateLink(index, HUBS, `/blog/${r.slug}/`);
    const headings = r.sections.map((s) => ({ id: s.id, label: s.heading }));
    return `---
import ArticleLayout from '../../layouts/ArticleLayout.astro';
import ProseSection from '../../components/ProseSection.astro';
import AnswerCapsule from '../../components/AnswerCapsule.astro';
import FAQ from '../../components/FAQ.astro';
const crumbs = [{ label: 'Home', href: '/' }, { label: 'Blog', href: '/blog/' }, { label: ${JSON.stringify(r.title)}, href: ${JSON.stringify(`/blog/${r.slug}/`)} }];
const headings = ${JSON.stringify(headings)};
---
<ArticleLayout
  title={${JSON.stringify(r.metaTitle)}}
  description={${JSON.stringify(r.metaDescription)}}
  kicker={${JSON.stringify(r.kicker ?? '')}}
  dek={${JSON.stringify(r.dek ?? '')}}
  crumbs={crumbs}
  headings={headings}
  pageFile={import.meta.url}
>
  <AnswerCapsule>{\`${esc(r.capsule)}\`}</AnswerCapsule>
${r.sections.map((s) => `  <ProseSection id=${JSON.stringify(s.id)} heading={\`${esc(s.heading)}\`}>
    <Fragment set:html={\`${esc(s.html)}\`} />
  </ProseSection>`).join('\n')}
${link ? `  <p class="template-link">Related: <a href=${JSON.stringify(link.href)}>{\`${esc(link.label)}\`}</a></p>` : ''}
  <FAQ slot="faq" items={${JSON.stringify(r.faq)}} />
</ArticleLayout>
`;
  },
}));
