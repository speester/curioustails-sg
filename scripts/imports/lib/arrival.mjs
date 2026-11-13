// Arrival estimate for imported puppies (spec §4; owner D6, 2026-11-13).
//
// Puppies fly at about 3 months old: base = DOB + 3 months. There is no
// lead-time floor and no maximum wait. Fallbacks, in order:
//   DOB present                → basis 'dob'
//   age present ("8 weeks")    → DOB = listingDate − age, basis 'age'
//   neither                    → listingDate + 3 months, basis 'listing-date' (caller routes to review)
// When the base date is already past, the puppy flies once its paperwork and
// flight are ready; the reservation confirmation gives the estimate (redline B1).
// The website shows the month only, never a day.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const FLY_AGE_MONTHS = 3;

const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const str = String(s).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str); // DD/MM/YYYY (Irish)
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const t = Date.parse(str); // "September 6, 2026"
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// Calendar month add, clamped to the end of the target month (Nov 30 + 3 → Feb 28).
export function addMonths(date, n) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), last)));
}
const addDays = (date, n) => new Date(date.getTime() + n * 86400000);

/** "8 weeks" | "8 wks old" | "2 months" | "10 days" → { days } or { months } */
export function parseAge(raw) {
  const s = String(raw ?? '').toLowerCase();
  const m = /(\d+(?:\.\d+)?)\s*(day|week|wk|month|mth|mo)s?\b/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === 'day') return { days: Math.round(n) };
  if (m[2] === 'week' || m[2] === 'wk') return { days: Math.round(n * 7) };
  return { months: n };
}

export const monthLabel = (month) => {
  const [y, mo] = month.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
};

/**
 * computeArrival({ dob?, ageRaw?, listingDate, today? })
 * → { date, month, basis, display, dob, past, needsReview }
 */
export function computeArrival({ dob = null, ageRaw = null, listingDate, today = new Date() } = {}) {
  const listed = parseDate(listingDate);
  let birth = parseDate(dob);
  let basis = 'dob';
  if (!birth) {
    const age = parseAge(ageRaw);
    if (age && listed) {
      birth = age.days != null ? addDays(listed, -age.days) : addMonths(listed, -Math.round(age.months));
      basis = 'age';
    } else {
      basis = 'listing-date';
    }
  }
  const anchor = birth ?? listed;
  if (!anchor) return { date: null, month: null, basis, display: null, dob: null, past: false, needsReview: true };

  const base = addMonths(anchor, FLY_AGE_MONTHS);
  const date = toISODate(base);
  const month = date.slice(0, 7);
  const todayD = parseDate(today);
  const past = base < todayD;
  const display = past
    ? 'Flies once paperwork and flight are ready · subject to import approval'
    : `Estimated arrival ${monthLabel(month)} · subject to import approval`;
  return { date, month, basis, display, dob: birth ? toISODate(birth) : null, past, needsReview: basis === 'listing-date' };
}
