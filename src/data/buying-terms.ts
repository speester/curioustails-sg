// K-119: the single source for the shop-wide buying terms that the puppy page
// already states, so home and the 48 breed pages never type these facts again.
//
// Rules for this file:
//  - Facts only, one sentence each, no marketing. If the shop changes a term,
//    it changes here and every page follows.
//  - The starter-kit total and count are computed from the kit data, never typed.
//  - Health, boarding and going-home facts are scoped to puppies at our shop;
//    imported and overseas listings run on different terms and never render these.
//
// K-119 T01 ships the safe default wording; T16 applies the owner's answers
// (PayNow fee, clinic phone numbers, week-16 dose) to this file only.
import kit from './starter-kit-items.json';

export const KIT_TOTAL = (kit.items as { price: number | null }[]).reduce(
  (n, item) => n + (item.price ?? 0),
  0,
);
export const KIT_COUNT = kit.items.length;

// K-119 T16: the owner's answers, applied to this file only.
//   Q1 = PayNow carries no fee. Credit card is the only rail with a surcharge,
//        so the copy may say "the only extra is".
//   Q2 = both clinic numbers are correct and are two lines of the same clinic:
//        8268 4039 is the MOBILE (WhatsApp or calls), 6255 6064 is the LANDLINE
//        (calls only). The K-118 note claiming they disagreed was wrong.
//   Q3 = week 16 is a core dose, not optional.
export const SURCHARGE_LINE =
  'The only extra is the 3% bank surcharge if you pay by credit card.';
// K-130 D1 (owner, 2026-11-14): four payment methods. This array is the one
// source; PAYMENT_LINE, the FAQ answer and the puppy page's payment cards all
// read it. The K-124 prototype's two-method list was wrong and is superseded.
export const PAYMENT_METHODS = [
  { key: 'paynow', overline: 'Transfer', label: 'PayNow', note: 'No fee. Ask us for the account details when you reserve.', surcharge: false },
  { key: 'bank', overline: 'Transfer', label: 'Bank transfer', note: 'No fee. Ask us for the account details when you reserve.', surcharge: false },
  { key: 'cash', overline: 'In person', label: 'Cash', note: 'No fee. Paid in person at handover.', surcharge: false },
  { key: 'card', overline: 'Card payment', label: 'Credit card', note: 'The 3% is a bank surcharge and applies to credit card payments.', surcharge: true },
] as const;
export const PAYMENT_LINE = 'Pay by PayNow, bank transfer, cash or credit card.';
// The five-day promise, worded once (it was typed in three places on the puppy
// page). Pronoun-neutral so it can sit on any puppy's page.
export const FIVE_DAY_LINE =
  "If your puppy falls sick within the first 5 days at home, bring them back to the shop and we'll nurse them.";
export const INCLUSIONS_LINE =
  `Vaccinations, microchip, licence paperwork, a free first training lesson with an AVS-certified trainer, the ${KIT_COUNT}-item starter kit and home delivery with playpen setup are already included.`;
export const BOARDING_LINE =
  'After your deposit, we board your puppy free for up to a month, food and lodging covered, with vaccinations kept on schedule at our cost.';
export const AVAILABILITY_LINE =
  'Availability is not guaranteed until the deposit is received.';
export const NO_PRESSURE_LINE = 'No pressure to buy.';
export const HELP_FIND_LINE =
  "If a puppy isn't the right match, we'll tell you, and help you find the one that is.";
export const NEXT_LITTER_LINE =
  'Tell us the breed and we will let you know when one arrives.';
export const SIMILAR_PUPPY_LINE =
  "Gone already? Tell us the breed and we'll find you a similar puppy, or tell you honestly when the next one is due.";
export const RECORDS_LINE = 'You take the vaccination and health records home with you.';
export const POC_LINE =
  'First-time owners must also complete the free online Pet Ownership Course before licensing.';
export const POC_URL =
  'https://avs.nparks.gov.sg/pets/licensing-a-pet/applying-for-dog-and-cat-licences/pet-ownership-course/';

