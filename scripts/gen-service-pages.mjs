#!/usr/bin/env node
// kit:gen-service-pages@1.0.0 — emit service/item pages from typed data.
// Usage: node --experimental-strip-types scripts/gen-service-pages.mjs --check | --write
import path from 'node:path';
import { emit, rotateLink } from './lib/generate.mjs';
import { SERVICES } from '../src/data/service-content.ts';
import { DEPTH } from '../src/data/service-depth.ts';
import { HUBS } from '../src/data/site.ts';

const write = process.argv.includes('--write');
const esc = (s) => String(s).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const records = SERVICES.map((s) => ({
  ...s,
  slug: s.slug,
  outPath: path.join('src', 'pages', 'services', `${s.slug}.astro`),
  depth: DEPTH[s.slug] ?? { pitfalls: [], extraSections: [] },
}));

process.exit(emit({
  script: 'gen-service-pages.mjs',
  records,
  write,
  render: (r, { index }) => {
    const link = rotateLink(index, HUBS, `/services/${r.slug}/`);
    const headings = [...r.sections, ...(r.depth.extraSections ?? [])]
      .map((sec) => ({ id: sec.id, label: sec.heading }));
    return `---
import ArticleLayout from '../../layouts/ArticleLayout.astro';
import Section from '../../components/Section.astro';
import AnswerCapsule from '../../components/AnswerCapsule.astro';
import FAQ from '../../components/FAQ.astro';
const crumbs = [{ label: 'Home', href: '/' }, { label: 'Services', href: '/services/' }, { label: ${JSON.stringify(r.title)}, href: ${JSON.stringify(`/services/${r.slug}/`)} }];
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
${[...r.sections, ...(r.depth.extraSections ?? [])].map((sec) => `  <Section treatment=${JSON.stringify(sec.treatment ?? 'callout')} id=${JSON.stringify(sec.id)}>
    <h2 id=${JSON.stringify(sec.id)}>{\`${esc(sec.heading)}\`}</h2>
    <Fragment set:html={\`${esc(sec.html)}\`} />
  </Section>`).join('\n')}
${link ? `  <p class="template-link">Related: <a href=${JSON.stringify(link.href)}>{\`${esc(link.label)}\`}</a></p>` : ''}
  <FAQ slot="faq" items={${JSON.stringify(r.faq)}} />
</ArticleLayout>
`;
  },
}));
