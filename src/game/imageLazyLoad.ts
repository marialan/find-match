const imageCache = new Map<string, boolean>();
const loadingImages = new Map<string, Promise<void>>();
let observer: IntersectionObserver | null = null;

export function initImageLazyLoad(): void {
  if (observer) return;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;

        if (src && !img.src) {
          img.src = src;
          delete img.dataset.src;
        }
      });
    },
    {
      rootMargin: "50px",
    }
  );
}

export function observeImage(img: HTMLImageElement): void {
  if (!observer) {
    initImageLazyLoad();
  }
  observer?.observe(img);
}

export function unobserveImage(img: HTMLImageElement): void {
  observer?.unobserve(img);
}

export async function preloadImageIfNeeded(src: string): Promise<void> {
  if (imageCache.has(src)) return;

  let loadPromise = loadingImages.get(src);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, true);
      loadingImages.delete(src);
      resolve();
    };
    img.onerror = () => {
      imageCache.set(src, false);
      loadingImages.delete(src);
      resolve();
    };
    img.src = src;
  });

  loadingImages.set(src, loadPromise);
  return loadPromise;
}

export function isPrefetchingImages(): boolean {
  return loadingImages.size > 0;
}
