# WebP Image Conversion Pipeline

This project uses a WebP conversion pipeline to optimize image assets for better performance on mobile devices, particularly Android phones.

## Why WebP?

- **30-35% smaller** than PNG files
- **Wide Android support**: Android 4.2+ (since 2012)
- **Better compression** while maintaining quality
- **Supported across all modern browsers**

## Usage

### One-Time Conversion

Convert all PNG images in the project to WebP format:

```bash
npm run images:convert
```

This will:
- Scan all image directories
- Convert PNG → WebP (quality: 80/100)
- Display conversion progress and file size savings
- Keep original PNG files for fallback

**Output example:**
```
✅ public/lang/english/images/cat.webp
   45.2KB → 12.3KB (72.8% smaller)
```

### Watch Mode (Auto-Convert on Save)

Monitor image directories and automatically convert new/modified PNGs:

```bash
npm run images:convert-watch
```

This watches these directories:
- `src/assets`
- `public/images`
- `public/lang/english/images`

Press `Ctrl+C` to stop watching.

## Image Directories

The pipeline processes images from:

| Directory | Purpose |
|-----------|---------|
| `src/assets/` | React component assets (hero.png, etc.) |
| `public/images/` | Public game assets |
| `public/lang/english/images/` | Language pack images |

## Using WebP Images in HTML

Use the `<picture>` element for progressive enhancement:

```html
<picture>
  <source srcset="image.webp" type="image/webp" />
  <img src="image.png" alt="Description" />
</picture>
```

**How it works:**
1. **Modern Android (4.2+)**: Loads WebP ✅
2. **Fallback**: Loads PNG if WebP not supported
3. **Very old devices**: Only PNG is loaded

### In React Components

```jsx
function MyComponent() {
  return (
    <picture>
      <source srcset={require('/path/to/image.webp')} type="image/webp" />
      <img src={require('/path/to/image.png')} alt="Description" />
    </picture>
  );
}
```

## Configuration

### Quality Settings

Modify the WebP quality in scripts:

- `scripts/convert-images.mjs` - Line 19: `const WEBP_QUALITY = 80;`
- `scripts/watch-images.mjs` - Line 23: `const WEBP_QUALITY = 80;`

Quality scale: 1-100 (higher = better quality but larger file)

**Recommendations:**
- **80 (default)**: Best balance of quality and compression
- **90+**: For photography/high-detail images
- **70**: Maximum compression, may show artifacts

### Adding New Image Directories

Edit the image directories list in both scripts:

```javascript
const imageDirs = [
  'src/assets',
  'public/images',
  'public/lang/english/images',
  // Add new directories here
];
```

## Workflow

### For Developers

1. **Add new PNG images** to the project
2. **Run conversion**:
   ```bash
   npm run images:convert
   ```
3. **Update HTML** to use `<picture>` element
4. **Commit both** PNG and WebP files

Or use **watch mode** during development:
```bash
npm run images:convert-watch
```

### Before Deployment

```bash
# Ensure all images are converted
npm run images:convert

# Verify no unconverted PNGs
git status
```

## File Size Optimization

Expected compression ratios:

| Image Type | PNG Size | WebP Size | Savings |
|------------|----------|-----------|---------|
| Simple graphics (bat, cat) | 20-50KB | 5-15KB | **70-80%** |
| Complex photos | 100-500KB | 30-100KB | **60-70%** |
| Illustrations | 50-200KB | 10-50KB | **75-85%** |

For your game assets (simple matching pairs):
- Expected savings: **70-80% per image**
- 15 images × 30KB avg = 450KB → ~100KB with WebP

## Troubleshooting

### "Command not found: sharp"

Ensure dependencies are installed:
```bash
npm install
```

### "No PNG files found"

Verify image directories exist and contain PNG files:
```bash
ls public/images/
ls public/lang/english/images/
```

### WebP Images Not Loading

1. Check that both PNG and WebP files exist
2. Verify `<picture>` element syntax
3. Use browser DevTools to check Network tab

### Quality Issues

If WebP images look degraded:
1. Increase `WEBP_QUALITY` value (90-95)
2. Re-run conversion
3. Compare file sizes vs. quality tradeoff

## Performance Impact

### Load Time Improvement

**Scenario**: 15 game images at ~40KB each

| Format | Total Size | Load Time (3G) | Load Time (WiFi) |
|--------|-----------|----------------|-----------------|
| PNG only | 600KB | ~8s | ~1.2s |
| WebP (80%) | 150KB | ~2s | ~0.3s |
| **Improvement** | **75% smaller** | **4x faster** | **4x faster** |

### Bandwidth Savings

For 1,000 app downloads:
- PNG: 600MB total bandwidth
- WebP: 150MB total bandwidth
- **Savings: 450MB per 1,000 downloads** ✅

## Related Documentation

- [WebP Format Info](https://developers.google.com/speed/webp)
- [Android WebP Support](https://caniuse.com/webp)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)

## Scripts Reference

- `scripts/convert-images.mjs` - Main conversion script
- `scripts/watch-images.mjs` - File watcher for auto-conversion
- `scripts/vite-webp-plugin.mjs` - Vite plugin (future enhancement)

---

**Last Updated**: 2026-11-18  
**Quality Default**: 80/100  
**Supported Android**: 4.2+
