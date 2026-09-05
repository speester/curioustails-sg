// kit:section-rhythm@1.0.0 - per-page rhythm: tone bands, seams from colour CHANGES, variant rotation.
export type Tone = 'paper' | 'tint' | 'deep' | 'accent' | 'warn';

// EXHAUSTIVE tone -> CSS colour token map. An unmapped tone is a build error, not a
// literal that reaches dist/ (`fill="deep"` painted every deep-adjacent divider black).
export const TONE_COLOR: Record<Tone, string> = {
  paper: 'var(--surface-paper)',
  tint: 'var(--surface-tint)',
  deep: 'var(--surface-deep)',
  accent: 'var(--surface-accent)',
  warn: 'var(--surface-warn)',
};

export function toneColor(tone: string): string {
  const c = (TONE_COLOR as Record<string, string>)[tone];
  if (!c) throw new Error(`[section-rhythm] unmapped tone "${tone}" - add it to TONE_COLOR or fix the caller.`);
  return c;
}

// >= 9 shapes across >= 5 families; neighbouring seams must differ in FAMILY.
export const VARIANTS = [
  { name: 'scallop', family: 'arcs', h: [40, 56] },
  { name: 'puffy', family: 'arcs', h: [54, 74] },
  { name: 'billow', family: 'arcs', h: [30, 44] },
  { name: 'drops', family: 'arcs', h: [46, 62] },
  { name: 'sawtooth', family: 'teeth', h: [34, 48] },
  { name: 'pinnacle', family: 'teeth', h: [50, 68] },
  { name: 'slant', family: 'diagonal', h: [36, 52] },
  { name: 'terrace', family: 'terrace', h: [44, 60] },
  { name: 'ogee', family: 'ogee', h: [48, 66] },
] as const;

export type Variant = (typeof VARIANTS)[number]['name'];

// TONE is the surface a section is painted on. TREATMENT is how its CONTENT is laid out.
// They are two different axes and premium-design-standard #25 is about the SECOND one:
// "every section gets a designed treatment, and adjacent sections must not share one".
// Rotating only tone gives a striped page of identical layouts, which is the exact
// "unstyled document" complaint the rule exists to stop.
export const TREATMENTS = [
  'band',      // tinted full-bleed band, bracketed by a divider motif
  'cards',     // points as a card grid
  'split',     // prose column IN ITS OWN PANEL beside a side panel (the split trap)
  'rail',      // numbered rail: ordered steps, number pills, connector line
  'callout',   // the whole block inside one framed panel with an accent edge
  'table',     // data table in the table treatment
  'timeline',  // process / timeline strip
  'prose',     // long-form prose (ProseSection.astro) - still needs a pull-out
] as const;

export type Treatment = (typeof TREATMENTS)[number];

// ---------------------------------------------------------------------------
// COLUMN MEASURE - the SECOND axis, and the one BTO Renovation was missing.
// Owner rule (2026-08-31): "every section content uniquely designed - some full
// width, some 1/2 1/2, some 1/3 1/3 1/3." Owner rule (2026-09-01): "I don't want
// everything to be full width. I want all kinds of section: 1/1, 1/3 2/3, 2/3 1/3,
// 1/2 1/2, 1/3 1/3 1/3."
//
// TREATMENT decides what the content IS; MEASURE decides how wide it runs and where
// the slack goes. Rotating treatment alone gives a page of differently-decorated
// blocks that all render prose at one width - which is how BTO shipped 36 bands with
// 500px of empty ground down one side while every treatment check passed.
//
// The measure is CLAIMED from the rhythm exactly like the tone and the seam, so a page
// author cannot forget it and two neighbouring sections can never share one. CSS does
// the splitting on the flow wrapper, so the measure applies to prose a page already
// has, with no per-page rewrite.
//
// split-13 and split-31 are the asymmetric pair: they set a wider measure and run the
// section's figure down one third beside the prose. A SECTION WITH NO FIGURE TO PUT IN
// THE SIDE COLUMN RENDERS AS A SINGLE CENTRED COLUMN AT THAT WIDTH - the rotation never
// manufactures an empty half. That last sentence is the whole dead-half-column fix, and
// `design-audit --layout` fails any band that breaks it.
export const LAYOUTS = ['full', 'split-31', 'halves', 'rail', 'split-13', 'thirds', 'feature'] as const;
export type Layout = (typeof LAYOUTS)[number];

export function layoutForIndex(i: number): Layout {
  return LAYOUTS[i % LAYOUTS.length];
}

// Decorative SVG motifs, one per section, rotated so no two adjacent sections carry the
// same drawing or the same motion. THE VOCABULARY IS PER SITE: these names are the
// mechanism's defaults, and each project overrides them from its own
// `design-system.md ## Motif vocabulary` (motifs are a per-site uniqueness axis under
// contracts §21 - shipping the same six drawings on every site is the monotony the
// tournament exists to prevent).
export const MOTIFS = ['arc', 'orbit', 'rings', 'scatter', 'wave', 'blob'] as const;
export type Motif = (typeof MOTIFS)[number];

