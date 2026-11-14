# K-068: owner's T17 decisions applied (2026-11-13)

All eleven decisions are applied to the legal redline (Markdown and Word), the copy deck, the risks file, the spec, the task list and one research note. Nothing was deployed. No website or project code was changed.

**The Word file was regenerated with the original generator** (`reports/legal-redline-src/build_redline.py` + `redline_content.py`). It keeps the same format: tracked changes against the 2026-11-08 base wording (75 insertions, 23 deletions), 21 margin comments to counsel, Track Changes switched on, and the revision date now 2026-11-13. The base-text appendix is byte-identical to the 2026-11-11 version. The 2026-11-11 outputs, and every other file edited here, are backed up in `reports/legal-redline-src/superseded-2026-11-11/`.

## Decision → change → file

| # | Decision | Clause / line changed | File(s) |
|---|---|---|---|
| 1 | Curious Tails Pte Ltd | Cover "Business:" line; A1 (both redline and clean text) | redline .md/.docx |
| 2 | A5.3: actual, receipted, unrecoverable costs only | A5.3 wording unchanged (it already said this); A5 note records the confirmation; cover point 2; Q3. Deposit FAQ and §7 refund bullet now state it | redline; copy deck §4, §7; spec §5; risks file |
| 3 | D8 = fixed S$250 | A5.2 rewritten (see below); A5 note; Q3; Part F. Deposit FAQ and §7 refund bullet | redline; copy deck §4, §7; spec §5; risks D8 (closed) |
| 4 | Q9: publish photos now behind the takedown policy | Cover point 3; Q9 rewritten (exposure question kept, "should publishing wait" removed); breeder-permission request kept in template §6 with a note | redline; copy deck §6; risks R2 |
| 5 | Q6: breeder identity in the reservation confirmation | A2 (the confirmation now gives "the name of the puppy's breeder"); A2 note; Q6; cover summary. "Breeder: {breederName}" line and step 2 of the timeline | redline; copy deck §3, §7; spec §5 step 3; risks R11 |
| 6 | Q13: these terms cover Australian reservations | A1 scope widened to puppies listed "In Australia · Reserve"; B2 "the Irish authorities" → "the authorities in the puppy's home country"; Q13; Part D (OverseasPuppies.astro row: website change deferred to a separate task) | redline |
| 7 | D6: age-based lead time | B1 rewritten with the rule and worked example; A2 now "estimated arrival date and the month it falls in"; arrival FAQ added; §7 arrival bullet; 4-week floor withdrawn from spec §4 and task T6; research note marked superseded | redline; copy deck §3, §4, §7; spec §4; tasks.json T6; irish-supplier-research; risks D6, R5 |
| 8 | A7.2: nursing plus vet fees at our appointed vet | A7.2 "and pay the vet fees at our appointed vet"; A7 note flags that the local-puppy promise on the website doesn't mention vet fees | redline; copy deck §3, §7; spec §5; risks D13 |
| 9 | A3: first dog licence included | A3 price list; price-box small print; "Is the price final?" FAQ; §7 "Included" bullet | redline; copy deck §3, §4, §7 |
| 10 | B5: 90 days | B5 bracket removed; B5 note; Q8 | redline |
| 11 | Q14: not GST-registered | No GST statement in any clause or customer line. Q14 removed from Part E. A3 note and Part F record the decision. "Any GST statement" added to the copy deck's banned list | redline; copy deck header; risks file |

The risks file has a new section, "Owner decisions on the T17 open points (2026-11-13)", with all eleven decisions, the date and the owners' words as relayed in K-068. D8 is closed and D6 is decided as an age rule. The photo risk remains accepted. D3 is unchanged and still blocks go-live for that source.

## The two tensions, in the actual wording

**1. S$250 against "no more than our actual cost"**

A5.2 (clean text):
> 5.2 If you cancel before we have paid the breeder: we refund your deposit within 7 business days, less a fixed administration fee of S$250 for the work we have done on your reservation.

The sentence capping the fee at our actual cost of handling is gone. Note to counsel on A5:
> 5.2: the owners have set the admin fee (D8) at a fixed S$250. We have written it as a fixed administration fee for the work done on the reservation, and removed the earlier draft's words capping it at our actual cost of handling. That creates a tension we do not want to hide: a flat S$250 may be more than the real cost of handling a particular reservation, and a fee that exceeds the real loss risks being read as a penalty rather than a genuine pre-estimate. Please advise whether S$250 is defensible as a genuine pre-estimate of the cost of handling a reservation before the breeder is paid and, if not, what would make it so. A cancellation under clause 6 or Part B never attracts the fee (5.4).

This question is also point 1 of "Points we most need your view on" and Q3.

**2. Lead time as a formula**

