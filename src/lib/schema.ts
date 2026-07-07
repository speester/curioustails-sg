import { site } from '../data/site';
import heroImage from '../assets/home/1-cavapoo-puppy-hero-balestier.png';

// Absolute URL of the hero image as actually served (hashed under /_astro/).
const heroImageUrl = new URL(heroImage.src, site.domain).toString();

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
    description: 'AVS-licensed puppy shop in Singapore offering Cavapoo, Maltipoo, Mini Dachshund, Corgi, Shiba Inu, Bichonpoo, and Cockapoo puppies with starter kit, free delivery, and training lessons included.',
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
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': new URL(opts.path, site.domain).toString(),
    url: new URL(opts.path, site.domain).toString(),
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
      item: new URL(item.url, site.domain).toString(),
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
    ...(opts.price ? { offers: { '@type': 'Offer', price: opts.price, priceCurrency: 'SGD' } } : {}),
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
    offerCount: 7, // 7 breeds
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

export function itemListSchema(items: { name: string; url: string; description?: string; price?: string; image?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        '@id': new URL(item.url, site.domain).toString(),
        name: item.name,
        url: new URL(item.url, site.domain).toString(),
        brand: { '@type': 'Brand', name: site.businessName },
        ...(item.description ? { description: item.description } : {}),
        ...(item.price ? { offers: { '@type': 'Offer', price: item.price, priceCurrency: 'SGD', availability: 'https://schema.org/InStock' } } : {}),
        ...(item.image ? { image: new URL(item.image, site.domain).toString() } : {}),
      },
    })),
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
