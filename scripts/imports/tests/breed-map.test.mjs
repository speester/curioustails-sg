import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { BREED_MAP, PAGES_DIR, pageExists, resolveBreed } from '../lib/breed-map.mjs';

test("'Jack russel' resolves to jack-russell-terrier", () => {
  assert.deepEqual(resolveBreed('Jack russel'), { slug: 'jack-russell-terrier', crossLabel: null });
});

test("'Chihuahua, Yorkshire Terrier' resolves to chihuahua with a cross label", () => {
  assert.deepEqual(resolveBreed('Chihuahua, Yorkshire Terrier'), { slug: 'chihuahua', crossLabel: 'Chihuahua x Yorkshire Terrier' });
});

test("'Irish Setter' and 'Caucasian Shepherd Dog' are unmapped", () => {
  assert.equal(resolveBreed('Irish Setter').slug, null);
  assert.equal(resolveBreed('Caucasian Shepherd Dog').slug, null);
});

test('Irish aliases and misspellings', () => {
  const cases = {
    'jrt': 'jack-russell-terrier', 'Miniture Jack Russell': 'jack-russell-terrier', 'Dachund': 'mini-dachshund',
    'dashaund': 'mini-dachshund', 'Sausage Dog': 'mini-dachshund', 'West Highland White Terrier': 'westie', 'Westie': 'westie',
    'Shetland Sheepdog': 'sheltie', 'Sheltie': 'sheltie', 'Border Collie': 'border-collie', 'Samoyed': 'samoyed',
    'Poochon': 'bichonpoo', 'Cavoodle': 'cavapoo', 'Cockerpoo': 'cockapoo', 'Shih-Tzu': 'shih-tzu', 'Jack Russell Terrier (JRT)': 'jack-russell-terrier',
  };
  for (const [label, slug] of Object.entries(cases)) assert.equal(resolveBreed(label).slug, slug, label);
});

test('crosses map to the first parent that has a page', () => {
  assert.deepEqual(resolveBreed('Jack Russell x Chihuahua'), { slug: 'jack-russell-terrier', crossLabel: 'Jack Russell x Chihuahua' });
  assert.deepEqual(resolveBreed('Irish Setter x Poodle'), { slug: 'toy-poodle', crossLabel: 'Irish Setter x Poodle' });
  assert.deepEqual(resolveBreed('', 'Beagle', 'Jack Russell'), { slug: 'beagle', crossLabel: 'Beagle x Jack Russell' });
  assert.equal(resolveBreed('Shih Tzu x').crossLabel, 'Shih Tzu cross');
  assert.equal(resolveBreed('Pomapoo').crossLabel, 'Pomeranian x Poodle');
});

test('every slug in the map, and every slug returned, exists as a page file', () => {
  const pages = new Set(readdirSync(PAGES_DIR).filter((f) => f.endsWith('.astro')).map((f) => f.replace(/\.astro$/, '')));
  for (const [label, slug] of Object.entries(BREED_MAP)) assert.ok(pages.has(slug), `${label} → ${slug} has no src/pages/puppies/${slug}.astro`);
  for (const label of [...Object.keys(BREED_MAP), 'Chihuahua, Yorkshire Terrier', 'Jack russel', 'Irish Setter x Poodle']) {
    const { slug } = resolveBreed(label);
    if (slug) assert.ok(pageExists(slug), slug);
  }
});

test('dogquest space-less slugs resolve like their spaced labels', () => {
  assert.equal(resolveBreed('jackrussellterrier').slug, 'jack-russell-terrier');
  assert.equal(resolveBreed('x', 'yorkshireterrier').slug, 'yorkshire-terrier');
  assert.equal(resolveBreed('goldenretriever').slug, resolveBreed('golden retriever').slug);
  assert.equal(resolveBreed('irishsetter').slug, null);
});
