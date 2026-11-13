// Loads the dated rules files (scripts/imports/rules/*.json) and answers
// "is this breed label on list X?" using the verbatim entries plus aliases.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'rules');
export const RULE_FILES = ['prohibited', 'specified', 'hdb-approved', 'scam-patterns'];

const cache = new Map();
export function loadRules(name) {
  if (!cache.has(name)) cache.set(name, JSON.parse(readFileSync(join(RULES_DIR, `${name}.json`), 'utf8')));
  return cache.get(name);
}

export const normLabel = (s) =>
  String(s ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

// Exact match on a verbatim entry (parentheticals ignored) or an alias.
export function lookup(list, label) {
  const rules = typeof list === 'string' ? loadRules(list) : list;
  const n = normLabel(label);
  if (!n) return null;
  const entry = rules.entries.find((e) => typeof e === 'string' && (normLabel(e) === n || e.toLowerCase() === String(label).toLowerCase()));
  if (entry) return entry;
  return rules.aliases?.[n] ?? null;
}

// Any alias appearing as a whole phrase inside free text (titles, breed strings).
export function findInText(list, text) {
  const rules = typeof list === 'string' ? loadRules(list) : list;
  const n = ` ${normLabel(text)} `;
  const hits = new Set();
  for (const [alias, entry] of Object.entries(rules.aliases ?? {})) if (n.includes(` ${alias} `)) hits.add(entry);
  return [...hits];
}
