/**
 * Generates an Astro blog file from structured content.
 * Matches the pattern of existing blogs (first-time-mistakes.astro, cavapoo-vs-maltipoo.astro, etc.)
 */

export function generateBlogAstroFile({
  title,
  description,
  slug,
  h1,
  datePublished,
  content,
  faqItems = [],
  images = [],
}) {
  // Validate inputs
  if (!title || !description || !slug || !h1 || !datePublished) {
    throw new Error('Missing required blog metadata: title, description, slug, h1, datePublished');
  }

  if (!content || !content.intro || !content.sections || content.sections.length === 0) {
    throw new Error('Missing required content: intro and sections');
  }

  if (images.length === 0) {
    throw new Error('At least one image is required');
  }

  // Generate import statements for images
  const imageImports = images
    .map((img, idx) => {
      const varName = `image${idx + 1}`;
      // Image URL is already in correct format (../../assets/...) from image-gen or placeholders
      return `import ${varName} from '${img.url}';`;
    })
    .join('\n');

  // Generate FAQ items JavaScript with proper escaping
  const faqItemsJS = JSON.stringify(faqItems, null, 2);

  // Generate schema variable
  const schemasJS = `const schemas = [
  localBusinessSchema(),
  personSchema(),
  webPageSchema({
    path: '/blog/${slug}',
    title,
    description,
    aboutName: '${h1.replace(/'/g, "\\'")}',
    datePublished,
    dateModified: new Date().toISOString().split('T')[0],
  }),
  faqPageSchema(faqItems),
];`;

  // Generate DefBox section
  const introText = content.intro || 'Discover essential insights about puppy ownership.';
  const defBoxSection = `<DefBox
    term="${h1.replace(/"/g, '&quot;')}"
    definition="${introText.slice(0, 150).replace(/"/g, '&quot;')}..."
    bridge="These insights come from two years of real placements in Singapore homes."
    citationLabel="Learn from Curious Tails' experience"
  >
  </DefBox>`;

  // Generate CaptionedBlock sections (alternate left/right image positioning)
  const captionedBlocks = content.sections
    .slice(0, 5) // Limit to 5 sections like existing blogs
    .map((section, idx) => {
      const imagePosition = idx % 2 === 0 ? 'right' : 'left';
      const imageIdx = Math.min(idx, images.length - 1);
      const varName = `image${imageIdx + 1}`;

      return `<CaptionedBlock
    heading="${section.heading.replace(/"/g, '&quot;')}"
    imageSrc={${varName}}
    imageAlt="${section.imageAlt || section.heading}"
    imagePosition="${imagePosition}"
  >
    <p class="text-sm leading-relaxed text-[var(--color-cream-700)]">
      ${section.body.slice(0, 200).replace(/"/g, '&quot;')}...
    </p>
  </CaptionedBlock>`;
    })
    .join('\n\n  ');

  // Generate the full Astro file
  const astroContent = `---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Breadcrumb from '../../components/Breadcrumb.astro';
import DefBox from '../../components/DefBox.astro';
import CaptionedBlock from '../../components/CaptionedBlock.astro';
import BannerRibbon from '../../components/BannerRibbon.astro';
import FinalCta from '../../components/FinalCta.astro';
import FAQ from '../../components/FAQ.astro';
import Schema from '../../components/Schema.astro';
import PawTrail from '../../components/decor/PawTrail.astro';
import { site, whatsappLink } from '../../data/site';
import { localBusinessSchema, personSchema, webPageSchema, faqPageSchema } from '../../lib/schema';
${imageImports}

const title = '${title.replace(/'/g, "\\'")}';
const description = '${description.replace(/'/g, "\\'")}';
const datePublished = '${datePublished}';

const faqItems = ${faqItemsJS};

${schemasJS}
---

<BaseLayout {title} {description} canonicalPath="/blog/${slug}">
  <section class="bg-[var(--color-peach-100)] pb-10 pt-2">
    <div class="mx-auto max-w-[1400px] px-5 sm:px-8 pt-5">
      <Breadcrumb bare items={[{ label: 'Blog', href: '/blog' }, { label: '${h1.replace(/['"]/g, '')}', href: '/blog/${slug}' }]} />
      <div class="mx-auto mt-8 max-w-[75ch]">
        <p class="text-xs font-bold uppercase text-[var(--color-coral-600)]" style="letter-spacing: 0.08em;">Blog · Puppy Insights</p>
        <h1 class="mt-3 font-[family-name:var(--font-heading)] font-semibold leading-[1.08] text-[var(--color-cream-900)]" style="font-size: clamp(2.2rem, 4.5vw, 3.5rem);">
          ${h1}
        </h1>
        <p class="mt-4 text-sm text-[var(--color-cream-600)]">
          By <a href="/about-us" class="font-semibold underline underline-offset-2 text-[var(--color-accent-hover)]">Nelson &amp; Kim</a>, Curious Tails · Published ${datePublished}
        </p>
      </div>
    </div>
  </section>

  ${defBoxSection}

  ${captionedBlocks}

  <PawTrail bg="bg-[var(--color-surface)]" colorClass="text-[var(--color-coral-300)]" />

  <div id="faq" class="scroll-mt-40">
    <FAQ heading="Common Questions" items={faqItems} />
  </div>

  <FinalCta
    breed="Puppy"
    heading="Ready to meet your perfect match?"
    body="Our team can help you find the right puppy for your home."
    reserveMessage="Let's find your puppy"
  />

  <Schema {schemas} />
</BaseLayout>
`;

  return astroContent;
}

/**
 * Sanitize filename from slug
 */
export function sanitizeFilename(slug) {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