// The owner's own template (K-118 D5). Both numbers belong to the same clinic:
// 8268 4039 is the mobile (WhatsApp or call), 6255 6064 is the landline.
export const VETS_FOR_PETS_LINE =
  "Your puppy's remaining core vaccines are given at Vets For Pets (Jurong 6569 1627; Lengkok Bahru - WhatsApp or call 8268 4039, landline 6255 6064), and Curious Tails pays for them. Tell the clinic we're covering it.";

// Same sentence for markup: the mobile carries both a wa.me and a tel: link,
// the landline and the Jurong line are tel: only.
export const vetsForPetsHtml = () =>
  "Your puppy's remaining core vaccines are given at Vets For Pets (Jurong <a href=\"tel:+6565691627\">6569 1627</a>; Lengkok Bahru - <a href=\"https://wa.me/6582684039\">WhatsApp</a> or call <a href=\"tel:+6582684039\">8268 4039</a>, landline <a href=\"tel:+6562556064\">6255 6064</a>), and Curious Tails pays for them. Tell the clinic we're covering it.";

// K-134: the clinic's contact lines on their own, for the imported page, whose
// 5-day promise names Vets For Pets but whose vaccine terms are not the shop's.
// Same three labelled numbers as VETS_FOR_PETS_LINE (owner template, K-118 D5).
export const vetsForPetsContactHtml = () =>
  "Vets For Pets, our appointed vet. Jurong: call <a href=\"tel:+6565691627\">6569 1627</a>. Lengkok Bahru: <a href=\"https://wa.me/6582684039\">WhatsApp</a> or call the mobile <a href=\"tel:+6582684039\">8268 4039</a>, or call the landline <a href=\"tel:+6562556064\">6255 6064</a>.";

export const RESERVE_STEPS = [
  'WhatsApp us to confirm which puppy is available, then meet them in Balestier. No pressure to buy.',
  'Place a deposit to reserve. Availability is not guaranteed until the deposit is received.',
  'Not ready yet? We board your puppy free for up to a month, vaccinations kept on schedule at our cost.',
  'Delivery is scheduled around your availability, usually mornings or evenings.',
  'On delivery day, we set up the playpen, walk through the starter kit, and book your free training lesson.',
];

// Copied verbatim from cavapoo.astro's inline table (the six hand-typed copies).
export const VACCINATION_ROWS = [
  { label: 'Week 6', values: ['First vaccination and deworming'] },
  { label: 'Week 8', values: ['Second vaccination and deworming'] },
  { label: 'Week 9', values: ['Puppy goes home, one week after the second vaccination'] },
  { label: 'Week 12', values: ['Third vaccination and deworming'] },
  { label: 'Week 16', values: ['Fourth core vaccination, completing the core puppy course'] },
  { label: 'Year 1 onward', values: ['Annual booster shot and deworming, done every year as advised by your vet'] },
  { label: 'At purchase', values: ['Microchipping is mandatory in Singapore and already done; dog licensing paperwork is completed with our full assistance at the point of purchase'] },
  { label: 'Before licensing (first-time owners)', values: ['A one-time free online pet ownership course, required since September 2024'] },
];

export const SHARED_BUY_FAQ = [
  {
    question: 'How do I pay?',
    answer: `${PAYMENT_LINE} ${SURCHARGE_LINE} PayNow, bank transfer and cash carry no fee. Ask us for the account details when you reserve.`,
  },
];

// K-136: the written reservation terms for imported puppies (Ireland and the
// Australian reservations, redline clause A1). The wording is the 2026-11-13
// redline (reports/imported-puppy-legal-redline-2026-11-11.md), still with
// counsel, so every link says so: it is never presented as final wording.
// When counsel signs, drop " (under legal review)" here and the draft banner on
// the page; nothing else changes.
export const RESERVATION_TERMS_PATH = '/reservation-terms/';
export const RESERVATION_TERMS_LABEL = 'Reservation terms (under legal review)';
