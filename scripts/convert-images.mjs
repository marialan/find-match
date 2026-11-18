#!/usr/bin/env node
/**
 * Image Conversion Script
 * Converts PNG images to WebP format for better compression and performance
 * Supports recursive directory scanning and maintains directory structure
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Image directories to process
const imageDirs = [
  'src/assets',
  'public/images',
  'public/lang/english/images',
];

// WebP quality settings (1-100, higher = better quality but larger file)
const WEBP_QUALITY = 80;

/**
 * Find all PNG files in a directory recursively
 */
function findPngFiles(dir) {
  const pngFiles = [];

  function traverse(currentDir) {
    try {
      const files = fs.readdirSync(currentDir);

      files.forEach((file) => {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (file.toLowerCase().endsWith('.png')) {
          pngFiles.push(fullPath);
        }
      });
    } catch (err) {
      console.error(`Error reading directory ${currentDir}:`, err.message);
    }
  }

  traverse(dir);
  return pngFiles;
}

/**
 * Convert a PNG file to WebP
 */
async function convertToWebP(inputPath) {
  const outputPath = inputPath.replace(/\.png$/i, '.webp');

  try {
    const stats = fs.statSync(inputPath);
    const inputSize = stats.size;

    await sharp(inputPath)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    const outputSize = outputStats.size;
    const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

    console.log(`✅ ${path.relative(projectRoot, outputPath)}`);
    console.log(`   ${(inputSize / 1024).toFixed(1)}KB → ${(outputSize / 1024).toFixed(1)}KB (${savings}% smaller)`);

    return { success: true, inputSize, outputSize };
  } catch (err) {
    console.error(`❌ Failed to convert ${inputPath}:`, err.message);
    return { success: false };
  }
}

/**
 * Main conversion function
 */
async function main() {
  console.log('🖼️  PNG to WebP Image Conversion Pipeline\n');
  console.log(`Quality setting: ${WEBP_QUALITY}/100\n`);

  let totalInput = 0;
  let totalOutput = 0;
  let successCount = 0;
  let failCount = 0;

  for (const dir of imageDirs) {
    const fullDir = path.join(projectRoot, dir);

    if (!fs.existsSync(fullDir)) {
      console.log(`⏭️  ${dir} - directory not found, skipping\n`);
      continue;
    }

    console.log(`📁 Processing: ${dir}`);
    const pngFiles = findPngFiles(fullDir);

    if (pngFiles.length === 0) {
      console.log(`   No PNG files found\n`);
      continue;
    }

    for (const file of pngFiles) {
      const result = await convertToWebP(file);
      if (result.success) {
        totalInput += result.inputSize;
        totalOutput += result.outputSize;
        successCount++;
      } else {
        failCount++;
      }
    }
    console.log('');
  }

  // Print summary
  console.log('📊 Conversion Summary:');
  console.log(`   Total files converted: ${successCount}`);
  if (failCount > 0) {
    console.log(`   Failed conversions: ${failCount}`);
  }
  if (successCount > 0) {
    const totalSavings = ((1 - totalOutput / totalInput) * 100).toFixed(1);
    console.log(`   Total size reduction: ${(totalInput / 1024).toFixed(1)}KB → ${(totalOutput / 1024).toFixed(1)}KB (${totalSavings}% smaller)`);
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
