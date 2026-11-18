/**
 * WebP Fallback Utility
 * Provides helpers for progressive image loading with WebP and PNG fallback
 */

let webpSupported: boolean | null = null;

/**
 * Detects if the browser supports WebP format
 * Uses canvas-based detection for reliability
 */
export function supportsWebP(): boolean {
  if (webpSupported !== null) return webpSupported;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupported =
      canvas.toDataURL("image/webp").indexOf("image/webp") === 5;
  } catch {
    webpSupported = false;
  }

  return webpSupported;
}

/**
 * Converts an image path to its WebP equivalent
 * e.g., "image.png" → "image.webp"
 */
export function getWebPPath(imagePath: string): string {
  return imagePath.replace(/\.png$/i, ".webp");
}

/**
 * Gets the optimal image source based on browser support
 * Returns WebP if supported, otherwise returns PNG
 */
export function getOptimalImageSource(imagePath: string): string {
  if (!imagePath) return imagePath;

  // If the path is already WebP, return it
  if (imagePath.toLowerCase().endsWith(".webp")) {
    return imagePath;
  }

  // If the path is PNG and WebP is supported, return WebP version
  if (
    imagePath.toLowerCase().endsWith(".png") &&
    supportsWebP()
  ) {
    return getWebPPath(imagePath);
  }

  return imagePath;
}

/**
 * Gets both WebP and PNG sources for use with <picture> element
 * Returns object with webp and png paths, including responsive sizes
 */
export function getImageSources(imagePath: string | undefined): {
  webp: string | undefined;
  png: string | undefined;
  webpSrcSet: string | undefined;
  pngSrcSet: string | undefined;
} {
  if (!imagePath) return { webp: undefined, png: undefined, webpSrcSet: undefined, pngSrcSet: undefined };

  // Handle PNG images
  if (imagePath.toLowerCase().endsWith(".png")) {
    const webpPath = getWebPPath(imagePath);
    return {
      webp: webpPath,
      png: imagePath,
      webpSrcSet: `${webpPath} 1x, ${webpPath} 2x`,
      pngSrcSet: `${imagePath} 1x, ${imagePath} 2x`,
    };
  }

  // Handle WebP images - still need PNG fallback
  if (imagePath.toLowerCase().endsWith(".webp")) {
    const pngPath = imagePath.replace(/\.webp$/i, ".png");
    return {
      webp: imagePath,
      png: pngPath,
      webpSrcSet: `${imagePath} 1x, ${imagePath} 2x`,
      pngSrcSet: `${pngPath} 1x, ${pngPath} 2x`,
    };
  }

  // For other formats, return as-is
  return {
    webp: undefined,
    png: imagePath,
    webpSrcSet: undefined,
    pngSrcSet: undefined,
  };
}
