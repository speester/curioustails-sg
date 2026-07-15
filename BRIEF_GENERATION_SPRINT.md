# Brief Generation Sprint — Parallel Strategy

## Goal
Generate all 104 briefs in parallel (~60-90 minutes total, not 260 minutes).

## Setup: Open Multiple Claude Code Windows

**Recommended: 4 parallel windows** (adjust based on your machine)

```
Window 1: Claude Code (Briefs 1-26)
Window 2: Claude Code (Briefs 27-52)
Window 3: Claude Code (Briefs 53-78)
Window 4: Claude Code (Briefs 79-104)
```

---

## Step 1: Extract Your Slice

Each window gets 26 commands. Extract from `scripts/brief-generation-checklist.json`:

**Window 1 (Briefs 1-26):**
```
/page-brief /blog/puppy-fireworks-singapore
/page-brief /blog/puppy-first-night
/page-brief /blog/small-dog-breeds-singapore
/page-brief /blog/maltipoo-price-singapore
/page-brief /blog/crate-training-puppy
/page-brief /blog/cheap-puppies-singapore
/page-brief /blog/cavapoo-full-grown-size
/page-brief /blog/french-bulldog-hdb
/page-brief /blog/new-puppy-checklist
/page-brief /blog/hypoallergenic-dogs-singapore
/page-brief /blog/shiba-inu-price-singapore
/page-brief /blog/stop-puppy-biting
/page-brief /blog/free-puppy-adoption-singapore
/page-brief /blog/maltipoo-lifespan
/page-brief /blog/cavapoo-hdb-approved
/page-brief /blog/puppy-sleep-schedule
/page-brief /blog/puppy-friendly-cafes-singapore
/page-brief /blog/corgi-price-singapore
/page-brief /blog/puppy-barking-training
/page-brief /blog/imported-vs-local-puppies
/page-brief /blog/long-haired-mini-dachshund
/page-brief /blog/biggest-hdb-approved-dogs
/page-brief /blog/puppy-feeding-schedule
/page-brief /blog/dog-parks-singapore
/page-brief /blog/mini-dachshund-price-singapore
/page-brief /blog/puppy-obedience-basics
```

(Continue for Windows 2, 3, 4...)

---

## Step 2: Run in Parallel

In each Claude Code window, paste your slice of commands one at a time:

```
1. Paste: /page-brief /blog/puppy-fireworks-singapore
   Wait for: "✅ Brief written to briefs/..."
   
2. Paste: /page-brief /blog/puppy-first-night
   Wait for: "✅ Brief written to briefs/..."
   
... (repeat for all 26 in your slice)
```

**Expected output each time:**
```
✅ Brief written to briefs/<slug>.json
Info-gain score: 68% (P1/P2 sections)
Dual-intent: No
Next: blog-writer
```

---

## Step 3: Monitor Progress

**Check completion in real-time:**

```bash
# Count generated briefs
ls briefs/*.json | wc -l

# Should grow from 5 → 109 as windows run
```

**Estimate time:**
- 2.5 min per brief × 26 briefs per window = 65 min per window
- **Parallel: 65 minutes total** (not 260)

---

## Step 4: Validation (After All Complete)

Once all windows finish:

```bash
# Verify all 104 briefs exist
expected=104
actual=$(ls briefs/*.json | wc -l)

if [ $actual -ge $((expected + 5)) ]; then
  echo "✅ All briefs generated!"
else
  echo "⚠️  Missing $((expected - actual)) briefs"
  # Re-run missing ones individually
fi
```

---

## Step 5: Update Automation to Use Cached Briefs

Once all briefs are cached, update `blog_creator_daily.mjs`:

```javascript
// After recording topic as pending:
const briefPath = path.join(projectRoot, `briefs/${slugFilename}.json`);
if (fs.existsSync(briefPath)) {
  console.log('✅ Using cached brief (no live research needed)');
  // Now safe to call blog-writer immediately
}
```

---

## Parallel Window Command Slices

### Window 1 (Briefs 1-26): Paste This
```
/page-brief /blog/puppy-fireworks-singapore
/page-brief /blog/puppy-first-night
/page-brief /blog/small-dog-breeds-singapore
/page-brief /blog/maltipoo-price-singapore
/page-brief /blog/crate-training-puppy
/page-brief /blog/cheap-puppies-singapore
/page-brief /blog/cavapoo-full-grown-size
/page-brief /blog/french-bulldog-hdb
/page-brief /blog/new-puppy-checklist
/page-brief /blog/hypoallergenic-dogs-singapore
/page-brief /blog/shiba-inu-price-singapore
/page-brief /blog/stop-puppy-biting
/page-brief /blog/free-puppy-adoption-singapore
/page-brief /blog/maltipoo-lifespan
/page-brief /blog/cavapoo-hdb-approved
/page-brief /blog/puppy-sleep-schedule
/page-brief /blog/puppy-friendly-cafes-singapore
/page-brief /blog/corgi-price-singapore
/page-brief /blog/puppy-barking-training
/page-brief /blog/imported-vs-local-puppies
/page-brief /blog/long-haired-mini-dachshund
/page-brief /blog/biggest-hdb-approved-dogs
/page-brief /blog/puppy-feeding-schedule
/page-brief /blog/dog-parks-singapore
/page-brief /blog/mini-dachshund-price-singapore
/page-brief /blog/puppy-obedience-basics
```

