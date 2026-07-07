import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const pngFiles = [
  'src/assets/home/2-starter-kit-items-cavapoo-unboxing.png',
  'src/assets/home/3-avs-certified-trainer-puppy-training-lesson.png',
  'src/assets/home/4-playpen-setup-delivery-home-balestier.png',
  'src/assets/home/5-cavapoo-puppy-settling-playpen-first-day.png',
  'src/assets/home/6-puppy-health-check-vet-care-avs.png',
];

async function convertToWebP(filePath) {
  const outputPath = filePath.replace('.png', '.webp');
  const origSize = fs.statSync(filePath).size / 1024;

  try {
    await sharp(filePath)
      .webp({ quality: 85 })
      .toFile(outputPath);

    const newSize = fs.statSync(outputPath).size / 1024;
    const savings = ((1 - newSize / origSize) * 100).toFixed(1);

    console.log(`✓ ${path.basename(filePath)}`);
    console.log(`  ${origSize.toFixed(0)}K → ${newSize.toFixed(0)}K (${savings}% smaller)\n`);

    return { original: origSize, optimized: newSize };
  } catch (error) {
    console.error(`✗ Failed to convert ${filePath}:`, error.message);
    return null;
  }
}

async function optimizeAll() {
  console.log('Starting PNG → WebP optimization...\n');
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const file of pngFiles) {
    if (fs.existsSync(file)) {
      const result = await convertToWebP(file);
      if (result) {
        totalOriginal += result.original;
        totalOptimized += result.optimized;
      }
    } else {
      console.log(`⚠ ${file} not found\n`);
    }
  }

  console.log('═'.repeat(50));
  console.log(`TOTAL: ${totalOriginal.toFixed(0)}K → ${totalOptimized.toFixed(0)}K`);
  console.log(`Saved: ${(totalOriginal - totalOptimized).toFixed(0)}K (${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}% reduction)\n`);
}

optimizeAll();
