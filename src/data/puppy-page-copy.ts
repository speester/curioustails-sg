// K-130: the puppy page copy deck. Every heading, card sentence, CTA label and
// WhatsApp prefill on src/components/puppy-page/ is a function of PuppyPageData.
// Shop terms come from buying-terms.ts and site.ts, never typed here.
//
// Null-safe by construction: no name -> "this puppy", no gender -> they/them and
// "Puppy", no colour -> omitted, no price -> "Ask for price". No sentence here
// describes one puppy's personality, parents, health results or adult size
// (honesty rules H1-H7, reports/puppy-page-template-plan-2026-11-14.md §3).
import { site, whatsappLink } from './site';
import {
  AVAILABILITY_LINE,
  BOARDING_LINE,
  FIVE_DAY_LINE,
  KIT_COUNT,
  KIT_TOTAL,
  NO_PRESSURE_LINE,
  POC_LINE,
  POC_URL,
  RESERVE_STEPS,
  SHARED_BUY_FAQ,
  SURCHARGE_LINE,
  VETS_FOR_PETS_LINE,
} from './buying-terms';
import { absoluteUrl, article, cap, type PuppyPageData } from '../lib/puppy-page';
import { sampleMessage } from '../lib/imported-puppies';

type P = PuppyPageData;

const lower = (s: string | null) => (s ? s.toLowerCase() : null);
/** "apricot female Maltipoo" (whatever is known). */
const describe = (p: P) => [lower(p.color), lower(p.gender), p.breedNoun].filter(Boolean).join(' ');
/** "Biscuit" or "puppy #2938", for prefills where "this puppy" would be vague. */
const named = (p: P) => p.name ?? `puppy #${p.displayId}`;
const subjIs = (p: P) => (p.pron.subj === 'they' ? 'they are' : `${p.pron.subj} is`);

// ---------------------------------------------------------------------------
// SEO block
// ---------------------------------------------------------------------------
const BRAND = ' | Curious Tails';

export function pageTitle(p: P): string {
  const desc = [p.color, p.breedNoun, p.genderWord].filter(Boolean).join(' ');
  const short = [p.breedNoun, p.genderWord].join(' ');
  // Longest honest form that fits 60 characters (brand suffix first to go, then the colour).
  const first = (...c: string[]) => {
    for (const t of c) if (t.length + BRAND.length <= 60) return t + BRAND;
    return c.find((t) => t.length <= 60) ?? c[c.length - 1];
  };
  if (p.variant === 'pl')
    return p.name
      ? first(`${p.name} the ${p.breedNoun} Found a Loving Home`, `${p.name} the ${p.breedNoun} Found a Home`)
      : first(`${desc} #${p.displayId} Found a Loving Home`, `${short} #${p.displayId} Found a Loving Home`, `${p.breedNoun} #${p.displayId} Found a Home`);
  if (p.variant === 'imp' && p.sample) return `Sample Listing (Demo Data) · ${p.breedNoun}${BRAND}`;
  if (p.variant === 'imp') return first(`${p.breedNoun} Puppy for Reservation · Arriving ${p.imp!.month}`, `${p.breedNoun} Puppy for Reservation`);
  return p.name
    ? first(`${p.name}, ${desc} for Sale`, `${p.name}, ${short} for Sale`)
    : first(`${desc} #${p.displayId} for Sale`, `${short} #${p.displayId} for Sale`);
}

