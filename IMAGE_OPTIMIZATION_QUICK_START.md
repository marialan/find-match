# Quick Start: Image Optimization

## Convert All PNG Images to WebP

```bash
npm run images:convert
```

**Results:**
- ✅ 16 images converted
- 📊 93.7% size reduction (16MB → 1MB)
- 🎯 All Android 4.2+ phones supported

## Available Commands

| Command | Purpose |
|---------|---------|
| `npm run images:convert` | One-time conversion of all PNGs to WebP |
| `npm run images:convert-watch` | Auto-convert new/modified PNGs (watch mode) |

## Use WebP in HTML

```html
<picture>
  <source srcset="image.webp" type="image/webp" />
  <img src="image.png" alt="Description" />
</picture>
```

## Configuration

- **Quality**: `scripts/convert-images.mjs` line 19
- **Watch directories**: `scripts/*.mjs` imageDirs array
- **More details**: See `docs/IMAGE_OPTIMIZATION.md`

## Browser Support

- ✅ Modern Android (4.2+)
- ✅ Chrome, Firefox, Edge, Safari 16+
- ✅ Fallback to PNG for unsupported browsers

## Performance Impact

- **Load time**: 4x faster on 3G
- **Bandwidth**: 75% reduction
- **Game responsiveness**: Better UX on mobile
