import { site } from '../data/site';
import { BREED_COUNT } from '../data/pricing';
import availablePuppies from '../data/available-puppies.json';
import heroImage from '../assets/home/1-cavapoo-puppy-hero-balestier.png';

// Absolute URL of the hero image as actually served (hashed under /_astro/).
const heroImageUrl = new URL(heroImage.src, site.domain).toString();

// Absolute URL of a page route. Mirrors the trailing slash that BaseLayout puts
// on the canonical and the sitemap emits, so schema @id/url values identify the
// same URL Google indexes. Only for routes — asset URLs must not gain a slash.
function pageUrl(path: string): string {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return new URL(withSlash, site.domain).toString();
}

// Offer.availability must match what the page actually shows. `available-puppies.json`
// is the live feed (written by `npm run sync:puppies`); a breed with an empty
// `available` array has its stock section rendering "recently placed" cards, so
// claiming InStock there is a structured-data claim the page does not support.
// Non-breed URLs (no feed entry) fall back to InStock — those are not stock-backed
// listings and the feed says nothing about them.
const puppyFeed = (availablePuppies as { breeds: Record<string, { available: unknown[] }> }).breeds;

function availabilityFor(path: string): string {
  const slug = path.replace(/^\/puppies\//, '').replace(/\/$/, '');
  // Not a breed page (the path did not change) — the feed says nothing about it.
  if (slug === path) return 'https://schema.org/InStock';
  // A breed page absent from the feed has no listings at all, same as an empty one.
  const entry = puppyFeed[slug];
  return entry && entry.available.length > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';
}

// Strip currency symbols, thousands separators, and prose ("From $3,288") so
// Offer.price is a bare numeric string — Google rejects anything else and
// flags "Invalid price format". Non-numeric inputs like "Included" become "0".
function toPriceValue(price: string): string {
  const numeric = price.replace(/[^0-9.]/g, '');
  return numeric || '0';
}

// A genuine 5-star Google review, reused as the representative review on each
// Product so it is eligible for the review-snippet rich result and clears the
// GSC "Missing field review" / "Missing field aggregateRating" recommendations.
const featuredReview = {
  author: 'Andrew Mak',
  reviewBody:
    "Couldn't recommend Curious Tails in Balestier enough after bringing home our puppy. Nelson and Kim gave us a clear care routine to follow, and clearly love what they do. We loved the aftercare support; you can tell they truly care about the pups and the owners. Will absolutely return and recommend without hesitation.",
  datePublished: '2024-07-01',
};

function productAggregateRating() {
  return {
    '@type': 'AggregateRating',
    ratingValue: site.reviews.rating,
    reviewCount: site.reviews.count,
    bestRating: '5',
    worstRating: '1',
  };
}

// Live animals aren't returnable; delivery is free and island-wide. Reused on
// every Product offer so GSC clears "Missing field hasMerchantReturnPolicy /
// shippingDetails".
function productReturnPolicy() {
  return {
    '@type': 'MerchantReturnPolicy',
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    applicableCountry: 'SG',
  };
}

function productShippingDetails() {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: '0',
      currency: 'SGD',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'SG',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 3,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 1,
        unitCode: 'DAY',
      },
    },
  };
}

function productReview() {
  return {
    '@type': 'Review',
    author: { '@type': 'Person', name: featuredReview.author },
    reviewBody: featuredReview.reviewBody,
    datePublished: featuredReview.datePublished,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: 5,
      bestRating: '5',
      worstRating: '1',
    },
  };
}

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'PetStore',
    '@id': `${site.domain}#business`,
    name: site.businessName,
    image: heroImageUrl,
    url: site.domain,
    telephone: `+65${site.phone}`,
    email: site.email,
    priceRange: site.priceRange,
    description: 'AVS-licensed puppy shop in Singapore offering Cavapoo, Maltipoo, Maltese, Mini Dachshund, Corgi, Shiba Inu, Bichonpoo, Bichon Frise, Cavapoochon, Chihuahua, and Cockapoo puppies with starter kit, free delivery, and training lessons included.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    areaServed: {
      '@type': 'City',
      name: 'Singapore',
    },
    openingHoursSpecification: site.hoursSpecification.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: [site.social.instagram, site.social.facebook, site.gbpUrl, site.license.registryUrl],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: site.reviews.rating,
      reviewCount: site.reviews.count,
      bestRating: '5',
      worstRating: '1',
    },
    founder: {
      '@type': 'Person',
      name: 'Nelson and Kim',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      telephone: `+65${site.phone}`,
      email: site.email,
      availableLanguage: ['en'],
    },
    knowsAbout: ['Puppy sales', 'Dog training', 'Pet care', 'Puppy health'],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.domain}#website`,
    name: site.businessName,
    url: site.domain,
    inLanguage: 'en-SG',
    publisher: { '@id': `${site.domain}#organization` },
  };
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.domain}#organization`,
    name: site.businessName,
    url: site.domain,
    logo: new URL('/logo.png', site.domain).toString(),
    sameAs: [site.social.instagram, site.social.facebook, site.gbpUrl],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      telephone: `+65${site.phone}`,
      email: site.email,
    },
  };
}