B1 (clean text):
> Your reservation confirmation gives an estimated arrival date and the month it falls in. It is an estimate, not a fixed date. Puppies can fly to Singapore from 12 weeks old, and every import depends on AVS approval, the vet health certificate and an available flight.
>
> Puppies fly at about 3 months old, so we work out the estimate from your puppy's date of birth: date of birth plus about 3 months. For example, if you reserve a puppy at 8 weeks old, it should arrive in about 4 weeks. At 6 weeks old, it should arrive in about 6 weeks.
>
> If your puppy is already about 3 months old when you reserve, it flies once its paperwork and flight are ready, and your confirmation gives our estimate for that.
>
> Once your confirmation is sent, the estimate in it does not change unless we tell you about a delay under B3. The 45-day and 90-day periods in B4 and B5 count from the end of the estimated month.

Copy deck §3, "About the arrival estimate":
> Puppies fly at about 3 months old, so we work out the arrival estimate from your puppy's date of birth. Reserve at 8 weeks old and your puppy should arrive in about 4 weeks; at 6 weeks old, in about 6 weeks. It's an estimate, not a fixed date: […]

The 4-week minimum no longer appears as a promise anywhere. It is withdrawn from B1, spec §4 (`LEAD_WEEKS` floor) and the T6 acceptance test.

## Placeholder sweep (after the changes)

Repo-wide, excluding `node_modules`, `dist` and the backup folder:

```
=== [registered company name] / S$___ / LEAD_WEEKS / FLOOR_WEEKS ===
reports/imported-puppy-legal-redline-2026-11-11.md:457:**A5. If you cancel**: Buyer cancels before Curious Tails has paid the breeder: full refund less a S$___ admin fee (D8) ...   <- base-text appendix (2026-11-08 wording, verbatim)
reports/imported-puppy-pipeline-spec-2026-11-08.md:196: ... The earlier `floor = today + LEAD_WEEKS (default 4)` is withdrawn ...                                                 <- withdrawal note
research/ai-visibility/baseline-2026-10-18.json:552: ... "each shop's licence number, registered company name, premises address" ...                                <- unrelated (AI answer quoting AVS list columns)
```

Line 85 of the redline also holds `S$~~___ admin fee (D8)~~`, which is struck-through base text (the grep above searched for `S$___` unbroken). In the Word file, `[registered company name]` and `S$___` occur 0 times in live text. The only `___` is inside a tracked deletion.

`4 weeks` / `4-week`: every hit is the worked example ("8 weeks old … about 4 weeks") or a record of the withdrawal. These are risks-file decision #7 (the owners' words), risks D6 ("The earlier 4-week floor is withdrawn") and the 2026-11-08 research recommendation, now marked superseded.

`admin fee`: every live hit says S$250. The exceptions are the struck base text in A5.2, the base-text appendix, and task T17's original brief in `imported-puppy-tasks-2026-11-08.json:265` ("Confirm … admin fee (D8)"), which records the task's scope and isn't a figure.

`GST`: no customer-facing or contractual line. The hits are decision records only: redline A3 note and Part F, the copy deck's banned list and change note, and risks-file decision #11.

The `{…}` variables in the copy deck (`{breederName}`, `{arrivalDate}`, `{termsVersion}`) are template fields, not open decisions. The earlier `version ___` blank in Part D is now `{termsVersion}`.

## What a buyer reading the confirmation now knows that they didn't before

The confirmation now tells the buyer **who the breeder is**. Before, they had no way to learn the source. It gives an **estimated arrival date**, not just a month, and shows that the date comes from **their puppy's own date of birth**, because puppies fly at about three months old. So the buyer can check the arithmetic themselves. It tells them the exact cost of changing their mind before the breeder is paid: **a fixed S$250**, not "an admin fee to be set". After that point, they lose only receipted costs we can't recover. It confirms that the **first dog licence is included** in the all-in price. It says the 5-day promise covers **vet fees at our appointed vet** as well as nursing. And it carries the puppy's microchip number and the version of the terms that bind both sides.

## Still open (not covered by the eleven answers; nothing invented)

- **B1, a puppy already about 3 months old when reserved.** The age rule gives a date already past. The redline says the puppy "flies once its paperwork and flight are ready" and the confirmation gives our estimate. That sentence is drafting, not an owner decision, and is flagged for the owners to confirm. Spec §4 and T6 leave this case open rather than set a number.
- **Boarding limit (A10)**; D2b, D3 and D7 (all block go-live); T18 (AVS); counsel's bracketed items in A1, A11, A12 and C2.
- **Australian reservations already taken** before these terms existed: counsel is asked how to bring them under the terms. The live OverseasPuppies.astro copy is unchanged; that is a separate website task.
- **Local 5-day promise:** the website's local-puppy promise doesn't mention vet fees, so it now differs from the imported one. Flagged to the owners only; no website change was made.
