# Imported puppy copy deck (K-008)

**Voice:** warm, neighbourly, generous. Friendly expert, reassuring, practical (`config/project-config.md`). British/Singapore spelling.
**Banned:** supplier names or domains, "guaranteed arrival", "in stock", "ready now", "pedigree", "DNA" (`WORDS_TO_AVOID`), exact arrival days on the website (only the private reservation confirmation in §7 gives an estimated date), "cheap", any GST statement (the company is not GST-registered; owner, 2026-11-13).
`{…}` marks a variable. Every claim must hold for every listing the pipeline publishes.

> **Updated 2026-11-13 (K-068):** the owners' T17 decisions are applied: the S$250 admin fee, the age-based arrival estimate, vet fees in the 5-day promise, the first dog licence in the price, the breeder named in the reservation confirmation, no GST statement, 14 days' free boarding after arrival, and the older-puppy arrival line (the last two added the same day). Each line matches the reservation terms in `reports/imported-puppy-legal-redline-2026-11-11.md`, which are still waiting for counsel's sign-off. Nothing here is on the website yet.

> **Pending decision D1: show the origin country?** Copy below is written so it works with or without "from Ireland". Lines marked `[origin]` render only if D1 = yes. Recommendation: yes. Ireland is rabies-free (no quarantine), and an honest origin builds trust. The country is not the supplier.

---

## 1. Card (breed pages + /available-puppies/)

- **Badge:** `Available for reservation · Imported`
- **Second badge (only if age ≥ 12 weeks at publish):** `Old enough to fly`
- **Title:** `{crossLabel ?? breedLabel} · {male} {boy|boys} / {female} {girl|girls}` (zero counts are omitted, e.g. "Jack Russell Terrier · 2 boys")
- **Price:** `S${priceSGD}` + small `all-in to your door`
- **Bullets:**
  - `50% deposit to reserve: S${depositSGD}`
  - `Balance due before your puppy flies`
  - `Estimated arrival {Month YYYY} · subject to import approval`
  - `{age} old` (from DOB at build time)
  - `HDB-approved breed`, or `Private housing only` (only when hdbApproved is not null)
  - `Starter kit, free delivery & setup, free training lesson`
  - `Ref {ref}`
- **CTA (primary, WhatsApp green):** `Reserve on WhatsApp`
- **Secondary link:** `See photos & details`
- **Reserved state:** grey badge `Reserved` + CTA `Ask about the next one`

## 2. Section headings

- **Breed page section H2:** `Reserve a {breedName} puppy · arriving soon`
  - **Intro:** `No {breedName} in the shop right now, but these puppies can be reserved today. Pay a 50% deposit and we handle the whole import: paperwork, vet checks, the flight and AVS clearance. Pay the balance before your puppy flies, and we deliver to your door with everything our local puppies get.`
  - `[origin]` add: `They are in Ireland, which is rabies-free, so there is no quarantine when every import condition is met.`
- **/available-puppies/ section H2:** `Arriving soon · Imported`
  - **Intro:** `Puppies you can reserve now and welcome home in the coming weeks. Every price is all-in, delivered to your door in Singapore.`
- **Filter chips:** `All` · `In the shop now` · `Arriving soon`

## 3. Detail page

- **Title tag:** `{breedLabel} Puppy for Reservation · Arriving {Month YYYY} | Curious Tails` (noindex by default, D11)
- **H1:** `{crossLabel ?? breedLabel} puppy, available for reservation`
- **Sub:** `{male} boys / {female} girls · {age} old · Estimated arrival {Month YYYY}, subject to import approval`
- **Price box:**
  - `S${priceSGD} all-in`
  - `Reserve with 50%: S${depositSGD}`
  - `Balance S${balanceSGD}, due before your puppy flies`
  - Small print: `Includes the import, flight, AVS clearance, first dog licence, home delivery & setup, starter kit and first training lesson.`
- **CTA:** `Reserve on WhatsApp` · small: `We confirm this puppy is still available before you pay anything.`

**How reserving works (4-step timeline)**
1. **Message us.** Tell us which puppy and which boy or girl you'd like. We confirm availability, usually within 24 to 48 hours, before you pay anything.
2. **Pay the 50% deposit.** You get a written reservation with the breeder's name, the price, an estimated arrival date and the refund terms. We start the import: AVS import licence, vet health certificate and flight booking.
3. **Pay the balance before the flight.** Once the flight and health certificate are confirmed, the remaining 50% is due.
4. **Welcome home.** Your puppy lands, clears AVS checks at Changi, and we deliver to your door with the 30+ item starter kit and set everything up with you.

**What's included:** the same as every Curious Tails puppy. The 30+ item starter kit ($500+ value), free home delivery and setup, a free first lesson with an AVS-certified trainer, and WhatsApp support for as long as you need it.

**Boarding on arrival (owner decision 2026-11-13):** `If you're not ready on arrival day, we board your puppy free, with lodging and food covered, for the first 14 days after arrival. After that, a daily boarding rate applies, and we tell you the rate in writing before you reserve.` (Never quote a rate on the website; the rate goes to the buyer in writing before they reserve.)

