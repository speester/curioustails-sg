# Source content for the K-008 legal redline.
# Markup: [-deleted text-]  {+inserted text+}  ⟦placeholder needing a decision⟧
# Base text ("original") = the draft wording in
#   reports/imported-puppy-pipeline-spec-2026-11-08.md §5, §7
#   reports/imported-puppy-copy-deck-2026-11-08.md §3, §4, §7
#   reports/imported-puppy-risks-and-decisions-2026-11-08.md R2
# Clauses with no base text appear as pure insertions.

DATE = "2026-11-11"
REVISED = "2026-11-13"

TITLE = "Imported puppies: reservation terms, delay clause and takedown policy (redline for legal review, T17)"

COVER = [
    ("p", "Prepared for: Curious Tails' lawyer. Prepared by: Claude, for Nelson and Kim (owners). Status: DRAFT for legal review. Not in use on the website or in any customer message."),
    ("p", "Business: Curious Tails Pte Ltd, ACRA UEN 202420075D, trading as Curious Tails, AVS-licensed pet shop (licence AS24J00046), 2 Balestier Road #01-701, Singapore 320002."),
    ("p", "Revised 2026-11-13 (task K-068): the owners have answered all eleven open points. Their decisions are applied in this version and listed in Part F, together with two further answers given the same day (A10 boarding and the B1 older-puppy sentence). The tracked changes still run against the 2026-11-08 base wording, so this version replaces the 2026-11-11 draft in full."),
    ("h2", "What this document is"),
    ("p", "Curious Tails plans to list puppies that are with breeders in Ireland as \"Available for reservation · Imported\". The buyer pays a 50% deposit to start the import and the 50% balance before the puppy flies. The price is fixed and all-in, delivered to the buyer's door. Listings are found by an automated feed of Irish classified sites and published only after owner approval. The supplier is not named on the website; the buyer learns the breeder's identity in the written reservation confirmation. The same terms also govern the Australian reservations the live site already takes (clause A1)."),
    ("p", "The project team wrote first-draft refund, arrival and takedown wording inside its spec and copy deck (2026-11-08). This document redlines that wording into three instruments for your review:"),
    ("ul", [
        "Part A. Reservation terms (the contract the buyer receives with the written reservation confirmation).",
        "Part B. Delay clause (arrival estimate, notice, cancellation right and long-stop date).",
        "Part C. Takedown policy (public notice plus the internal procedure).",
    ]),
    ("p", "Part D lists the customer-facing copy that must change to match. Part E lists the questions we need you to answer. Deleted base text is struck through; new text is underlined (tracked changes in the Word file). Comments addressed to counsel sit beside each clause. Items in square brackets are open decisions."),
    ("h2", "How to read the redline"),
    ("ul", [
        "\"Base\" is the 2026-11-08 draft wording, quoted verbatim from the spec and copy deck. Where a clause had no base wording, the whole clause is shown as inserted.",
        "Our drafting aim is plain English that a buyer can read on a phone, that leans in the buyer's favour where the business can afford it, and that never lets the business keep money for a puppy it could not deliver.",
        "Nothing here is legal advice. Every statutory reference is for you to confirm or correct.",
    ]),
    ("h2", "Status of the automated feed"),
    ("p", "The feed stays in dry-run until you sign off. The pipeline code has not been built yet. The switch that would allow automatic publishing (IMPORTS_AUTOPUBLISH) is not set in either environment file, and the build spec requires your sign-off on these terms before it is turned on (spec §11 item 9; task T17). Until then every listing goes to a private review queue and nothing is published without the owners' approval."),
    ("h2", "Points we most need your view on"),
    ("ol", [
        "Clause 5.2: the owners have set a fixed administration fee of S$250 if a buyer cancels before we pay the breeder. A flat fee may be more than our actual cost of handling a given reservation. Is S$250 defensible as a genuine pre-estimate, or does it risk being read as a penalty? (Q3)",
        "Clause 5.3: the owners have chosen to deduct only actual, receipted, unrecoverable costs, capped at what the buyer paid, with anything later recovered passed back. Please confirm this is enforceable and fair under the CPFTA and the Unfair Contract Terms Act. (Q3)",
        "Photos: the owners have decided to publish breeders' photos now, behind the takedown policy in Part C, while still asking each breeder for permission. One source site's terms prohibit republishing. Does the takedown procedure limit the exposure adequately? (Q9, Q10)",
        "Source disclosure: the owners have decided the buyer learns the breeder's identity in the reservation confirmation, after paying the deposit. Please confirm nothing in the CPFTA or the AVS pet-shop licence conditions requires it earlier. (Q6)",
        "Australian reservations: the owners have decided these terms cover them too (clause A1). Please advise how to bring reservations taken before these terms existed under them. (Q13)",
    ]),
]