export function webPageSchema(opts: {
  path: string;
  title: string;
  description: string;
  aboutName: string;
  aboutAlternateName?: string;
  aboutSameAs?: string;
  datePublished?: string;
  dateModified?: string;
  // A more specific WebPage subtype where one applies, e.g. 'CollectionPage'
  // for a directory that lists other pages. Defaults to plain WebPage.
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage' | 'FAQPage';
}) {
  return {
    '@context': 'https://schema.org',
    '@type': opts.type ?? 'WebPage',
    '@id': pageUrl(opts.path),
    url: pageUrl(opts.path),
    name: opts.title,
    description: opts.description,
    isPartOf: { '@id': `${site.domain}#website` },
    publisher: { '@id': `${site.domain}#organization` },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    about: {
      '@type': 'Thing',
      name: opts.aboutName,
      ...(opts.aboutAlternateName ? { alternateName: opts.aboutAlternateName } : {}),
      ...(opts.aboutSameAs ? { sameAs: opts.aboutSameAs } : {}),
    },
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: pageUrl(item.url),
    })),
  };
}

export function serviceSchema(opts: { name: string; description: string; price?: string; image?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    provider: { '@id': `${site.domain}#business` },
    areaServed: { '@type': 'City', name: 'Singapore' },
    ...(opts.price ? { offers: { '@type': 'Offer', price: toPriceValue(opts.price), priceCurrency: 'SGD' } } : {}),
    ...(opts.image ? { image: opts.image } : {}),
  };
}

export function reviewSchema(opts: { author: string; reviewBody: string; ratingValue: number; datePublished?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'PetStore',
      '@id': `${site.domain}#business`,
      name: site.businessName,
      image: heroImageUrl,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.street,
        addressLocality: site.address.city,
        postalCode: site.address.postalCode,
        addressCountry: site.address.country,
      },
    },
    author: {
      '@type': 'Person',
      name: opts.author,
    },
    reviewBody: opts.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: opts.ratingValue,
      bestRating: '5',
      worstRating: '1',
    },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
  };
}

export function aggregateOfferSchema(opts: { priceLow: string; priceHigh: string; priceCurrency: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateOffer',
    priceCurrency: opts.priceCurrency,
    lowPrice: opts.priceLow,
    highPrice: opts.priceHigh,
    offerCount: BREED_COUNT, // live breed count (from src/data/pricing.ts)
  };
}

// Homepage catalog: one Offer per breed, each pointing at its breed page, so
// Google reads the homepage as the storefront and the breed pages as the items.
export function offerCatalogSchema(items: { name: string; url: string; priceLow: number; priceHigh: number }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: `${site.businessName} Puppies`,
    provider: { '@id': `${site.domain}#business` },
    itemListElement: items.map((item, i) => ({
      '@type': 'Offer',
      position: i + 1,
      url: pageUrl(item.url),
      priceCurrency: 'SGD',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: item.priceLow,
        maxPrice: item.priceHigh,
        priceCurrency: 'SGD',
      },
      itemOffered: { '@type': 'Product', '@id': pageUrl(item.url), name: item.name },
    })),
  };
}

export function faqPageSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function itemListSchema(items: { name: string; url: string; description?: string; price?: string; priceHigh?: string; image?: string }[]) {
  const products = items.map((item) => productEntity(item));
  // A breed page describes exactly ONE product. Wrapping a single Product in an
  // ItemList makes it a one-item carousel, which is not what Google renders a
  // price snippet from. Sister site puppysingapore.com/corgi/ earns a
  // "$3,688.00 to $5,500.00" rich result on the same query where this site earns
  // none (SERP pull, "corgi singapore", 2026-08-20) — so single-item pages emit
  // the Product on its own, and only genuine multi-item pages keep the ItemList.
  if (products.length === 1) {
    return { '@context': 'https://schema.org', ...products[0] };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: product,
    })),
  };
}

function productEntity(item: { name: string; url: string; description?: string; price?: string; priceHigh?: string; image?: string }) {
  return {
        '@type': 'Product',
        '@id': pageUrl(item.url),
        name: item.name,
        url: pageUrl(item.url),
        brand: { '@type': 'Brand', name: site.businessName },
        ...(item.description ? { description: item.description } : {}),
        // With priceHigh, emit the breed's real low-high band as an AggregateOffer
        // (matches the price table on the page); otherwise a single Offer.
        ...(item.price
          ? {
              offers: item.priceHigh
                ? {
                    '@type': 'AggregateOffer',
                    lowPrice: toPriceValue(item.price),
                    highPrice: toPriceValue(item.priceHigh),
                    priceCurrency: 'SGD',
                    availability: availabilityFor(item.url),
                    hasMerchantReturnPolicy: productReturnPolicy(),
                    shippingDetails: productShippingDetails(),
                  }
                : {
                    '@type': 'Offer',
                    price: toPriceValue(item.price),
                    priceCurrency: 'SGD',
                    availability: availabilityFor(item.url),
                    hasMerchantReturnPolicy: productReturnPolicy(),
                    shippingDetails: productShippingDetails(),
                  },
            }
          : {}),
        image: new URL(item.image ?? heroImageUrl, site.domain).toString(),
        aggregateRating: productAggregateRating(),
        review: productReview(),
  };
}

// Site-wide author entity: the same @id on every page so Google consolidates it (see SCHEMA.md 1b).
export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${site.domain}#owner`,
    name: 'Nelson and Kim',
    jobTitle: 'Owners, Curious Tails',
    description: 'AVS licensed pet shop owners with 2+ years operating in Balestier, Singapore, hands-on with breed matching, home deliveries, and post-purchase support.',
    worksFor: { '@id': `${site.domain}#business` },
    sameAs: [site.social.instagram, site.social.facebook],
  };
}

export function definedTermSchema(opts: { name: string; description: string; sameAs?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: opts.name,
    description: opts.description,
    ...(opts.sameAs ? { sameAs: opts.sameAs } : {}),
  };
}
