#!/usr/bin/env node

import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

const IMAGE_DIR = "public/lang/english/images";
const WEBP_QUALITY = 80;

function getImageFiles(dir) {
  const files = [];
  function walk(currentPath) {
    const entries = readdirSync(currentPath);
    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if ([".png", ".jpg", ".jpeg"].includes(extname(entry).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

function optimizeImage(inputFile) {
  const outputFile = inputFile.replace(/\.[^.]+$/, ".webp");
  console.log(`Converting: ${inputFile} -> ${outputFile}`);
  try {
    execSync(`cwebp -q ${WEBP_QUALITY} "${inputFile}" -o "${outputFile}"`, {
      stdio: "inherit",
    });
    console.log(`✓ ${outputFile}`);
  } catch (error) {
    console.error(`✗ Failed: ${inputFile}`);
    process.exit(1);
  }
}

async function main() {
  console.log("🖼️ Image Optimization Tool");
  console.log(`Target WebP quality: ${WEBP_QUALITY}`);
  console.log("");

  const files = getImageFiles(IMAGE_DIR);
  if (files.length === 0) {
    console.log("No image files found.");
    return;
  }

  console.log(`Found ${files.length} image file(s).\n`);
  for (const file of files) {
    optimizeImage(file);
  }

  console.log("\n✓ Image optimization complete!");
  console.log("Note: Update your trial JSON files to reference .webp files instead of .png/.jpg");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
