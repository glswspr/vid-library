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

/**
 * Resolve an IMDb ID to a numeric TMDB ID using the TMDB find API.
 * Returns the TMDB ID string if successful, null otherwise.
 * This is used by embed providers that require numeric TMDB IDs
 * (peachify, videasy, vidzee) when only an IMDB ID is available.
 */
export async function resolveImdbToTmdb(imdbId: string): Promise<string | null> {
  if (!imdbId) return null;

  // Extract the IMDB ID format (tt followed by digits)
  const extracted = imdbId.toLowerCase().match(/^tt\d+$/);
  if (!extracted) {
    // Try to extract from a longer string
    const match = imdbId.match(/tt\d{5,}/i);
    if (!match) return null;
    return resolveImdbToTmdb(match[0].toLowerCase());
  }

  // Use the existing TMDB resolution from metadata service
  // We need to import it, but to avoid circular dependencies,
  // we'll do a simple fetch here
  const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || import.meta.env.VITE_FALLBACK_TMDB_API_KEY || '';

  if (!TMDB_API_KEY) {
    // No TMDB key available, can't resolve
    return null;
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const movie = data.movie_results?.[0];
    const show = data.tv_results?.[0];
    const result = show ?? movie;
    if (!result || !result.id) return null;
    return result.id.toString();
  } catch {
    return null;
  }
}