export function motifForIndex(i: number): Motif {
  return MOTIFS[i % MOTIFS.length];
}


export interface Rhythm {
  index: number;
  seams: number;
  lastTone: Tone | null;
  usedVariants: Variant[];
  seamStart: number;
  lastTreatment: Treatment | null;
  usedTreatments: Treatment[];
  lastLayout: Layout | null;
  usedLayouts: Layout[];
  /** A077: how many sections share one tone before it flips. Declared in
   *  `design-system.md ## Section-treatment palette` as `Band cadence:`. */
  cadence: number;
  /** Which named bands carry the DEEP surface, from `Deep bands:`. */
  deepBands: string[];
}

export function createRhythm(
  opts: number | { seamStart?: number; cadence?: number; deepBands?: string[] } = 0,
): Rhythm {
  // Back-compatible: createRhythm(2) still means seamStart=2.
  const o = typeof opts === 'number' ? { seamStart: opts } : opts;
  return { index: 0, seams: 0, lastTone: null, usedVariants: [],
           seamStart: o.seamStart ?? 0,
           lastTreatment: null, usedTreatments: [],
           lastLayout: null, usedLayouts: [],
           cadence: o.cadence ?? DEFAULT_CADENCE,
           deepBands: o.deepBands ?? [] };
}

/** Tone flips every CADENCE sections: grouped bands, not a seam every screen.
 *
 *  A077: the cadence was hard-coded `Math.floor(i / 2)`, while
 *  `design-system.md ## Section-treatment palette` was documented as carrying
 *  `Band cadence:` and `Deep bands:` rows that this file read. It now does: the project
 *  passes the declared cadence to createRhythm(), and `design-audit.mjs --rhythm` fails a
 *  built page whose tone flips at a different interval. */
export const DEFAULT_CADENCE = 2;

export function toneForIndex(i: number, cadence: number = DEFAULT_CADENCE): Tone {
  const c = Number.isFinite(cadence) && cadence >= 1 ? Math.floor(cadence) : DEFAULT_CADENCE;
  return Math.floor(i / c) % 2 === 0 ? 'paper' : 'tint';
}

function pickVariant(r: Rhythm): Variant {
  const seamIdx = r.seams + r.seamStart;
  const prev = r.usedVariants[r.usedVariants.length - 1];
  const prevFamily = prev ? VARIANTS.find((v) => v.name === prev)!.family : null;
  // Advance until family AND name differ from the previous seam.
  for (let k = 0; k < VARIANTS.length; k++) {
    const v = VARIANTS[(seamIdx + k) % VARIANTS.length];
    if (v.name !== prev && v.family !== prevFamily) return v.name;
  }
  return VARIANTS[seamIdx % VARIANTS.length].name;
}

/**
 * Never the same treatment twice in a row, and every treatment is used once before any
 * is reused. Falling back to "the next one along" is what let a page run cards-cards-cards
 * while still passing a tone-only check.
 */
function pickTreatment(r: Rhythm): Treatment {
  const prev = r.lastTreatment;
  const counts = new Map<Treatment, number>(TREATMENTS.map((t) => [t, 0]));
  for (const t of r.usedTreatments) counts.set(t, (counts.get(t) ?? 0) + 1);
  const start = (r.index + r.seamStart) % TREATMENTS.length;
  let best: Treatment | null = null;
  let bestUse = Infinity;
  for (let k = 0; k < TREATMENTS.length; k++) {
    const t = TREATMENTS[(start + k) % TREATMENTS.length];
    if (t === prev) continue;
    const used = counts.get(t) ?? 0;
    if (used < bestUse) { best = t; bestUse = used; }
  }
  return best ?? TREATMENTS[start];
}

export interface Slot {
  index: number;
  tone: Tone;
  treatment: Treatment;
  decorIndex: number;
  seam: null | { variant: Variant; fill: string; against: string; fillTone: Tone; againstTone: Tone };
}

/** A section claims its slot; the seam is emitted only when the background colour CHANGES. */
export function claimSlot(r: Rhythm, explicitTone?: Tone, explicitTreatment?: Treatment): Slot {
  const tone = explicitTone ?? toneForIndex(r.index, r.cadence ?? DEFAULT_CADENCE);
  const prev = r.lastTone;
  let seam: Slot['seam'] = null;
  if (prev !== null && prev !== tone) {
    const variant = pickVariant(r);
    r.usedVariants.push(variant);
    r.seams += 1;
    seam = { variant, fill: toneColor(tone), against: toneColor(prev), fillTone: tone, againstTone: prev };
  }
  const treatment = explicitTreatment ?? pickTreatment(r);
  r.usedTreatments.push(treatment);
  r.lastTreatment = treatment;
  const slot: Slot = { index: r.index, tone, treatment, decorIndex: r.index % 6, seam };
  r.index += 1;
  r.lastTone = tone;
  return slot;
}

/** Heroes and stat strips painted outside the rhythm still tell it what colour they left behind. */
export function markTone(r: Rhythm, tone: Tone): void {
  toneColor(tone);
  r.lastTone = tone;
}
