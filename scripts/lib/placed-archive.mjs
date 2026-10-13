// Pure pieces of the placed archive (src/data/placed-archive.json), shared by
// scripts/sync-puppies.mjs and its test (scripts/test-placed-archive.mjs).
// The sync owns the network and the photos; everything here is plain data in,
// plain data out, so the rules can be exercised without a feed.

// A placed puppy's card and page stay up this long after it leaves the list;
// after that its page 301s to the breed page (owner decision 2026-10-14).
export const RETENTION_DAYS = 120;

// Calendar date in Singapore, where the shop is: a 06:30 UTC sync is 14:30 SGT.
export const sgtDate = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// What the archive keeps of a listed puppy: never its price or booking link.
export const snapshot = (p, breed) => ({
  id: p.id,
  breed,
  name: p.name ?? null,
  color: p.color ?? null,
  gender: p.gender ?? null,
  age: p.age ?? null,
  image: p.image ?? null,
  origin: p.origin ?? null,
  sizeNote: p.sizeNote ?? null,
  crossLabel: p.crossLabel ?? null,
  hdbApproved: p.hdbApproved ?? null,
});

/**
 * Merge this run's listing into the archive. Departures are diffed against BOTH
 * the previous available-puppies.json and the archive's own `lastSync.listed`:
 * owner-reported sales have been hand-edited out of available-puppies.json
 * between syncs (4aea58c), and a diff against that file alone never sees those
 * puppies leave. A puppy listed again leaves the archive.
 * @returns {{ archived: Map<string, object>, departures: string[] }}
 */
export function recordDepartures({ archive, prevFeed, listedNow, today }) {
  const archived = new Map((archive?.pups ?? []).map((p) => [String(p.id), { ...p }]));
  for (const id of listedNow) archived.delete(id);

  const previouslyListed = [
    ...(archive?.lastSync?.listed ?? []).map((p) => ({ p, breed: p.breed, at: archive.lastSync.at })),
    ...Object.entries(prevFeed?.breeds ?? {}).flatMap(([breed, b]) =>
      (b.available ?? []).map((p) => ({ p, breed, at: prevFeed.syncedAt })),
    ),
  ];
  const departures = [];
  for (const { p, breed, at } of previouslyListed) {
    const id = String(p.id);
    if (listedNow.has(id) || archived.has(id)) continue;
    archived.set(id, {
      ...snapshot(p, breed),
      status: null,
      placedAt: today,
      lastListed: at ? sgtDate(at) : today,
      source: 'sync',
    });
    departures.push(id);
  }
  return { archived, departures };
}

/** True once an entry has outlived the retention window (or already did). */
export const isExpired = (entry, today) =>
  entry.status === 'expired' || daysBetween(entry.placedAt, today) > RETENTION_DAYS;

/**
 * The evidence for one archived puppy, from the sheet as it stands today.
 * `overlaid` is the overlay verdict for the row's current Image1 (true/false),
 * or undefined when the check could not run - then the last verdict stands.
 *   placed    <- sold-override | sold-overlay
 *   withdrawn <- not-in-sheet | out-of-area | no-photo | no-overlay | check-failed
 */
export function classify({ id, row, manualSold, locationAllowed, overlaid, previous }) {
  let evidence;
  if (manualSold.has(Number(id))) evidence = 'sold-override';
  else if (!row) evidence = 'not-in-sheet';
  else if (!locationAllowed(row)) evidence = 'out-of-area';
  else if (!row.images?.[0]) evidence = 'no-photo';
  else if (overlaid === undefined) evidence = previous ?? 'check-failed';
  else evidence = overlaid ? 'sold-overlay' : 'no-overlay';
  const status = evidence === 'sold-override' || evidence === 'sold-overlay' ? 'placed' : 'withdrawn';
  return { evidence, status };
}

/** Whether classify() needs an overlay verdict for this row at all. */
export const needsOverlayCheck = ({ id, row, manualSold, locationAllowed }) =>
  !manualSold.has(Number(id)) && !!row && locationAllowed(row) && !!row.images?.[0];

/** The file the sync writes: newest departures first, plus this run's listing. */
export function archiveFile({ archived, breeds, now }) {
  return {
    _note:
      'Written by scripts/sync-puppies.mjs, never rebuilt from scratch: puppies that left the available list. status: placed (sold evidence, shown under "Puppies That Found Their Loving Homes"), withdrawn (no evidence, never shown), expired (past retention). placedAt = the day the sync first saw it gone (SGT); lastListed = the last day it was listed. Do not hand-edit; to mark a sale, add the id to sold-overrides.json and re-run the sync.',
    lastSync: {
      at: now,
      listed: Object.entries(breeds).flatMap(([breed, b]) => b.available.map((p) => snapshot(p, breed))),
    },
    pups: [...archived.values()].sort(
      (a, b) => b.placedAt.localeCompare(a.placedAt) || Number(b.id) - Number(a.id),
    ),
  };
}

/** Photos the archive still needs: everything not expired (a withdrawn pup can still turn placed). */
export const archivePhotos = (pups) =>
  pups.filter((a) => a.status !== 'expired').map((a) => a.image).filter(Boolean);
