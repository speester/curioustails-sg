// WhatsApp button-text A/B experiment.
//
// The available-puppy card's WhatsApp button is the site's primary conversion
// event (whatsapp_click). This file rotates its LABEL on a fixed cadence and
// stamps the active variant id onto the GA4 event as `wa_variant`, so the
// per-variant conversion rate can be read back from Analytics.
//
// WHY TIME-SLICED, NOT PER-USER SPLIT: the site has no logged-in users and
// wa_source is only just being registered as a custom dimension. A clean 50/50
// per-user split needs a bucketing cookie AND a registered dimension. A
// time-sliced rotation needs neither: each block runs ONE label site-wide, and
// the report compares whatsapp_click / sessions between blocks. Low traffic
// makes concurrent splits slow to reach significance anyway.
//
// HOW TO ADD/EDIT A VARIANT: add to WA_VARIANTS (keep ids stable - the report
// keys on them). The rotation and the report both derive the active block from
// ROTATION_DAYS + EXPERIMENT_START, so they never disagree.

export interface WaVariant {
  id: string; // stable key used in GA4 wa_variant - never reuse for a new label
  text: string; // the button label shown for available puppies
}

// Order matters: block N uses WA_VARIANTS[N % length].
export const WA_VARIANTS: WaVariant[] = [
  { id: 'ask', text: 'Ask about this puppy' }, // control (original label)
  { id: 'available', text: 'Check if this puppy is available' },
  { id: 'chat', text: 'Chat with us on WhatsApp' },
  { id: 'reserve', text: 'Ask to reserve this puppy' },
];

// One block = this many days. 14 gives a low-traffic site enough clicks per
// variant (~130 whatsapp_click / 30 days ⇒ ~60 per 14-day block) to read a
// direction. Raise it if a block ends with < ~30 clicks.
export const ROTATION_DAYS = 14;

// Anchor: block 0 begins here (UTC midnight). Keep fixed once live so historic
// dates always map to the same variant in the report.
export const EXPERIMENT_START = Date.UTC(2026, 8, 28); // 2026-09-28

/** 0-based experiment block index for a given date. */
export function waBlockIndex(at: Date | number = Date.now()): number {
  const t = typeof at === 'number' ? at : at.getTime();
  const days = Math.floor((t - EXPERIMENT_START) / 86_400_000);
  return Math.max(0, Math.floor(days / ROTATION_DAYS));
}

/** The variant active on a given date. */
export function activeWaVariant(at: Date | number = Date.now()): WaVariant {
  return WA_VARIANTS[waBlockIndex(at) % WA_VARIANTS.length];
}
