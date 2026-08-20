/**
 * Extracts an IMDb ID (tt followed by digits) from a raw string.
 * Accepts:
 *   - Plain IDs: "tt0120737"
 *   - Full URLs: "https://www.imdb.com/title/tt0120737/"
 *   - Partial URLs: "imdb.com/title/tt0120737"
 *   - Surrounded text: "check out tt0120737 on imdb"
 *
 * @returns The extracted IMDb ID (e.g. "tt0120737") or null if none found.
 */
export function extractImdbId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const match = input.match(/tt\d{5,}/i);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Checks if a string is a valid IMDb ID format.
 */
export function isImdbId(input: string): boolean {
  return /^tt\d{5,}$/i.test(input.trim());
}