export function metaDescription(p: P): string {
  const parts: string[] = [];
  const d = [lower(p.color), p.breedNoun, p.genderWord.toLowerCase()].filter(Boolean).join(' ');
  if (p.variant === 'pl') {
    parts.push(`${p.Who}, ${article(d)} ${d}, found a loving Singapore home${p.placedPhrase ? ` ${p.placedPhrase}` : ''} through Curious Tails.`);
    parts.push(`See the ${p.breedNoun} puppies available now at our AVS-licensed Balestier shop.`);
  } else if (p.variant === 'imp') {
    if (p.sample) parts.push('Sample listing built from demo data, not a real puppy.');
    parts.push(`${p.breedNoun} puppy available for reservation, estimated arrival ${p.imp!.month} and subject to import approval.`);
    parts.push(`${p.imp!.priceText} all-in, 50% deposit ${p.imp!.depositText}. Imported by Curious Tails, AVS licensed.`);
  } else {
    parts.push(`Meet ${p.name ? `${p.name}, ${article(d)} ${d}` : `this ${d}`}${p.ageLabel ? `, ${p.ageLabel.toLowerCase()}` : ''}.`);
    parts.push(`${p.priceText ? `${p.priceText} all-in` : 'Ask us for the all-in price'}${p.hdbApproved ? ', HDB approved' : ''}.`);
    parts.push('Vaccinated, microchipped, vet-checked.');
    parts.push('See them at our AVS-licensed Balestier shop.'.replace('them', p.pron.obj));
  }
  // Site rule (page-health `titles`): 140-158 characters. Core parts first, then
  // shop-wide true extras until the description reaches 140, never past 155.
  const extras =
    p.variant === 'pl'
      ? ['Every Curious Tails puppy goes home vaccinated, microchipped and vet-checked.', 'WhatsApp us for a similar puppy.', 'New puppies arrive regularly.', 'AVS licensed.', 'All-in prices.']
      : p.variant === 'imp'
        ? ['WhatsApp us to reserve.', 'No import fees added later.']
        : ['Starter kit, delivery and a first training lesson included.', 'WhatsApp us to visit.', 'No pressure to buy.', 'Book a viewing.', 'Licence paperwork done.'];
  let out = '';
  for (const part of [...parts, ...extras]) {
    if (out.length >= 140 && parts.indexOf(part) === -1) break;
    const next = out ? `${out} ${part}` : part;
    if (next.length > 155) continue;
    out = next;
  }
  return out || parts[0].slice(0, 155);
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
export function h1(p: P): string {
  const desc = [p.color, p.breedNoun, p.genderWord].filter(Boolean).join(' ');
  if (p.variant === 'pl') return p.name ? `${p.name} the ${p.breedNoun} Found a Loving Home` : `This ${desc} Found a Loving Home`;
  if (p.variant === 'imp') return `${p.breedNoun} puppy, available for reservation`;
  return p.name ? `${p.name}, the ${desc}` : desc;
}

export const kicker = (p: P) =>
  p.variant === 'imp'
    ? [p.breedName, 'Imported', p.imp!.sexLine].filter(Boolean).join(' · ')
    : [p.breedNoun, p.genderWord === 'Puppy' ? null : p.genderWord, `Puppy ID #${p.displayId}`].filter(Boolean).join(' · ');

export const placedLine = (p: P) =>
  `Found ${p.pron.poss} family${p.placedPhrase ? ` ${p.placedPhrase}` : ''} · Puppy ID #${p.displayId}`;

export const INCLUSIONS_SHORT = 'Starter kit, delivery and setup, vaccinations, licence paperwork and a first training lesson included.';

export const placedCard = (p: P) => ({
  title: `${p.Who} is no longer available.`,
  body: `${cap(p.pron.subj)} found ${p.pron.poss} family${p.placedPhrase ? ` ${p.placedPhrase}` : ''}. Looking for ${article(p.breedNoun)} ${p.breedNoun} like ${p.name ? p.pron.obj : 'this one'}? WhatsApp us and we'll send photos of similar puppies available now or arriving soon.`,
});

export const ctaLabel = {
  interest: (p: P) => `WhatsApp about ${p.name ?? 'this puppy'}`,
  similar: (p: P) => `Ask about a similar ${p.breedNoun}`,
  book: 'Book a viewing',
  seeNow: 'See puppies available now',
  reserveImp: (p: P) => (p.imp!.reserved ? 'Ask about the next one' : 'Reserve on WhatsApp'),
  howReserving: 'How reserving works',
};

// ---------------------------------------------------------------------------
// WhatsApp prefills (one place, so GA4 wa_source and the inbox can be reconciled)
// ---------------------------------------------------------------------------
export const wa = {
  interest: (p: P) =>
    whatsappLink(
      p.priceText
        ? `Hi! I'm interested in ${named(p)}, the ${describe(p)} (ID ${p.displayId}). Is ${p.name ? p.pron.subj : 'this puppy'} still available? ${absoluteUrl(p.canonicalPath)}`
        : `Hi! I'm interested in ${named(p)}, the ${describe(p)} (ID ${p.displayId}). Could you tell me the price, and is ${p.name ? p.pron.subj : 'this puppy'} still available? ${absoluteUrl(p.canonicalPath)}`,
    ),
  video: (p: P) => whatsappLink(`Hi! Could you send a video of ${named(p)}, the ${describe(p)} puppy (ID ${p.displayId})?`),
  photos: (p: P) => whatsappLink(`Hi! Could you send photos of ${named(p)}, the ${describe(p)} puppy (ID ${p.displayId})?`),
  final: (p: P) => whatsappLink(`Hi! I'd like to check if ${named(p)} (ID ${p.displayId}) is available and reserve.`),
  visit: (p: P) => whatsappLink(`Hi! I'd like to book a viewing for ${named(p)} (ID ${p.displayId}) at Balestier.`),
  reserve: (p: P) =>
    whatsappLink(`Hi! I'd like to check if ${named(p)} (ID ${p.displayId}) is available and book an appointment to meet ${p.pron.obj}.`),
  faq: (p: P) => whatsappLink(`Hi! Is ${named(p)} (ID ${p.displayId}) still available?`),
  sold: (p: P) =>
    whatsappLink(
      `Hi! I saw ${named(p)} (ID ${p.displayId}) found a home. Do you have a similar ${[lower(p.color), p.breedNoun].filter(Boolean).join(' ')} puppy available now or coming soon?`,
    ),
  soldFinal: (p: P) => whatsappLink(`Hi! I saw ${named(p)} (ID ${p.displayId}) found a home. I'd like to reserve a similar ${p.breedNoun} puppy.`),
  soldSticky: (p: P) => whatsappLink(`Hi! I saw ${named(p)} (ID ${p.displayId}) found a home. Do you have a similar ${p.breedNoun}?`),
  impReserve: (p: P) => {
    const i = p.imported!;
    if (i.sample) return whatsappLink(sampleMessage(i));
    const interest = i.sex.male > 0 && i.sex.female > 0 ? 'boy or girl' : i.sex.female > 0 ? 'girl' : 'boy';
    return whatsappLink(
      p.imp!.reserved
        ? `Hi! I saw the ${i.breedLabel} puppy (ref ${i.ref}) is reserved. Could you let me know when the next one is available?`
        : `Hi Curious Tails! I'd like to reserve the ${i.breedLabel} puppy, ref ${i.ref} (${p.imp!.priceText}, arriving around ${p.imp!.month}). I'm interested in a ${interest}. Is it still available?`,
    );
  },
};

/** Book a viewing: the shop's cal.com link for this puppy, else a WhatsApp booking prefill. */
export const bookLink = (p: P) => ({
  href: p.bookHref ?? wa.visit(p),
  external: Boolean(p.bookHref),
});

// ---------------------------------------------------------------------------
// Section copy
// ---------------------------------------------------------------------------
export const includesHeading = (p: P) =>
  p.variant === 'imp'
    ? `What the ${p.imp!.priceText} includes`
    : p.priceText
      ? `What ${p.name ? `${p.name}'s ` : 'the '}${p.priceText} includes`
      : `What the all-in price includes`;

export const INCLUDES_INTRO = `Everything a first-time owner needs for the first weeks, in one all-in price. ${SURCHARGE_LINE}`;
export const IMP_INCLUDES_INTRO =
  'Includes the import, flight, AVS clearance, first dog licence, home delivery & setup, starter kit and first training lesson.';

/** Local includes: every item is a shop-wide term (buying-terms.ts). */
export const includesItems = (p: P) => [
  { icon: 'shield', title: 'Vaccinations and microchip', body: 'On the Singapore schedule, with deworming at each visit, and the records handed to you.' },
  { icon: 'doc', title: 'Dog licence paperwork, done', body: `We complete ${p.name ? `${p.name}'s` : 'your puppy\'s'} AVS dog licence for you at purchase.` },
  { icon: 'gift', title: `Starter kit · ${KIT_COUNT} items · $${KIT_TOTAL} value`, body: 'Playpen, carrier, bed, grooming set, food, toilet training, oral care, outdoor gear and toys.', link: { href: '/starter-kit/', label: 'See every item' } },
  { icon: 'van', title: 'Home delivery and playpen setup', body: `We bring ${p.pron.obj} home, set up the playpen and walk you through every item in the kit.`, link: { href: '/delivery/', label: 'How delivery works' } },
  { icon: 'paw', title: 'A free first training lesson', body: 'With an AVS-certified trainer, to start good habits early.', link: { href: '/free-training/', label: 'About the lesson' } },
  { icon: 'home', title: "Free boarding until you're ready", body: BOARDING_LINE },
];

export const IMP_INCLUDES = [
  'The import, flight and AVS clearance',
  'First dog licence',
  'Home delivery & setup',
  `${KIT_COUNT}-item starter kit ($${KIT_TOTAL} value)`,
  'First training lesson with an AVS-certified trainer',
  'Ongoing WhatsApp support',
];

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty'];
export const spell = (n: number) =>
  n <= 20 ? NUMBER_WORDS[n] : n < 60 ? `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${NUMBER_WORDS[n % 10].toLowerCase()}` : ''}` : String(n);

export const giftsHeading = () => `${spell(KIT_COUNT)} free gifts, already in the price`;
export const giftsIntro = () =>
  `The full starter kit comes home with every Curious Tails puppy: ${KIT_COUNT} items worth $${KIT_TOTAL} at pet-shop prices, included in the all-in price. Here is what is inside it.`;

export const aboutEyebrow = (p: P) =>
  p.variant === 'pl' ? 'Found a loving home' : p.variant === 'imp' ? 'Reservation only' : `Meet ${p.who}`;
export const aboutHeading = (p: P) => `About ${p.who}`;

/** Dossier card 02: shop policy, never a per-puppy health claim. */
export const doneCard = (p: P) =>
  p.variant === 'imp'
    ? { title: 'Before the flight', body: 'The AVS import licence, vet health certificate and flight are arranged before your puppy travels, and it clears AVS checks at Changi on arrival.' }
    : p.variant === 'pl'
      ? { title: 'Already done', body: `Like every puppy from our Balestier shop, ${p.pron.subj} went home vaccinated, dewormed, microchipped and vet-checked.` }
      : { title: 'Already done', body: `${cap(subjIs(p))} vaccinated, dewormed and microchipped, and ${p.pron.subj === 'they' ? 'have' : 'has'} passed a vet health check.` };

export const nextCard = (p: P) =>
  p.variant === 'pl'
    ? { title: 'Found a loving home', body: `If you were hoping for ${article(p.breedNoun)} ${p.breedNoun} like ${p.name ? p.pron.obj : 'this one'}, WhatsApp us. New puppies arrive regularly, and we'll tell you honestly when the next one is due.` }
    : p.variant === 'imp'
      ? { title: 'Reserve first, then we confirm', body: 'We confirm this puppy is still available, usually within 24 to 48 hours, before you pay anything.' }
      : { title: `Come and meet ${p.pron.obj}`, body: `If that sounds like your household, come and meet ${p.pron.obj}. ${NO_PRESSURE_LINE} We'll tell you honestly if another breed would suit you better.` };

export const FAMILIES = {
  kicker: 'Real families, real homes',
  heading: 'Happy Curious Tails families',
  intro: 'These are real handovers at our Balestier shop: the families who took a Curious Tails puppy home. No stock photos, no borrowed smiles.',
  foot: `Every photo is from a handover at ${site.address.street.replace(/ #.*$/, '')}.`,
};

export const fitHeading = (p: P) => `Is ${article(p.breedNoun)} ${p.breedNoun} right for your home?`;
export const fitIntro = (p: P) => `A good match matters more than a quick sale. Here's what living with ${article(p.breedNoun)} ${p.breedNoun} is really like.`;

export const finalCopy = (p: P) =>
  p.variant === 'pl'
    ? { heading: `Looking for ${article(p.breedNoun)} ${p.breedNoun} like ${p.who}?`, body: `New puppies arrive regularly. WhatsApp us and we'll tell you honestly when the next ${p.breedNoun} is due.` }
    : p.variant === 'imp'
      ? { heading: p.imp!.reserved ? 'Ask about the next one' : 'Reserve this puppy', body: 'We confirm this puppy is still available before you pay anything. Message us and we will answer every question first.' }
      : { heading: `Could ${p.who} be the one?`, body: `Ask us anything on WhatsApp, or come and meet ${p.pron.obj} in Balestier. If ${p.pron.subj === 'they' ? "they're" : `${p.pron.subj}'s`} not the right match, we'll tell you, and help you find the puppy that is.` };

export const healthHeading = (p: P) => (p.variant === 'imp' ? 'Our promises for an imported puppy' : `${p.name ? `${p.name}'s` : 'Your puppy\'s'} health record`);
export const HEALTH_INTRO = 'Every puppy follows the same Singapore schedule, and you take the vaccination and health records home with you.';
export const healthPoc = (p: P) => `First-time dog owner? Singapore requires the AVS Pet Ownership Course. We complete ${p.name ? `${p.name}'s` : 'your puppy\'s'} dog licence paperwork for you at purchase.`;
export const FIVE_DAY_TITLE = 'Our first-5-days promise';

export const IMP_PROMISES = [
  { title: 'Our 5-day promise', body: "If your puppy falls sick within the first 5 days of arriving home in Singapore, bring them back and we'll nurse them ourselves and pay the vet fees at our appointed vet, Vets For Pets. The 5 days start on the day your puppy arrives home, not on the day you reserve." },
  { title: 'Boarding on arrival', body: "If you're not ready on arrival day, we board your puppy free, with lodging and food covered, for the first 14 days after arrival. After that, boarding costs S$30 a day." },
  { title: 'About the arrival estimate', body: "Puppies fly at about 3 months old, so we work out the arrival estimate from your puppy's date of birth. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. It's an estimate, not a fixed date: every import depends on AVS approval, the vet health certificate and an available flight. We'll keep you updated at every step on WhatsApp. If your puppy can't come, everything you've paid comes back to you." },
];

export const nextHeading = (p: P) =>
  p.variant === 'imp' ? 'How reserving an imported puppy works' : `Bringing ${p.variant === 'pl' ? 'your puppy' : p.who} home, step by step`;

/** Local steps: RESERVE_STEPS from buying-terms.ts, titled here. */
export const localSteps = () => [
  { title: 'Say hi, then visit', body: `${RESERVE_STEPS[0]} Open ${site.hours}.` },
  { title: 'Reserve with a deposit', body: RESERVE_STEPS[1] },
  { title: 'Not ready yet?', body: RESERVE_STEPS[2], tag: 'Free boarding' },
  { title: 'Delivery around you', body: RESERVE_STEPS[3] },
  { title: 'Setup and first lesson', body: RESERVE_STEPS[4], tag: 'Included' },
];

export const impSteps = (p: P) => [
  { title: 'Message us.', body: "Tell us which puppy and which boy or girl you'd like. We confirm availability, usually within 24 to 48 hours, before you pay anything." },
  // Steps 2 and 3 follow the legal redline (reports/imported-puppy-legal-redline-2026-11-11.md,
  // clauses A2, 4.1 and 4.2), still with counsel: change them only with that file.
  { title: `Pay the 50% deposit (${p.imp!.depositText}).`, body: "To reserve, you pay a deposit of 50% of the price by PayNow or bank transfer, after we have confirmed availability. We send your written reservation confirmation, with the breeder's name, the price, the estimated arrival date and the refund terms, within 1 business day of receiving the deposit. We pay the breeder only after your deposit has cleared." },
  { title: `Pay the balance (${p.imp!.balanceText}) before the flight.`, body: "The remaining 50% (the balance) is due before the puppy flies, after we have sent you written confirmation of the booked flight, the puppy's pre-export vet check, and copies of its vaccination, worming and microchip records." },
  { title: 'Welcome home.', body: `Your puppy lands, clears AVS checks at Changi, and we deliver to your door with the ${KIT_COUNT}-item starter kit and set everything up with you.` },
];

export const visitHeading = (p: P) =>
  p.variant === 'av' ? `Meet ${p.who} in Balestier` : p.variant === 'pl' ? 'Meet our puppies in Balestier' : 'Visit us in Balestier';

export const reviewsHeading = (p: P, breedMatched: boolean) =>
  breedMatched ? `What ${p.breedNoun} families say` : 'What Curious Tails families say';

export const othersHeading = (p: P) => (p.variant === 'pl' ? 'Puppies available now' : 'Other puppies available now');
export const OTHERS_INTRO = 'Every price all-in. Tap a puppy to see its own page.';

export const reserveCopy = (p: P) => ({
  heading: `Reserving ${p.who}`,
  body: `Send us a WhatsApp message to check availability and book an appointment to meet ${p.who}. A deposit is required to reserve.`,
  note: AVAILABILITY_LINE,
});

// ---------------------------------------------------------------------------
// FAQ: one array feeds the visible list AND the FAQPage JSON-LD, so they cannot
// drift. An answer is a list of segments; a segment with an href renders as a
// link and contributes its text to the schema answer.
// ---------------------------------------------------------------------------
export type Seg = string | { text: string; href: string; external?: boolean; wa?: string };
export interface FaqItem {
  question: string;
  answer: Seg[];
}
export const faqText = (a: Seg[]) => a.map((s) => (typeof s === 'string' ? s : s.text)).join('').replace(/\s+/g, ' ').trim();

export function puppyFaq(p: P): FaqItem[] {
  if (p.variant === 'pl') return [];
  if (p.variant === 'imp') return impFaq(p);
  const who = p.who;
  const Who = p.Who;
  const items: (FaqItem | null)[] = [
    {
      question: `Is ${who} still available?`,
      answer: ['Puppies are reserved quickly, so ', { text: 'WhatsApp us', href: wa.faq(p), wa: `${p.waSource}:faq` }, ' to confirm right now.'],
    },
    {
      question: p.priceText ? `What does the ${p.priceText} include?` : `What does ${p.name ? `${p.name}'s` : 'the'} all-in price include?`,
      answer: [
        `Vaccinations and microchip, the dog licence paperwork, the ${KIT_COUNT}-item starter kit ($${KIT_TOTAL} itemised), home delivery with playpen setup, a free first training lesson with an AVS-certified trainer, and free boarding for up to a month after your deposit. ${SURCHARGE_LINE}`,
        ...(p.priceText ? [] : [' WhatsApp us and we will tell you the price.']),
      ],
    },
    { question: SHARED_BUY_FAQ[0].question, answer: [SHARED_BUY_FAQ[0].answer] },
    {
      question: `Can I meet ${who} before deciding?`,
      answer: [
        `Yes. Visit us at ${site.address.street}, ${site.hours}. `,
        { text: 'Book a viewing', href: bookLink(p).href, external: bookLink(p).external },
        ` or just WhatsApp us. ${NO_PRESSURE_LINE}`,
      ],
    },
    p.hdbApproved
      ? {
          question: `Can ${who} live in an HDB flat?`,
          answer: [
            `Yes. ${Who} is HDB approved. HDB allows one dog of an approved breed per flat, and we complete the dog licence for you at purchase. `,
            { text: POC_LINE, href: POC_URL, external: true },
            ' See ',
            { text: 'HDB-approved breeds', href: '/first-time-owners/hdb-breeds/' },
            '.',
          ],
        }
      : null,
    {
      question: `What if I'm not ready to bring ${who} home yet?`,
      answer: [`${BOARDING_LINE} ${RESERVE_STEPS[3]}`],
    },
    {
      question: `Which vaccinations will ${who} have had?`,
      answer: [
        `Puppies are vaccinated at 6, 8 and 12 weeks, with deworming at each visit, and go home about a week after the 2nd vaccination. The 4th core vaccination follows at 16 weeks, then there's a yearly booster. ${VETS_FOR_PETS_LINE}`,
      ],
    },
    {
      question: `What if ${who} falls sick after going home?`,
      answer: [`${FIVE_DAY_LINE} You can also WhatsApp us with care questions any time after the handover.`],
    },
    p.facts?.size
      ? {
          question: `How big will ${who} get?`,
          answer: [
            `The usual grown size for ${article(p.breedNoun)} ${p.breedNoun}: ${p.facts.size.charAt(0).toLowerCase()}${p.facts.size.slice(1)}. That is the breed range, not a promise about one puppy, so ask us about ${p.name ? `${p.name}'s` : 'this puppy\'s'} expected adult size.`,
          ],
        }
      : null,
  ];
  return items.filter((x): x is FaqItem => x !== null);
}

function impFaq(p: P): FaqItem[] {
  const hdb =
    p.imported!.hdbApproved === true
      ? "Yes. It's on HDB's approved breed list, one dog per flat."
      : p.imported!.hdbApproved === false
        ? 'No. This breed is for condos and landed homes only.'
        : 'Ask us about HDB rules for this cross.';
  return [
    { question: 'Is this puppy in your shop?', answer: ['No. This puppy is available for reservation and will be imported for you. When it arrives, it is delivered to your door with the same starter kit, setup and support as every Curious Tails puppy.'] },
    { question: 'Is my deposit refundable?', answer: ["Yes, in full, if the import can't go ahead for any reason that isn't your fault, or if arrival is more than 45 days late. If you change your mind before we've paid the breeder, we refund your deposit less a S$250 admin fee. After that, we refund what you've paid less the costs we can't recover, shown with receipts. Or, instead of cancelling, you can move everything you've paid to another puppy at no cost. Full terms come with your written reservation."] },
    { question: 'How soon will my puppy arrive?', answer: ["Puppies fly at about 3 months old, so it depends on your puppy's age. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. Your written reservation gives an estimated date, worked out from your puppy's date of birth. If your puppy is already about 3 months old when you reserve, it flies once its paperwork and flight are ready, and your written reservation gives our estimate for that."] },
    { question: 'What if the arrival is late?', answer: ["We give an estimated month, never a fixed date, and tell you within 2 business days if anything is likely to delay it. If arrival is more than 45 days past that month, you may cancel for a full refund of everything you've paid."] },
    { question: 'Is there quarantine?', answer: ['Our imports come from rabies-free countries, which have no quarantine when every AVS condition is met.'] },
    { question: 'Is this breed allowed in an HDB flat?', answer: [hdb] },
    { question: 'Can I see more photos or a video first?', answer: ["Yes. Ask on WhatsApp and we'll request fresh photos or a video for you."] },
    { question: 'Is the price final?', answer: ["Yes. The price shown is all-in, delivered to your door, and includes your puppy's first dog licence. No import, flight or clearance fees are added later."] },
  ];
}
