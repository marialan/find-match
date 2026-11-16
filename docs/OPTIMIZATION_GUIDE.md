# Asset Optimization Guide

This guide provides recommendations and tools for optimizing audio and image files in the Find The Two That Match game to improve performance on mobile devices and slow networks.

## Overview of Optimizations

The app has been updated with the following performance improvements:

### 1. **Lazy Audio Loading**
- Audio files are now loaded concurrently (max 3 at a time) instead of all at once
- Provides smoother trial startup experience
- Audio can be loaded on-demand if not preloaded before playback

### 2. **Lazy Image Loading**
- Images load only when they come into view (Intersection Observer)
- Reduces initial load time significantly
- 50px margin for preloading before visibility

### 3. **Controlled Concurrency**
- Audio loads in batches to avoid overwhelming the network
- Prevents browser connection limit exhaustion

## File Size Optimization Recommendations

### Audio Files

**Current State:**
- Typical MP3 audio files: 28-35 KB each
- Sample rate: Usually 44.1 kHz or higher
- Bitrate: Often 128 kbps or higher

**Recommended Optimizations:**

1. **Convert to OGG/Opus format**
   ```bash
   # Using ffmpeg
   ffmpeg -i input.mp3 -c:a libopus -b:a 32k output.opus
   ```
   - Expected reduction: 60-70% smaller than MP3
   - Excellent quality at low bitrates
   - Wide browser support

2. **Target bitrate: 32-64 kbps**
   - 32 kbps: Acceptable speech quality
   - 48 kbps: Good quality
   - 64 kbps: Excellent quality

3. **Batch Conversion Script** (provided below)

### Image Files

**Current State:**
- PNG format (lossless)
- Typical size: 5-50 KB depending on complexity

**Recommended Optimizations:**

1. **Convert to WebP format**
   ```bash
   # Using cwebp
   cwebp -q 80 input.png -o output.webp
   ```
   - Expected reduction: 25-35% smaller than PNG
   - Superior compression at maintained quality
   - Browser support: Modern browsers (with PNG fallback)

2. **Optimize PNG as fallback**
   ```bash
   # Using pngquant
   pngquant --speed 1 --quality 80-95 input.png -o output.png
   ```

3. **Use appropriate quality levels**
   - Simple graphics (single colors): WebP quality 70-75
   - Photos/complex graphics: WebP quality 80-90

### Optimization Scripts

#### Batch Convert Audio to Opus

Create `scripts/optimize-audio.mjs`:

```javascript
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
```

Run with:
```bash
node scripts/optimize-audio.mjs
```

#### Batch Convert Images to WebP

Create `scripts/optimize-images.mjs`:

```javascript
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
```

Run with:
```bash
node scripts/optimize-images.mjs
```

## Installation Requirements

### For Audio Optimization (Opus)
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (with Chocolatey)
choco install ffmpeg
```

### For Image Optimization (WebP)
```bash
# macOS
brew install libwebp

# Ubuntu/Debian
sudo apt-get install webp

# Windows (with Chocolatey)
choco install libwebp
```

## Performance Targets

### Load Times (on 3G connection)
- **Before optimization**
  - Trial load: 3-5+ seconds (all assets)
  - Images: Mixed quality, slow initial render

- **After optimization**
  - Trial load: 0.5-1 second (initial metadata)
  - Images: Lazy-loaded as needed
  - Audio: Progressive loading (3 concurrent)

### File Size Reduction
- Audio (MP3 → Opus at 48kbps): ~60-70% reduction
- Images (PNG → WebP at quality 80): ~25-35% reduction
- Overall pack size: 40-50% reduction expected

## Implementation Steps

1. **Install compression tools**
   ```bash
   # Opus
   brew install ffmpeg  # or appropriate for your OS
   
   # WebP
   brew install libwebp  # or appropriate for your OS
   ```

2. **Back up original files**
   ```bash
   cd public/lang/english
   cp -r audios audios.backup
   cp -r images images.backup
   ```

3. **Run optimization scripts**
   ```bash
   node scripts/optimize-audio.mjs
   node scripts/optimize-images.mjs
   ```

4. **Update trial JSON references**
   - Change `"audios/letter-a.mp3"` to `"audios/letter-a.opus"`
   - Change `"images/cat.png"` to `"images/cat.webp"`

5. **Test thoroughly**
   - Verify all assets load correctly
   - Check audio playback quality
   - Test on mobile devices

6. **Rebuild and re-upload to CMS**
   ```bash
   npm run build
   # Upload to CMS
   ```

## Browser Compatibility

### Opus Audio
- Chrome: 33+
- Firefox: 15+
- Safari: Limited (fallback to MP3)
- Edge: 14+

### WebP Images
- Chrome: 23+
- Firefox: 65+
- Safari: Limited (fallback to PNG)
- Edge: 14+

**Recommendation:** Keep original formats as fallbacks during transition period.

## Monitoring Performance

After optimization, monitor:

1. **Network Waterfall** (DevTools Network tab)
   - Should show assets loading progressively
   - Audio loading in batches
   - Images not loading until visible

2. **Load Time** (Lighthouse)
   - FCP (First Contentful Paint): Should improve
   - LCP (Largest Contentful Paint): Should improve

3. **User Experience**
   - Trial starts immediately
   - No long pauses before interactivity
   - Smooth scrolling and interaction

## Troubleshooting

### Audio plays but sounds distorted
- Increase bitrate: Try 64kbps instead of 48kbps
- Check original audio quality

### Images don't appear
- Verify file paths updated in trial JSON
- Check browser console for 404 errors
- Ensure original file formats still exist as fallback

### Large performance improvement not seen
- Check network throttling (DevTools)
- Verify audio lazy loading is working
- Ensure old files are cleared from browser cache

## Future Considerations

1. **HTTP/2 Push**: Enable server push for critical assets
2. **Service Worker**: Cache assets locally for repeat loads
3. **Responsive Images**: Serve different sizes for different devices
4. **Video Format**: Consider HEIC for future image support
5. **Audio Streaming**: Consider HLS/DASH for very large audio files