# ---------------------------------------------------------------- Part A
PART_A = ("Part A. Reservation terms: imported puppies", [
    ("A1. Who these terms are between", [
        "{+These terms apply when you reserve an imported puppy from Curious Tails Pte Ltd (UEN 202420075D), trading as Curious Tails, an AVS-licensed pet shop (licence AS24J00046) at 2 Balestier Road #01-701, Singapore 320002 (\"we\", \"us\"). They apply to every puppy we import to order for you: puppies listed as \"Available for reservation · Imported\" and puppies listed as \"In Australia · Reserve\". ⟦Puppies already in our shop are sold on our standard terms.⟧+}",
    ], "New clause. We found no written terms of sale for in-shop puppies on the website or in the project files. If none exist, delete the last sentence, or advise whether a short standard terms document should be drafted in parallel. Revised 2026-11-13 (owner decision, Q13): these terms now also cover the Australian reservations the live site already takes. We widened this scope clause rather than drafting a second document, and made B2 country-neutral. Please advise how to apply the terms to Australian reservations taken before they existed, for example by sending them with a fresh confirmation for the buyer to accept."),

    ("A2. What a reservation is", [
        "[-No. -]This puppy is {+not in Singapore and is not yet owned by us. It is with a breeder overseas. It is +}available for reservation and will be imported for you{+ if you reserve it+}.",
        "We confirm {+with the breeder that +}this puppy is still available before you pay anything{+, normally within 48 hours of your message. A listing on our website is an invitation to enquire, not an offer to sell. No contract exists, and you owe nothing, until we send you a written reservation confirmation and you pay the deposit+}.",
        "{+Your reservation confirmation identifies the puppy by our reference number, sex and colour, and by its microchip number. It also gives the name of the puppy's breeder, the price, the deposit, the balance, the estimated arrival date and the month it falls in, and the version of these terms.+}",
    ], "Base: copy deck §4 FAQ \"Is this puppy in your shop?\" and §3 \"We confirm this puppy is still available before you pay anything.\" Aim: meet the CPFTA concern that we advertise goods we do not yet own (risk R4). The listing is framed as an invitation to treat and no money is taken before the breeder confirms. Please confirm the framing works, and whether \"not yet owned by us\" must appear on the listing itself as well as in these terms. Revised 2026-11-13 (owner decision, Q6): the confirmation now names the breeder. The buyer learns the breeder's identity there, after paying the deposit: not before payment, and not never. The website still does not name the supplier. The confirmation also gives an estimated arrival date as well as its month (D6, see B1)."),

    ("A3. Price", [
        "[-Yes. -]The price {+in your reservation confirmation +}[-shown -]is all-in, delivered to your door{+ in Singapore, and it is fixed from the date of that confirmation+}. No import, flight{+, crate, veterinary certification+} or clearance fees are added later{+, even if our own costs go up+}.",
        "{+The price includes: the AVS import licence; the veterinary checks and health certificate needed for export; the flight to Singapore; AVS clearance at Changi; home delivery and setup; the 30+ item starter kit; a free first training lesson with an AVS-certified trainer; ongoing WhatsApp support; and the puppy's first Singapore dog licence.+}",
    ], "Base: copy deck §4 FAQ \"Is the price final?\" We have kept the fixed price and not added a price-variation clause. The business has not yet confirmed that its flat S$4,000 margin over the breeder's price covers landed cost (owner decision D2b). If it doesn't, the business absorbs the loss, which is the owners' commercial call. Revised 2026-11-13 (owner decisions): the first Singapore dog licence is included in the all-in price. The company is not GST-registered, so the terms carry no GST statement (Q14 closed)."),

    ("A4. Deposit and balance", [
        "{+4.1 +}[-Deposit 1 (50%)-]{+To reserve, you pay a deposit of 50% of the price+} by PayNow or bank transfer[-, as the shop does today-]{+, after we have confirmed availability. We send your written reservation confirmation within 1 business day of receiving the deposit. We pay the breeder only after your deposit has cleared+}.",
        "{+4.2 +}[-Balance (50%) is due-]{+The remaining 50% (the balance) is due+} before the puppy flies, after [-the flight and health certificate are confirmed-]{+we have sent you written confirmation of the booked flight, the puppy's pre-export vet check, and copies of its vaccination, worming and microchip records+}.",
        "{+4.3 +}[-Balance unpaid 7 days after the flight is confirmed: the reservation lapses. Deposit treatment as per the previous bullet.-]{+If the balance is not paid within 7 days after we send that confirmation, we will remind you in writing. If it is still unpaid 3 business days after the reminder, we may cancel the reservation, and clause 5.3 applies as if you had cancelled.+}",
    ], "Base: spec §5 steps 3 and 5 and the \"Balance unpaid\" bullet. Changes: (1) we pay the breeder only after the deposit clears, so there is never an unfunded purchase; (2) the balance is triggered by documents the buyer can see; (3) a written reminder before lapse, for fairness. Owner to check with the pet-relocation agent (task T20) that 7 + 3 days still leaves time to pay the agent before the flight."),

    ("A5. If you cancel", [
        "{+5.1 You may cancel at any time by telling us in writing. A WhatsApp message counts.+}",
        "{+5.2 +}[-Buyer cancels-]{+If you cancel+} before [-Curious Tails has-]{+we have+} paid the breeder: {+we refund your deposit within 7 business days, +}[-full refund -]less a {+fixed administration fee of +}S$[-___ admin fee (D8)-]{+250 for the work we have done on your reservation.+}",
        "{+5.3 +}[-Buyer cancels after the breeder is paid or the flight is booked: the deposit is non-refundable except for costs that can be recovered. Legal to confirm this is fair under the CPFTA.-]{+If you cancel after we have paid the breeder or booked the flight, we refund what you have paid less the costs we have actually incurred and cannot recover, such as the price paid to the breeder, a non-refundable flight or agent fee, and veterinary certification already done. We will show you these costs with receipts, and the deduction will never be more than the amount you have paid. If we later sell or rehome the puppy and recover any of those costs, we refund that amount to you within 7 business days of receiving it.+}",
        "{+5.4 Cancelling under clause 6 (import cannot go ahead) or under the delay clause in Part B is never treated as cancelling under this clause.+}",
    ], "Base: spec §5 bullets 3 and 4. The base made the whole deposit non-refundable once the breeder is paid, which could exceed the business's actual loss. Our redline limits the deduction to actual, receipted, unrecoverable cost and passes back anything recovered later. Please advise on enforceability (penalty versus genuine pre-estimate, or a deposit as earnest money) and on fairness under the CPFTA and the Unfair Contract Terms Act. Revised 2026-11-13 (owner decisions). 5.3: the owners have confirmed this approach (actual, receipted, unrecoverable costs only, capped at what the buyer paid, with anything later recovered passed back); the clause is unchanged. 5.2: the owners have set the admin fee (D8) at a fixed S$250. We have written it as a fixed administration fee for the work done on the reservation, and removed the earlier draft's words capping it at our actual cost of handling. That creates a tension we do not want to hide: a flat S$250 may be more than the real cost of handling a particular reservation, and a fee that exceeds the real loss risks being read as a penalty rather than a genuine pre-estimate. Please advise whether S$250 is defensible as a genuine pre-estimate of the cost of handling a reservation before the breeder is paid and, if not, what would make it so. A cancellation under clause 6 or Part B never attracts the fee (5.4)."),

    ("A6. If the import cannot go ahead", [
        "{+6.1 +}[-Import can't go ahead for reasons outside the buyer's control-]{+This clause applies if the import cannot go ahead for any reason that is not your fault, including+}: the breeder sells to someone else{+ or withdraws+}, the puppy fails its vet check{+ or a vet advises it is unfit to fly+}, AVS refuses [-or delays -]the licence, {+the puppy is refused entry at Changi, +}an airline embargo, [-or -]a breed-rule change{+, or the puppy dies, is injured or falls seriously ill before it is handed over to you. In any of these cases, we refund everything you have paid+}. [-Full deposit refund-]{+The refund is in full, with no deductions, and is paid+} within 7 business days[-, or the buyer can choose to move the deposit to another puppy-]{+. If you prefer, you can move it to another puppy instead+}.",
        "{+6.2 We will tell you within 1 business day of learning that the import cannot go ahead.+}",
        "{+6.3 We will not require you to accept a different puppy, and offering one does not delay your refund.+}",
    ], "Base: spec §5 bullet 1. Changes: the trigger widens from \"outside the buyer's control\" to \"not your fault\", so failures on our side, such as a missed booking, are also covered; the refund covers the balance as well as the deposit; and death or illness before handover is added. \"AVS delays the licence\" moves to the delay clause, because a delay is not a failure. Please confirm a 7-business-day refund period is acceptable."),

    ("A7. Health records and our 5-day promise", [
        "{+7.1 Before you pay the balance, we send you copies of the puppy's vaccination, worming and microchip records and its pre-export vet check. If those records show a health problem you were not told about before you reserved, you may cancel and clause 6 applies.+}",
        "{+7.2 Our 5-day promise. +}If your puppy falls sick within the first 5 days of arriving home in Singapore, bring them back and we'll nurse them ourselves{+ and pay the vet fees at our appointed vet+}. [-For imported puppies, the-]{+The+} 5 days start on the day your puppy arrives home, not on the day you reserve.",
        "{+7.3 This promise is in addition to your rights under Singapore law, including the Consumer Protection (Fair Trading) Act, and does not limit them.+}",
    ], "Base: copy deck §3 \"Our 5-day promise (imported puppies)\". Revised 2026-11-13 (owner decision): the promise covers nursing plus vet fees at our appointed vet. The website's promise for local puppies says only that we nurse the puppy ourselves and does not mention vet fees, so the two now differ; the owners may want to align the local wording (no website change is made here). 7.3 is there so the promise cannot be read as replacing statutory remedies. Please advise whether the CPFTA's lemon-law provisions (Part 3) apply to a live animal and, if they do, whether 7.3 is enough."),

    ("A8. Risk and ownership", [
        "{+8.1 The puppy is at our risk until we hand it over to you at your home. Ownership passes to you at handover, once the price has been paid in full.+}",
        "{+8.2 If anything happens to the puppy before handover, clause 6 applies.+}",
    ], "New clause. The draft was silent on risk during the flight and in transit. Keeping risk with the business until handover matches \"delivered to your door\". Owner to ask the pet-relocation agent (task T20) about transit insurance."),

    ("A9. Photos and descriptions", [
        "{+9.1 Listing photos and details come from the breeder and show the puppy when they were taken. Puppies grow and change quickly. Before you pay a deposit you may ask for fresh photos or a video, and we will request them from the breeder.+}",
        "{+9.2 We describe coat colour, likely adult size and temperament in good faith, but we cannot guarantee them, especially for cross-breeds. We do not describe an imported puppy as pedigree or registered unless the breeder's registration papers are listed in your reservation confirmation.+}",
    ], "New clause. Base copy deck §4 FAQ \"Can I see more photos or a video first?\" already promises fresh photos on request. The website's banned-words list already excludes \"pedigree\" and \"DNA\"."),

    ("A10. What's included", [
        "What's included: the same as every Curious Tails puppy{+, from the day your puppy arrives+}. The 30+ item starter kit ($500+ value), free home delivery and setup, a free first lesson with an AVS-certified trainer, and WhatsApp support for as long as you need it.",
        "{+If you are not ready on arrival day, we board your puppy free, with lodging and food covered, for the first 14 days after arrival. After that, a daily boarding rate applies, and we tell you the rate in writing before you reserve.+}",
    ], "Base: copy deck §3 \"What's included\". The website promises free boarding after the deposit for local puppies (pricing, delivery and home pages), and the owners asked for the same perks on imports. For an import, boarding can only start on arrival, so the perk is restated here to avoid a claim that boarding should start at the deposit. Revised 2026-11-13 (owner decision): boarding is free for the first 14 days after arrival, then a daily rate applies. The rate is not set here and is not published; the clause promises to tell the buyer the rate in writing before they reserve, and the reservation confirmation does not state it. Please advise whether a daily rate that is unpublished, and not stated in the confirmation, is enforceable, or whether the confirmation must state it."),

    ("A11. Your personal data", [
        "{+We use your details only to manage your reservation, the import and after-sale support, as set out in our privacy policy (curioustails.sg/privacy-policy/). We share them only with the parties needed to import your puppy: AVS, our pet-relocation agent, the airline and the exporting vet. ⟦Counsel: confirm whether the buyer or Curious Tails is named as importer on the AVS licence.⟧+}",
    ], "New clause. The privacy policy (last updated 2026-07-07) does not yet mention sharing data with an overseas vet or relocation agent; it may need a matching line."),

    ("A12. Law and disputes", [
        "{+These terms are governed by Singapore law. If we cannot resolve a complaint together, either of us may refer it to ⟦mediation, e.g. CASE⟧ or, where eligible, to the Small Claims Tribunals.+}",
    ], "New clause. Please name the dispute route you prefer."),
])

