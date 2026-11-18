/**
 * Vite Plugin: WebP Image Loader
 * Automatically serves WebP images with PNG fallback
 * Usage: Import images normally, the plugin handles format negotiation
 */

import fs from 'fs';
import path from 'path';

export function webpImagePlugin() {
  return {
    name: 'webp-image-loader',
    apply: 'serve',
    resolveId(id) {
      // Only process .png files
      if (!id.endsWith('.png')) return null;
      return id;
    },
    async load(id) {
      if (!id.endsWith('.png')) return null;

      // Check if WebP version exists
      const webpPath = id.replace(/\.png$/i, '.webp');
      if (fs.existsSync(webpPath)) {
        // Return code that loads WebP with PNG fallback
        const relativePath = path.relative(process.cwd(), webpPath);
        const pngPath = path.relative(process.cwd(), id);

        return `
          export default new URL('${relativePath}', import.meta.url).href;
          export const webp = new URL('${relativePath}', import.meta.url).href;
          export const png = new URL('${pngPath}', import.meta.url).href;
        `;
      }

      return null;
    },
  };
}

export default webpImagePlugin;
