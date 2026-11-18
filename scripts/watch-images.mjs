#!/usr/bin/env node
/**
 * Image Watch Script
 * Monitors PNG directories for new/modified files and automatically converts to WebP
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const imageDirs = [
  'src/assets',
  'public/images',
  'public/lang/english/images',
];

const WEBP_QUALITY = 80;
const watchedDirs = imageDirs.map((dir) => path.join(projectRoot, dir));

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

    console.log(`[${new Date().toLocaleTimeString()}] ✅ Converted: ${path.relative(projectRoot, outputPath)} (${savings}% smaller)`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error converting ${inputPath}:`, err.message);
  }
}

function setupWatcher(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`📁 Waiting for directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`👀 Watching: ${path.relative(projectRoot, dir)}`);

  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.toLowerCase().endsWith('.png')) {
      return;
    }

    const fullPath = path.join(dir, filename);

    // Debounce conversion (wait 500ms for file to be fully written)
    setTimeout(() => {
      if (fs.existsSync(fullPath)) {
        convertToWebP(fullPath);
      }
    }, 500);
  });
}

console.log('🖼️  PNG to WebP Image Watch Pipeline\n');
console.log('Watching for new/modified PNG files...\n');

watchedDirs.forEach(setupWatcher);

console.log('\nPress Ctrl+C to stop watching\n');