# ---------------------------------------------------------------- Part B
PART_B = ("Part B. Delay clause", [
    ("B1. Estimated arrival", [
        "[-Arrival dates are estimates.-]{+Your reservation confirmation gives an estimated arrival date and the month it falls in. It is an estimate, not a fixed date.+} Puppies can fly to Singapore from 12 weeks old, and every import depends on AVS approval, the vet health certificate and an available flight.",
        "{+Puppies fly at about 3 months old, so we work out the estimate from your puppy's date of birth: date of birth plus about 3 months. For example, if you reserve a puppy at 8 weeks old, it should arrive in about 4 weeks. At 6 weeks old, it should arrive in about 6 weeks.+}",
        "{+If your puppy is already about 3 months old when you reserve, it flies once its paperwork and flight are ready, and your confirmation gives our estimate for that.+}",
        "{+Once your confirmation is sent, the estimate in it does not change unless we tell you about a delay under B3. The 45-day and 90-day periods in B4 and B5 count from the end of the estimated month.+}",
    ], "Base: copy deck §3 \"About the arrival estimate\" and FAQ \"What if the arrival is late?\" (\"We give an estimated month, never a fixed date\"). Revised 2026-11-13 (owner decision D6): the estimate is age-based, not a fixed number of weeks. Puppies fly at about 3 months old, so the estimate is the puppy's date of birth plus about 3 months, given as a date and its month in the confirmation. The earlier draft's minimum lead time is removed and is not promised. The worked example uses 12 weeks as the flying age. The sentence on a puppy already about 3 months old when reserved stays as drafted (owner decision, 2026-11-13); there is no maximum-wait promise. B4 and B5 still count from the end of the estimated month, the more generous reading for the buyer. Engineering note: the pipeline recalculates the estimate on every run, so the contractual month must be frozen in the confirmation and not taken from the live listing."),

    ("B2. What can cause a delay", [
        "{+Delays can be caused by: AVS or the authorities in the puppy's home country taking longer to issue a licence or certificate; a vet advising that the puppy should wait before flying; airline embargoes, cancellations or seasonal restrictions on carrying animals; disease-control or other government restrictions; and changes to import rules.+}",
    ], "New. This list describes what can happen. It does not limit the buyer's rights in B4 and B5. Revised 2026-11-13: \"the Irish authorities\" became \"the authorities in the puppy's home country\", so the clause also works for Australian reservations (Q13)."),

    ("B3. Keeping you informed", [
        "We'll keep you updated at every step on WhatsApp. {+Within 2 business days of learning of anything likely to push arrival past the estimated month, we will tell you the reason and give you a revised estimate.+}",
    ], "Base: copy deck §3 \"We'll keep you updated at every step on WhatsApp.\" The notice period is new."),

    ("B4. Your options if arrival is late", [
        "{+If the puppy has not arrived by the last day of the estimated month, you may choose to keep waiting or to move your payment to another puppy. +}If [-arrival slips more than 45 days past that month-]{+it has not arrived within 45 days after the end of the estimated month+}, you may {+also +}cancel for a full refund{+ of everything you have paid, at any time before the puppy departs for Singapore. We pay the refund within 7 business days. This applies whatever the cause of the delay+}.",
    ], "Base: copy deck §4 FAQ and spec §5 bullet 2 (\"may cancel for a full refund\"). Changes: the refund covers the balance; it applies whatever the cause; the right ends once the puppy is in the air, because a puppy in transit cannot practically be returned. Please confirm that cut-off is fair, or delete \"at any time before the puppy departs for Singapore\"."),

    ("B5. Long-stop date", [
        "{+If the puppy has not arrived within 90 days after the end of the estimated month, the reservation ends automatically and we refund everything you have paid, in full, within 7 business days, unless you have told us in writing that you want to keep waiting.+}",
    ], "New. Without a long-stop date a buyer who stays silent could be left waiting indefinitely. Revised 2026-11-13: the owners have set the long-stop at 90 days."),

    ("B6. If the import cannot go ahead", [
        "If your puppy can't come, [-your deposit comes back to you-]{+clause 6 of the reservation terms applies and everything you have paid comes back to you+}.",
    ], "Base: copy deck §3 \"About the arrival estimate\", last sentence. It mentioned only the deposit, but by this stage the buyer may also have paid the balance."),

    ("B7. Events outside our control", [
        "{+We are not liable to pay compensation for a delay caused by events outside our reasonable control. This never affects your right to a refund under this Part or under clause 6.+}",
    ], "New. This limits damages for delay but deliberately is not a force-majeure clause that would let the business keep money. Please advise whether excluding compensation passes the reasonableness test under the Unfair Contract Terms Act."),
])

