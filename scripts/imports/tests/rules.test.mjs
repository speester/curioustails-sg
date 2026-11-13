import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES_DIR, RULE_FILES, loadRules, lookup, findInText } from '../lib/rules.mjs';

const MAX_AGE_DAYS = 120;

for (const name of RULE_FILES) {
  test(`${name}.json validates and carries source_url + retrieved`, () => {
    const data = JSON.parse(readFileSync(join(RULES_DIR, `${name}.json`), 'utf8'));
    assert.equal(typeof data.source_url, 'string');
    assert.ok(data.source_url.length > 10);
    assert.match(data.retrieved, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(data.entries) && data.entries.length > 0);
    assert.equal(typeof data.aliases, 'object');
    for (const target of Object.values(data.aliases)) assert.ok(data.entries.includes(target), `alias target not an entry: ${target}`);
  });

  test(`${name}.json was retrieved within ${MAX_AGE_DAYS} days (quarterly re-check)`, () => {
    const { retrieved } = loadRules(name);
    const ageDays = (Date.now() - Date.parse(retrieved + 'T00:00:00Z')) / 86400000;
    assert.ok(ageDays <= MAX_AGE_DAYS, `${name}.json retrieved ${retrieved} is ${Math.floor(ageDays)} days old: re-check the source and update it`);
  });
}

test('HDB list contains Sheltie, Westie, JRT and Chihuahua; not Border Collie or Samoyed', () => {
  for (const b of ['Shetland Sheepdog', 'West Highland White Terrier', 'Jack Russell Terrier', 'Chihuahua']) {
    assert.ok(lookup('hdb-approved', b), `${b} should be HDB approved`);
  }
  for (const b of ['Border Collie', 'Samoyed']) assert.equal(lookup('hdb-approved', b), null, `${b} must not be HDB approved`);
  assert.equal(loadRules('hdb-approved').entries.length, 62);
});

test('prohibited aliases include every required token', () => {
  const required = ['pit bull', 'pitbull', 'amstaff', 'american staffordshire', 'staffordshire bull terrier', 'staffie', 'staffy',
    'american bulldog', 'bully', 'american bully', 'xl bully', 'pocket bully', 'akita', 'tosa', 'neapolitan mastiff',
    'dogo argentino', 'fila brasileiro', 'boerboel', 'presa canario'];
  const { aliases } = loadRules('prohibited');
  for (const r of required) assert.ok(aliases[r], `missing alias ${r}`);
  assert.ok(findInText('prohibited', 'Gorgeous XL Bully pups').length);
  assert.equal(findInText('prohibited', 'Jack Russell pups').length, 0);
});

test('specified list routes GSD and Cane Corso; scam patterns compile', () => {
  assert.ok(lookup('specified', 'German Shepherd'));
  assert.ok(findInText('specified', 'Cane Corso x pups'));
  for (const p of loadRules('scam-patterns').entries) {
    if (p.regex) assert.doesNotThrow(() => new RegExp(p.regex, 'i'));
    assert.match(p.severity, /^(review|reject)$/);
  }
});
