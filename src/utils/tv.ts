/**
 * TV-device detection (UA sniff + coarse-pointer heuristic) so the UI can
 * tailor itself: bigger targets, stronger focus rings, no backdrop blur.
 */

export function isTvDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = (navigator.userAgent || '').toLowerCase();
  const tvUa =
    /android tv|bravia|smart-tv|smarttv|tizen|webos|hbbtv|kylo|roku|fire ?tv|appletv|vid_aa|viera|netcast|hisensetv|stb|tv browser/i.test(
      ua,
    );
  if (tvUa) return true;

  // Heuristic: big screen + touch-only (no mouse) + not a phone/tablet UA.
  const coarse = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  const wide = window.screen?.width >= 1280 && window.screen?.height >= 720;
  const phoneLike = /android.*mobile|iphone|ipad|ipod|windows phone/i.test(ua);
  return !!coarse && !!wide && !phoneLike;
}

/** Adds the `tv-mode` class and disables pinch-zoom when running on a TV. */
export function applyTvMode(): void {
  if (typeof document === 'undefined') return;
  if (!isTvDevice()) return;

  document.documentElement.classList.add('tv-mode');

  // Prevent accidental double-tap/pinch zoom from the remote.
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    const content = meta.getAttribute('content') || '';
    if (!content.includes('maximum-scale')) {
      meta.setAttribute(
        'content',
        `${content}, maximum-scale=1, user-scalable=no`,
      );
    }
  }
}
