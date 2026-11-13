// Fixture builders for orchestrator-level tests (T15/T16). Not a test file.
// Same shapes as sync-imports.test.mjs: a temp repo, a temp private store and
// a clean private record whose images are already processed. No network.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../lib/store.mjs';
import { publicIds } from '../lib/hash.mjs';

export const NOW = new Date('2026-11-13T06:15:00Z');
export const CHIPS = ['372112345678901', '372112345678902', '372112345678903'];
export const SELLER_PHONE = '0861234567';
export const SELLER_NAME = 'Siobhan Kearney';

export function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ct-imports-repo-'));
  mkdirSync(join(dir, 'src', 'data'), { recursive: true });
  mkdirSync(join(dir, 'src', 'assets', 'imported'), { recursive: true });
  return dir;
}

export function tempStore() {
  return openStore({ dir: mkdtempSync(join(tmpdir(), 'ct-imports-store-')) });
}

export function cleanup(...dirs) {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

export function cleanRecord(store, over = {}) {
  const supplier = over.supplier || 'dogsy';
  const listingId = over.listingId || 'clean-1';
  const id = publicIds(store.secret(), supplier, listingId).id;
  const chips = over.chips || CHIPS;
  delete over.chips;
  return {
    key: `${supplier}:${listingId}`,
    supplier,
    viaSite: 'irishpuppies.ie',
    listingId,
    sourceUrl: `https://dogsy.ie/dogs-for-sale/${listingId}.html`,
    fetchedAt: '2026-11-13T06:00:00.000Z',
    firstSeenAt: '2026-11-01T00:00:00.000Z',
    lastSeenAt: '2026-11-13T06:00:00.000Z',
    sourcePublishedAt: '2026-11-01T00:00:00.000Z',
    title: 'Beautiful Jack Russell Terrier puppies',
    descriptionRaw: 'Healthy Jack Russell Terrier puppies, wormed, vaccinated and microchipped, looking for loving homes.',
    breedRaw: 'Jack Russell Terrier',
    priceRaw: '€550',
    priceNumber: 550,
    currency: 'EUR',
    dob: '2026-09-04',
    ageRaw: '10 weeks',
    maleCount: 2,
    femaleCount: 1,
    puppies: chips.map((microchip) => ({ sex: 'M', colour: 'Tan & White', price: 550, microchip, chipVerified: null, status: 'For Sale' })),
    county: 'Kildare',
    town: 'Naas',
    countryOfOrigin: 'Ireland',
    seller: { name: SELLER_NAME, phone: SELLER_PHONE },
    imageSourceUrls: ['https://dogsy.ie/storage/ad-media/a.jpg', 'https://dogsy.ie/storage/ad-media/b.jpg', 'https://dogsy.ie/storage/ad-media/c.jpg'],
    images: [
      { filename: `${id}-1.webp`, cardFilename: `${id}-1-card.webp`, dhash: over.dhashBase ? `${over.dhashBase}1` : '0000000000000001' },
      { filename: `${id}-2.webp`, cardFilename: `${id}-2-card.webp`, dhash: over.dhashBase ? `${over.dhashBase}2` : '1111111111111111' },
      { filename: `${id}-3.webp`, cardFilename: `${id}-3-card.webp`, dhash: over.dhashBase ? `${over.dhashBase}3` : '2222222222222222' },
    ],
    flags: { wormed: true, vaccinated: true },
    sourceStatus: 'live',
    status: null,
    reviewReasons: [],
    missingRuns: 0,
    ...over,
  };
}

// Processed WebPs live in the private images-processed/ stage until published.
export function seed(store, records, extraState = {}) {
  const stageDir = store.path('images-processed');
  mkdirSync(stageDir, { recursive: true });
  for (const r of records) {
    for (const img of r.images || []) {
      if (img.filename) writeFileSync(join(stageDir, img.filename), Buffer.from('processed-webp'));
      if (img.cardFilename) writeFileSync(join(stageDir, img.cardFilename), Buffer.from('processed-webp'));
    }
  }
  store.writeJson('imports-state.json', {
    version: 1, firstRunAt: '2026-11-01T00:00:00.000Z', lastRunAt: null, runs: 1,
    records: Object.fromEntries(records.map((r) => [r.key, r])),
    suppressed: [], published: {}, supplierStats: {},
    ...extraState,
  });
}

export const idOf = (store, rec) => publicIds(store.secret(), rec.supplier, rec.listingId).id;

// Log/console check used by the owner-action tests (same patterns as K-086).
export const PII_PATTERNS = {
  url: /https?:\/\/|www\./i,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  microchip: /(?<!\d)\d{15}(?!\d)/,
  phone: /(?<!\d)(?:\+?353|0)8\d[\s-]?\d{3}[\s-]?\d{4}(?!\d)/,
};
