#!/usr/bin/env node

import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

const AUDIO_DIR = "public/lang/english/audios";
const TARGET_BITRATE = "48k";

function getAudioFiles(dir) {
  const files = [];
  function walk(currentPath) {
    const entries = readdirSync(currentPath);
    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if ([".mp3", ".wav", ".m4a"].includes(extname(entry).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

function optimizeAudio(inputFile) {
  const outputFile = inputFile.replace(/\.[^.]+$/, ".opus");
  console.log(`Converting: ${inputFile} -> ${outputFile}`);
  try {
    execSync(`ffmpeg -i "${inputFile}" -c:a libopus -b:a ${TARGET_BITRATE} "${outputFile}" -y`, {
      stdio: "inherit",
    });
    console.log(`✓ ${outputFile}`);
  } catch (error) {
    console.error(`✗ Failed: ${inputFile}`);
    process.exit(1);
  }
}

async function main() {
  console.log("🎵 Audio Optimization Tool");
  console.log(`Target bitrate: ${TARGET_BITRATE}`);
  console.log("");

  const files = getAudioFiles(AUDIO_DIR);
  if (files.length === 0) {
    console.log("No audio files found.");
    return;
  }

  console.log(`Found ${files.length} audio file(s).\n`);
  for (const file of files) {
    optimizeAudio(file);
  }

  console.log("\n✓ Audio optimization complete!");
  console.log("Note: Update your trial JSON files to reference .opus files instead of .mp3");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