### Window 2 (Briefs 27-52): Paste This
```
/page-brief /blog/teacup-puppies-truth
/page-brief /blog/cavapoo-lifespan
/page-brief /blog/hdb-dog-rules
/page-brief /blog/when-can-puppy-go-outside
/page-brief /blog/dog-swimming-pools-singapore
/page-brief /blog/cavapoo-vs-cockapoo
/page-brief /blog/puppy-training-treats
/page-brief /blog/home-breed-puppies-singapore
/page-brief /blog/maltipoo-haircuts
/page-brief /blog/golden-retriever-hdb
/page-brief /blog/puppy-teething
/page-brief /blog/dog-boarding-singapore
/page-brief /blog/maltipoo-vs-maltese
/page-brief /blog/puppy-socialisation
/page-brief /blog/puppy-mills-singapore
/page-brief /blog/corgi-tails
/page-brief /blog/husky-hdb
/page-brief /blog/puppy-diarrhea
/page-brief /blog/dog-daycare-singapore
/page-brief /blog/akita-vs-shiba-inu
/page-brief /blog/leash-training-puppy
/page-brief /blog/buying-puppy-online-safely
/page-brief /blog/cavapoo-colours
/page-brief /blog/hdb-one-dog-rule
/page-brief /blog/puppy-heat-safety
/page-brief /blog/dog-friendly-places-singapore
```

### Window 3 (Briefs 53-78): Paste This
```
/page-brief /blog/maltipoo-vs-toy-poodle
/page-brief /blog/first-puppy-commands
/page-brief /blog/questions-before-buying-puppy
/page-brief /blog/dachshund-colours
/page-brief /blog/condo-dog-rules
/page-brief /blog/puppy-pet-insurance
/page-brief /blog/toy-poodle-singapore
/page-brief /blog/cavachon-vs-cavapoo
/page-brief /blog/puppy-training-classes-singapore
/page-brief /blog/pasir-ris-farmway-puppies
/page-brief /blog/white-maltipoo
/page-brief /blog/cockapoo-lifespan
/page-brief /blog/puppy-deworming
/page-brief /blog/golden-retriever-singapore
/page-brief /blog/jindo-vs-shiba-inu
/page-brief /blog/leave-puppy-alone
/page-brief /blog/puppy-health-checks-before-sale
/page-brief /blog/cavapoo-grooming
/page-brief /blog/best-dogs-first-time-owners
/page-brief /blog/dog-ticks-fleas-singapore
/page-brief /blog/french-bulldog-singapore
/page-brief /blog/bichonpoo-vs-bichon-frise
/page-brief /blog/puppy-proofing-home
/page-brief /blog/puppy-deposit-reservation
/page-brief /blog/cockapoo-size
/page-brief /blog/grooming-puppy-at-home
```

### Window 4 (Briefs 79-104): Paste This
```
/page-brief /blog/introduce-puppy-older-dog
/page-brief /blog/dog-grooming-prices-singapore
/page-brief /blog/mini-dachshund-size
/page-brief /blog/puppy-working-full-time
/page-brief /blog/dog-sterilisation-singapore
/page-brief /blog/puppy-vet-first-year
/page-brief /blog/bring-dog-to-malaysia
/page-brief /blog/pet-taxi-singapore
/page-brief /blog/shiba-inu-hdb
/page-brief /blog/beagle-hdb
/page-brief /blog/samoyed-in-singapore
/page-brief /blog/helper-puppy-care
/page-brief /blog/dog-walks-singapore-weather
/page-brief /blog/puppy-bto-renovation
/page-brief /blog/puppy-school-holidays
/page-brief /blog/puppy-chinese-new-year
/page-brief /blog/leash-rules-fines-singapore
/page-brief /blog/pet-friendly-hotels-singapore
/page-brief /blog/first-vet-visit-singapore
/page-brief /blog/pet-expo-singapore
/page-brief /blog/pet-friendly-restaurants-singapore
/page-brief /blog/puppy-yoga-singapore
/page-brief /blog/dog-walker-singapore
/page-brief /blog/pet-relocation-singapore
/page-brief /blog/dog-friendly-malls-singapore
/page-brief /blog/pet-cremation-singapore
```

---

## Timeline

| Time | Action |
|------|--------|
| **Now** | Open 4 Claude Code windows |
| **0:00-1:00** | Run Window 1 slice (26 briefs @ 2.5min each) |
| **0:00-1:00** | Run Window 2 slice in parallel |
| **0:00-1:00** | Run Window 3 slice in parallel |
| **0:00-1:00** | Run Window 4 slice in parallel |
| **1:00** | All 104 briefs cached ✅ |
| **1:05** | Update automation to use cached briefs |
| **Today 8:00 PM** | Automation is bulletproof 🚀 |

---

## After Sprint: Update Automation

Once all briefs are cached, daily automation becomes:

```
8:00 AM: Load cached brief (instant)
         → blog-writer (2 min)
         → image-gen (2 min)
         → article-tiktok-video (3 min)
         → Update queue
         Total: ~7-10 minutes ✅

No more hangs. No more timeouts.
```

---

## Go Time

Start now:

1. Open Claude Code 4 times
2. Copy each window's command slice above
3. Paste commands one-by-one in each window
4. Wait for "✅ Brief written" before next one
5. Check progress: `ls briefs/*.json | wc -l`

**Target: All 104 briefs done in 60-90 minutes.**

Good luck! 🚀