# ---------------------------------------------------------------- Part C
PART_C = ("Part C. Takedown policy", [
    ("C1. Public notice (proposed page /content-requests/, linked from the footer and the privacy policy)", [
        "{+If you believe a photo, video or text on this website belongs to you and is used without your permission, or that a listing is inaccurate, email hello@curioustails.sg with: your name and contact details; the page address and the item concerned; why you believe it is yours or is inaccurate; and a statement that the information in your request is true.+}",
        "{+We remove the item from public view within 24 hours of receiving your request while we look into it, and we reply within 2 business days. If you took the photo, or you are the puppy's breeder or owner, and you ask us to, the item stays down and we delete our copies. We do not ask you to prove your case before we take an item down.+}",
    ], "New public text. It names no supplier or platform. It promises removal before investigation, matching the 24-hour target in the spec. Please confirm: (a) whether the Copyright Act 2021 safe-harbour provisions can apply (our working assumption is that they cannot, because Curious Tails chooses and publishes the photos itself rather than hosting other people's uploads); (b) whether this notice should sit inside the privacy policy instead of on its own page."),

    ("C2. Internal procedure (owner SOP, not published)", [
        "[-A 24-hour takedown path with imports:unpublish --purge-images, plus an audit trail.-]{+1. Triggers. Any of: a complaint from anyone claiming to own a photo, video or text; an objection from a breeder or a listing platform; a legal letter; a request from AVS, CCCS, CASE or another authority; evidence that a listing is false, already sold, or raises a welfare concern.+}",
        "{+2. Within 24 hours. Run: npm run imports:unpublish -- <ref> --reason takedown --purge-images --deploy. Check that the listing page now redirects to the breed page and that each image address returns \"not found\" on the live site. The command writes an audit line with the person and time.+}",
        "{+3. Within 2 business days. Reply with the standard acknowledgement: the item is down, here is what happens next. Do not admit liability, and do not name other sources or the buyer. Send to counsel on the same day: any legal letter, any claim for money, and any request for buyer or reservation details.+}",
        "{+4. Reserved puppies. If the listing has an active reservation, the reservation continues and only the content is removed. Tell the buyer on WhatsApp and ask the breeder for permission or fresh photos.+}",
        "{+5. Source controls. If the complaint is from a breeder, block that seller in the pipeline so the listing is never imported again. If a platform objects to our collecting its listings, switch off that source until the owners and counsel decide; that decision joins decision D3, already open for one source.+}",
        "{+6. Records. Keep the complaint, our reply and the audit line in the private store for ⟦period: counsel to set⟧. If a legal letter or claim has been received, keep the original image files as evidence instead of purging them, and suspend the 90-day purge for that record until counsel says otherwise.+}",
        "{+7. Never republish. A removed item is never republished without written permission from the person who complained, or from the photographer or breeder.+}",
        "{+8. Monthly check. Count takedowns by source. Any source with ⟦2⟧ or more in a month goes to the owners for a decision to keep or drop it.+}",
    ], "Base: risks file R2 (\"A 24-hour takedown path with imports:unpublish --purge-images, plus an audit trail\") and spec §7 (\"gone from the live site within one deploy, about 5 minutes\"). Change to note: the spec purges original images on takedown, but step 6 keeps them as evidence once a legal claim exists. Please confirm the retention period and the hold."),
])

