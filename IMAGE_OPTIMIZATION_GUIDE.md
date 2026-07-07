# Image Optimization Workflow

## Quick Answer: Is WebP the final step?

**For most cases: YES.** WebP at quality 85 is the sweet spot:
- ✅ 75-90% smaller than PNG
- ✅ Modern browser support (95%+)
- ✅ Maintains visual quality
- ✅ Astro handles responsive sizing automatically

**When to optimize further:**
- Hero images > 200KB: consider quality 80
- Heavy image pages: create responsive variants (1x/2x, mobile/desktop)
- AVIF format: 5-10% smaller than WebP, but less support

---

## For New AI-Generated Images

### Step 1: Check Format
- **PNG format** → Convert to WebP (75-90% size reduction)
- **JPG format** → Already decent, but consider WebP (20-30% smaller)
- **WebP format** → Skip to Step 4 ✅

### Step 2: Convert to WebP
Run the optimization script:
```bash
node optimize-images.mjs
```

This converts all PNGs in `src/assets/home/` to WebP at quality 85.

### Step 3: Update Page Imports
Change import statements from `.png` to `.webp`:
```astro
// Before
import image from '../assets/home/image.png';

// After  
import image from '../assets/home/image.webp';
```

### Step 4: Deploy
Astro automatically optimizes WebP on build—no extra config needed.

---

## File Size Expectations

| Format | Typical Size | Notes |
|--------|------------|-------|
| PNG (original) | 600-800K | Baseline (large) |
| WebP (quality 85) | 80-120K | **Recommended** |
| WebP (quality 90) | 150-200K | Highest quality |
| AVIF (quality 75) | 60-100K | Best compression, less support |

### Recent Results
- 6 PNG files: **3.6 MB → 485 KB** (86.7% reduction)

---

## When to Create Responsive Variants

Only needed if the same image is shown at different sizes across pages:

```bash
# Create 1x and 2x versions
node optimize-images.mjs --responsive

# For mobile/desktop variants
node optimize-images.mjs --variants
```

For single-use images, Astro's built-in responsive handling is sufficient.

---

## Quality Settings

| Quality | Use Case | File Size Gain |
|---------|----------|-----------------|
| 75 | High-volume content, fast pages | -20% vs 85 |
| 80 | Hero images, photo galleries | -10% vs 85 |
| 85 | **Standard (default)** | Baseline |
| 90 | Premium look, detailed content | +50% vs 85 |

---

## Batch Optimization Script Reference

Located at: `optimize-images.mjs`

```bash
# Convert all PNGs in src/assets/home/ to WebP
node optimize-images.mjs

# Custom directory
node optimize-images.mjs src/assets/cavapoo/

# Different quality
node optimize-images.mjs --quality 80
```

Output shows:
- Before/after sizes
- % reduction per image
- Total bandwidth saved

---

## Checklist Before Deployment

- [ ] All images are WebP or native lossy format (JPG/AVIF)
- [ ] PNG files converted (if any remain)
- [ ] Page imports updated to `.webp`
- [ ] File sizes verified (< 150K per image is good)
- [ ] Visual quality checked in dev preview
- [ ] Build completes without warnings

---

## Troubleshooting

**Script fails to find images:**
- Check file paths are relative to project root
- Verify file extensions match exactly

**Converted images look blurry:**
- Increase quality: `--quality 90`
- Or rerun with different quality setting

**WebP not working in old browsers:**
- Add PNG fallback: `<picture><source srcset="img.webp" type="image/webp"><img src="img.png"></picture>`
- Astro handles this automatically via `<Image>` component
