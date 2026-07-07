# Schema Markup Guidelines

This document defines the schema markup standards for all pages on Curious Tails. Comprehensive schema improves SEO visibility, local pack rankings, and knowledge graph presence.

## Core Schema Stack (Every Page)

Every page must include these base schemas:

### 1. LocalBusiness or Organization
Use `localBusinessSchema()` on pages serving the primary business entity. Includes:
- `@id` for entity identification
- `aggregateRating` with all rating values
- `address`, `telephone`, `email`
- `openingHoursSpecification` for temporal relevance
- `areaServed` (Singapore)
- `founder` (Nelson and Kim)
- `contactPoint` for customer service
- `knowsAbout` for domain expertise
- `sameAs` (REQUIRED — entity/knowledge-panel building): array of
  - GBP URL
  - Instagram profile
  - Facebook profile
  - **AVS public registry URL** (https://avs.nparks.gov.sg/outreach/resources/public-registry-of-avs-licensed-pet-shops/) — a government page listing the business is the strongest entity signal available; never omit it

**When to use:** Home, Contact, About, Service listing pages

### 1b. Person (Author Entity) — site-wide
Every content page (breed, guide, blog) must have a visible byline AND a `Person` schema:
- One shared `@id` (e.g. `domain + '#owner'`) reused on EVERY page — Google consolidates the author entity only if the `@id` is identical site-wide
- `name` (Nelson and Kim), `jobTitle`, credentials in `hasCredential` or `description` (AVS licensed pet shop owners)
- `sameAs`: Instagram, Facebook
- `worksFor: { '@id': domain + '#business' }`
- Reference from the page via `author: { '@id': domain + '#owner' }` on WebPage/Article schema

### 2. WebPage Schema
Use `webPageSchema()` with these additions:
- `@id` for page identification
- `isPartOf: { '@id': domain + '#website' }` linking to site
- `publisher` reference (organization `@id`)
- `datePublished` (ISO format: YYYY-MM-DD)
- `dateModified` (update each deploy)
- `about` with `@type: Thing` for the topic

**When to use:** Every page

### 3. BreadcrumbList
Use `breadcrumbSchema()` with hierarchical path:
- Home is always position 1
- Current page is last item
- Improves SERP navigation signals

**When to use:** Multi-level pages (breed pages, category pages, blog)

---

## Specialized Schemas (Add as Relevant)

### Service Schema
Use `serviceSchema()` for offerings:
- Training lessons, delivery, aftercare support
- Include `price` and `priceCurrency: 'SGD'`
- Reference `provider: { '@id': domain + '#business' }`
- Set `areaServed: { '@type': 'City', name: 'Singapore' }`

**Use cases:** Service descriptions, offerings, included benefits

### Review Schema
Use `reviewSchema()` for testimonials:
- `author.name` (customer name)
- `reviewBody` (actual quote)
- `ratingValue` (1-5 integer)
- `datePublished` (ISO format)
- Improves local pack visibility

**Use cases:** Customer testimonials, case studies

### Product/ItemList Schema
Use `itemListSchema()` for breed listings:
- Include `brand`, `price`, `image`, `description`
- `offers.availability` set to `InStock`
- `priceCurrency: 'SGD'` required

**Use cases:** Breed cards, product comparisons, inventory listings

### AggregateOffer Schema
Use `aggregateOfferSchema()` for pricing tiers:
- `priceLow` and `priceHigh` as strings (e.g., '2888')
- `offerCount` (number of variations)
- `priceCurrency: 'SGD'`

**Use cases:** Price range displays, multiple SKUs

### FAQPage Schema
Use `faqPageSchema()` for Q&A sections:
- Each question becomes a `Question` entity
- Must have `acceptedAnswer` with `Answer` type
- Enables Google FAQ rich snippets

**Use cases:** FAQ sections, objection handling

### DefinedTerm Schema
Use `definedTermSchema()` for concepts:
- Glossary terms, industry definitions
- `sameAs` links to authoritative sources (AVS, HDB, etc.)
- Helps knowledge graph recognition

**Use cases:** "What is AVS licensed pet shop?", breed definitions

---

## Breed Page Schema Example

```javascript
// /puppies/[breed].astro

const schemas = [
  localBusinessSchema(),
  organizationSchema(),
  webPageSchema({
    path: `/puppies/${breed}`,
    title: `${breed} puppy for sale Singapore`,
    description: '...',
    aboutName: `${breed} puppies`,
    datePublished: '2024-01-15',
    dateModified: new Date().toISOString().split('T')[0],
  }),
  breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Puppies', url: '/#puppies' },
    { name: breed, url: `/puppies/${breed}` },
  ]),
  itemListSchema([
    {
      name: `${breed} puppy available`,
      url: `/puppies/${breed}`,
      price: 'From $2,888',
      image: '...',
      description: 'Temperament, suitability, characteristics',
    },
  ]),
  reviewSchema({ ... }), // If breed has testimonials
  faqPageSchema(breedFaqItems),
];
```

---

## Local/Informational Page Schema Example

```javascript
// /first-time-owners/hdb-breeds.astro

const schemas = [
  organizationSchema(),
  webPageSchema({
    path: '/first-time-owners/hdb-breeds',
    title: 'HDB-Approved Dog Breeds Singapore',
    description: '...',
    aboutName: 'HDB dog breed rules',
    datePublished: '2024-02-01',
    dateModified: new Date().toISOString().split('T')[0],
  }),
  breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'First-Time Owners', url: '/first-time-owners' },
    { name: 'HDB Breeds', url: '/first-time-owners/hdb-breeds' },
  ]),
  faqPageSchema(hdbFaqItems),
  definedTermSchema({
    name: 'HDB dog ownership rules',
    description: '...',
    sameAs: 'https://www.hdb.gov.sg/residential/living-in-an-hdb-flat/pets',
  }),
];
```

---

## Best Practices Checklist

**For Every Page:**
- [ ] WebPage schema with `datePublished` and `dateModified`
- [ ] BreadcrumbList for navigation hierarchy
- [ ] Appropriate `@id` for entity identification
- [ ] `priceCurrency: 'SGD'` on all monetary values
- [ ] Date formats as ISO YYYY-MM-DD
- [ ] `areaServed: { '@type': 'City', name: 'Singapore' }` for local relevance

**For Product/Service Pages:**
- [ ] Product schema includes `brand`, `image`, `price`, `availability`
- [ ] Service schema references provider `@id`
- [ ] AggregateOffer for price ranges

**For Content Pages:**
- [ ] DefinedTerm schema for key concepts
- [ ] FAQ schema for Q&A sections
- [ ] Review schema for testimonials
- [ ] External `sameAs` links to authoritative sources

**For SEO Impact:**
- [ ] Verify schema in [Google's Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Check [Schema.org documentation](https://schema.org) for allowed properties
- [ ] Use `@id` and schema references to establish entity relationships
- [ ] Always include `dateModified` (update on each page change)

---

## Schema Validation

Before deploying, validate schema:

```bash
# Check rendered schema on local dev server
curl -s http://localhost:4321/ | grep -A5 '"@type"'

# Or test in Google Rich Results Test
# https://search.google.com/test/rich-results
```

---

## Common Mistakes to Avoid

❌ **Don't:**
- Use generic Product for breeds (be specific with descriptions)
- Forget `priceCurrency` on price fields
- Use future dates for `datePublished`
- Omit `aggregateRating` on business/review entities
- Reference undefined schema properties

✅ **Do:**
- Link schemas with `@id` references for entity relationships
- Include `sameAs` to external authoritative sources
- Use ISO date formats consistently
- Add `dateModified` on every page deploy
- Test in Google Rich Results before publishing

---

## Future Page Checklist

When creating a new page:

1. **Determine page type** → Transactional, informational, or hybrid?
2. **Choose base schemas** → localBusiness/Organization + WebPage + Breadcrumb
3. **Add specialized schemas** → Review, Service, Product, FAQ, DefinedTerm as needed
4. **Set dates** → `datePublished` (creation) and `dateModified` (today)
5. **Include @id** → Enable entity relationships across site
6. **Add SGD currency** → All price fields
7. **Verify** → Google Rich Results Test before merge