# ---------------------------------------------------------------- Part D
PART_D_INTRO = "These lines in the copy deck (reports/imported-puppy-copy-deck-2026-11-08.md) were changed on 2026-11-13 so the website and WhatsApp messages say the same as the contract. The 2026-11-08 wording is shown for reference. None of this is on the website yet; the wording is for approval together with Parts A–C."
PART_D_HEAD = ("Where", "Copy deck, 2026-11-08", "Copy deck now (2026-11-13)")
PART_D = [
    ("§3 Price box, small print",
     "Includes the import, flight, AVS clearance, home delivery & setup, starter kit and first training lesson.",
     "Includes the import, flight, AVS clearance, first dog licence, home delivery & setup, starter kit and first training lesson."),
    ("§3 \"Our 5-day promise (imported puppies)\"",
     "If your puppy falls sick within the first 5 days of arriving home in Singapore, bring them back and we'll nurse them ourselves. For imported puppies, the 5 days start on the day your puppy arrives home, not on the day you reserve.",
     "If your puppy falls sick within the first 5 days of arriving home in Singapore, bring them back and we'll nurse them ourselves and pay the vet fees at our appointed vet. For imported puppies, the 5 days start on the day your puppy arrives home, not on the day you reserve."),
    ("§3 \"About the arrival estimate\"",
     "Arrival dates are estimates. Puppies can fly to Singapore from 12 weeks old, and every import depends on AVS approval, the vet health certificate and an available flight. We'll keep you updated at every step on WhatsApp. If your puppy can't come, your deposit comes back to you.",
     "Puppies fly at about 3 months old, so we work out the arrival estimate from your puppy's date of birth. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. It's an estimate, not a fixed date: every import depends on AVS approval, the vet health certificate and an available flight. We'll keep you updated at every step on WhatsApp. If your puppy can't come, everything you've paid comes back to you."),
    ("§4 FAQ \"Is my deposit refundable?\"",
     "Yes, in full, if the import can't go ahead for a reason outside your control. That includes the puppy no longer being available, failing its vet check, the import licence not being approved, or flight restrictions. You can also move your deposit to another puppy instead. Full terms are in your written reservation. (Pending legal review, T17.)",
     "Yes, in full, if the import can't go ahead for any reason that isn't your fault, or if arrival is more than 45 days late. If you change your mind before we've paid the breeder, we refund your deposit less a S$250 admin fee. After that, we refund what you've paid less the costs we can't recover, shown with receipts. Full terms come with your written reservation."),
    ("§3 \"Boarding on arrival\" (new)",
     "(none)",
     "If you're not ready on arrival day, we board your puppy free, with lodging and food covered, for the first 14 days after arrival. After that, a daily boarding rate applies, and we tell you the rate in writing before you reserve."),
    ("§4 FAQ \"How soon will my puppy arrive?\" (new)",
     "(none)",
     "Puppies fly at about 3 months old, so it depends on your puppy's age. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. Your written reservation gives an estimated date, worked out from your puppy's date of birth. If your puppy is already about 3 months old when you reserve, it flies once its paperwork and flight are ready, and your written reservation gives our estimate for that."),
    ("§4 FAQ \"What if the arrival is late?\"",
     "We give an estimated month, never a fixed date. If arrival slips more than 45 days past that month, you may cancel for a full refund.",
     "We give an estimated month, never a fixed date, and tell you within 2 business days if anything is likely to delay it. If arrival is more than 45 days past that month, you may cancel for a full refund of everything you've paid."),
    ("§4 FAQ \"Is the price final?\"",
     "Yes. The price shown is all-in, delivered to your door. No import, flight or clearance fees are added later.",
     "Yes. The price shown is all-in, delivered to your door, and includes your puppy's first dog licence. No import, flight or clearance fees are added later."),
    ("§7 Reservation confirmation, new lines",
     "(none)",
     "Breeder: {breederName}. Puppy microchip: {microchip}. Terms version: {termsVersion}. Full terms attached."),
    ("§7 Reservation confirmation, arrival bullet",
     "Estimated arrival: {Month YYYY}, subject to AVS import approval, the vet health certificate and flight availability. This is an estimate, not a fixed date.",
     "Estimated arrival: around {arrivalDate}, in {Month YYYY}. We work this out from your puppy's date of birth ({dob}), because puppies fly at about 3 months old. It's an estimate, not a fixed date, and depends on AVS import approval, the vet health certificate and flight availability."),
    ("§7 Reservation confirmation, refund bullet",
     "If the import can't go ahead for a reason outside your control, your deposit is refunded in full within 7 business days, or moved to another puppy if you prefer. If arrival is more than 45 days later than the estimated month, you may cancel for a full refund.",
     "If the import can't go ahead for any reason that isn't your fault, everything you've paid is refunded in full within 7 business days, or moved to another puppy if you prefer. If you cancel before we've paid the breeder, we refund your deposit less a S$250 admin fee; after that, less only the costs we can't recover, shown with receipts. If arrival is more than 45 days later than the estimated month, you may cancel for a full refund."),
    ("§7 Reservation confirmation, 5-day and included bullets",
     "Our 5-day promise starts on the day your puppy arrives home. / Included: 30+ item starter kit, home delivery and setup, free first training lesson, ongoing WhatsApp support.",
     "Our 5-day promise (nursing, plus vet fees at our appointed vet) starts on the day your puppy arrives home. / Included: first dog licence, 30+ item starter kit, home delivery and setup, free first training lesson, ongoing WhatsApp support."),
    ("§7 Reservation confirmation, footer",
     "(Full terms: pending legal review, T17.)",
     "Remove once counsel signs off, and attach the signed-off terms."),
    ("Live site: OverseasPuppies.astro (Australian reservations)",
     "Pay a 50% deposit and we begin the import process; the remaining 50% is due before your puppy flies to Singapore.",
     "Owner decision (Q13): these terms cover Australian reservations too (clause A1). Send the terms with every Australian reservation confirmation, and add a line such as \"Full terms come with your written reservation.\" This is a website change for a separate task; it is not made here."),
]

