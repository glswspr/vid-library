/**
 * Accent colours fill buttons that carry `text-slate-950` (near-black) labels.
 * A very dark accent makes that text unreadable, so the accent is lightened
 * until it has enough luminance for dark text on top.
 */

/** WCAG relative luminance of an sRGB channel triplet in 0..255. */
function luminance(r: number, g: number, b: number): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Minimum luminance for dark text on the accent to stay readable. */
const MIN_LUMINANCE = 0.2;

function toHex(r: number, g: number, b: number): string {
  const part = (value: number): string => Math.round(value).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function readableAccent(hex: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;

  let r = Number.parseInt(match[1], 16);
  let g = Number.parseInt(match[2], 16);
  let b = Number.parseInt(match[3], 16);

  // Blend toward white in steps. Bounded so a pathological input cannot loop.
  for (let i = 0; i < 8 && luminance(r, g, b) < MIN_LUMINANCE; i++) {
    r = (r + 255) / 2;
    g = (g + 255) / 2;
    b = (b + 255) / 2;
  }

  return toHex(r, g, b);
}