**Our 5-day promise (imported puppies):** `If your puppy falls sick within the first 5 days of arriving home in Singapore, bring them back and we'll nurse them ourselves and pay the vet fees at our appointed vet. For imported puppies, the 5 days start on the day your puppy arrives home, not on the day you reserve.`

**About the arrival estimate:** `Puppies fly at about 3 months old, so we work out the arrival estimate from your puppy's date of birth. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. It's an estimate, not a fixed date: every import depends on AVS approval, the vet health certificate and an available flight. We'll keep you updated at every step on WhatsApp. If your puppy can't come, everything you've paid comes back to you.`

## 4. FAQ (detail page + breed section accordion)

- **Is this puppy in your shop?** No. This puppy is available for reservation and will be imported for you. When it arrives, it comes to your home with the same starter kit, setup and support as the puppies in our Balestier shop.
- **Is my deposit refundable?** Yes, in full, if the import can't go ahead for any reason that isn't your fault, or if arrival is more than 45 days late. If you change your mind before we've paid the breeder, we refund your deposit less a S$250 admin fee. After that, we refund what you've paid less the costs we can't recover, shown with receipts. Full terms come with your written reservation. *(Terms awaiting counsel's sign-off, T17.)*
- **How soon will my puppy arrive?** Puppies fly at about 3 months old, so it depends on your puppy's age. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. Your written reservation gives an estimated date, worked out from your puppy's date of birth. If your puppy is already about 3 months old when you reserve, it flies once its paperwork and flight are ready, and your written reservation gives our estimate for that.
- **What if the arrival is late?** We give an estimated month, never a fixed date, and tell you within 2 business days if anything is likely to delay it. If arrival is more than 45 days past that month, you may cancel for a full refund of everything you've paid.
- **Is there quarantine?** `[origin]` Puppies from rabies-free countries such as Ireland have no quarantine in Singapore when every AVS condition is met. *(Without origin:)* Our imports come from rabies-free countries, which have no quarantine when every AVS condition is met.
- **Is this breed allowed in an HDB flat?** {Yes: it's on HDB's approved breed list, one dog per flat.} / {No: this breed is for condos and landed homes only.} / *(cross or unknown: line omitted, with "Ask us about HDB rules for this cross")*
- **Can I see more photos or a video first?** Yes. Ask on WhatsApp and we'll request fresh photos or a video for you.
- **Is the price final?** Yes. The price shown is all-in, delivered to your door, and includes your puppy's first dog licence. No import, flight or clearance fees are added later.

## 5. WhatsApp prefilled messages

- **Card / detail:** `Hi Curious Tails! I'd like to reserve the {breedLabel} puppy, ref {ref} (S${priceSGD}, arriving around {Month YYYY}). I'm interested in a {boy/girl/either}. Is it still available?`
- **Reserved card:** `Hi! I saw the {breedLabel} puppy (ref {ref}) is reserved. Could you let me know when the next one is available?`

## 6. Owner → breeder contact template (private, not public)

> Hi {sellerName}, I'm {Nelson|Kim} from Curious Tails, a licensed pet shop in Singapore (AVS licence AS24J00046). We're interested in your {breed} puppy/pups advertised on {platform} for a family in Singapore. Is the {sex} still available? We'd need: microchip number(s), vaccination and worming records, and your willingness to work with our vet and pet-transport agent for export at 12+ weeks. **We'd also like your permission to use your photos of the pup on our website while it's reserved. Is that OK?** Thank you!

(Logging the permission answer in the review UI turns the photo from "owner-accepted risk" into "licensed". Owner decision 2026-11-13, Q9: photos are published now, behind the takedown policy, and this permission request stays in the template.)

## 7. Reservation confirmation (written, sent after deposit)

> **Reservation confirmed: {breedLabel} {boy/girl}, ref {ref}**
> - Breeder: {breederName}
> - Puppy microchip: {microchip}
> - Price: S${priceSGD} all-in, delivered to your door
> - Deposit received: S${depositSGD} on {date}
> - Balance: S${balanceSGD}, due before your puppy flies (we'll confirm the flight first)
> - Estimated arrival: around {arrivalDate}, in {Month YYYY}. We work this out from your puppy's date of birth ({dob}), because puppies fly at about 3 months old. It's an estimate, not a fixed date, and depends on AVS import approval, the vet health certificate and flight availability.
> - If the import can't go ahead for any reason that isn't your fault, everything you've paid is refunded in full within 7 business days, or moved to another puppy if you prefer. If you cancel before we've paid the breeder, we refund your deposit less a S$250 admin fee; after that, less only the costs we can't recover, shown with receipts. If arrival is more than 45 days later than the estimated month, you may cancel for a full refund.
> - Our 5-day promise (nursing, plus vet fees at our appointed vet) starts on the day your puppy arrives home.
> - Included: first dog licence, 30+ item starter kit, home delivery and setup, free first training lesson, ongoing WhatsApp support.
> - Terms version: {termsVersion}. Full terms attached.
> *(Until counsel signs off the terms (T17), this confirmation is not sent.)*

## 8. Alt-text patterns

- `{colour} {breedLabel} puppy, {sex}, {age} old`
- `{breedLabel} puppy {action: sitting / playing / lying on a blanket}`
- Litter: `{n} {breedLabel} puppies together`
- **Never:** source, country of the seller's town, filenames, "for sale from …".