# ---------------------------------------------------------------- Part E
PART_E = [
    "Q1. Overall: is the plain-English, buyer-favourable approach acceptable? Is anything missing that a Singapore consumer contract for a live animal must contain?",
    "Q2. A2: does framing the listing as an invitation to enquire, with no money taken until the breeder confirms, deal with the CPFTA risk of advertising a puppy we do not yet own (risk R4)?",
    "Q3. A5.2 and A5.3: is deducting actual, receipted, unrecoverable costs (5.3) enforceable, and fair under the CPFTA and the Unfair Contract Terms Act? Is the fixed S$250 administration fee the owners have set (5.2, decision D8) defensible as a genuine pre-estimate of the cost of handling a reservation, or at risk of being read as a penalty?",
    "Q4. A6 and B4: is a 7-business-day refund period acceptable? Should interest or a longer period apply?",
    "Q5. A7.3: does CPFTA Part 3 (lemon law) apply to a live animal? Does the 5-day promise need any further wording?",
    "Q6. Source disclosure: the owners have decided the buyer learns the breeder's identity in the reservation confirmation, sent after the deposit is paid (A2). The website still does not name the supplier. Does the CPFTA, or do the AVS pet-shop licence conditions (task T18 is asking AVS directly), require disclosure any earlier?",
    "Q7. A11: on the AVS import licence, should the buyer or Curious Tails be the importer? Does the answer change who carries risk or which data we must share?",
    "Q8. B4 and B5: are the 45-day cancellation trigger, the cut-off at departure and the 90-day long-stop (set by the owners) fair and workable?",
    "Q9. Photos: the owners have decided to publish breeders' photos now, behind the takedown policy in Part C, and to keep asking each breeder for permission in the contact template. Until a breeder agrees, the photo is used without a licence, a risk the owners have accepted (spec decision 3). One source site's terms expressly prohibit republishing its material (decision D3 on that source is unchanged). What is the realistic exposure under Irish and Singapore copyright law, and does Part C limit it adequately?",
    "Q10. C1: can any safe harbour under the Copyright Act 2021 apply, given that Curious Tails selects and publishes the photos itself?",
    "Q11. Collecting listings: the feed only reads public pages, follows each site's robots.txt, and stops if a site blocks it. Is there any further exposure, such as breach of site terms or database rights, in using listing data from Irish platforms commercially?",
    "Q12. Data protection: the pipeline stores Irish sellers' names and phone numbers or emails privately to contact them, and purges them 90 days after a listing ends. Is GDPR engaged, and is that retention defensible? Does the privacy policy need updating (A11)?",
    "Q13. Australian reservations: the owners have decided these terms cover them too (A1 widened, B2 made country-neutral). The live site already takes 50% deposits for Australian puppies (40 listings in the current data file, synced 2026-10-02) with no written terms. Does anything in the terms not fit an Australian import, and how should reservations taken before these terms be brought under them?",
    "Q15. A10: boarding is free for 14 days after arrival, then a daily rate applies that we tell the buyer in writing before they reserve. The rate is not published and is not in the reservation confirmation. Is it enforceable as written, or must the confirmation state it?",
]

PART_F_INTRO = "The owners answered all eleven open points on 2026-11-13 (task K-068). Applied in this version:"
PART_F = [
    "Registered company name: Curious Tails Pte Ltd (cover and A1).",
    "A5.3 cancellation: actual, receipted, unrecoverable costs only, capped at what the buyer paid, with anything later recovered passed back (A5.3, unchanged).",
    "D8 admin fee: a fixed S$250 (A5.2). See the note to counsel on A5 and Q3.",
    "Q9 photos: publish now behind the takedown policy; the breeder-permission request stays in the contact template (Part C, Q9).",
    "Q6 source disclosure: the breeder's identity is given in the reservation confirmation, not before payment (A2).",
    "Q13 Australian reservations: these terms cover them too (A1 scope; B2 wording).",
    "D6 lead time: age-based, not a fixed number of weeks. Puppies fly at about 3 months old, so the estimate is calculated from the date of birth and given as a date in the confirmation. No minimum lead time is promised (B1).",
    "A7.2 5-day promise: nursing plus vet fees at our appointed vet.",
    "A3 first dog licence: included in the all-in price.",
    "B5 long-stop: 90 days.",
    "Q14 GST: the company is not GST-registered; the terms carry no GST statement.",
    "A10 boarding (2026-11-13): free for the first 14 days after arrival, then a daily boarding rate, told to the buyer in writing before they reserve. No rate is set in these terms. See Q15.",
    "B1 older puppy (2026-11-13): the drafted sentence stays as it stands; no maximum-wait promise.",
]
PART_F_OPEN_INTRO = "Still open after 2026-11-13:"
PART_F_OPEN = [
    "D2b: confirm that the S$4,000 margin covers landed cost, after quotes from relocation agents (blocks go-live).",
    "D3: whether to use dogsforsaleireland.ie at all, given its terms prohibit republishing (unchanged; blocks go-live for that source).",
    "D7: the pet-relocation partner and procedure (blocks go-live).",
    "T18: AVS's written answer on source disclosure and commercial import (feeds Q6 and Q7).",
    "Australian page line: the live OverseasPuppies.astro copy needs a terms line (Part D); a website change for a separate task.",
    "Counsel's items in square brackets: A1 (in-shop terms), A11 (importer of record), A12 (dispute route), C2 (record period and takedown threshold).",
]
