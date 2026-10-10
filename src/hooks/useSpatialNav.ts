import { useEffect } from 'react';

/**
 * Global, geometry-based spatial navigation for D-pad / arrow keys (Android TV
 * browsers, Chromecast, etc.). Arrow keys move focus to the nearest focusable
 * element in that direction using bounding-box distances, and Escape / GoBack
 * navigate back (mirroring the TV remote Back button).
 *
 * Text inputs, <select>, iframes and <video> are left alone so their native
 * behavior (typing, embed controls, seeking) is never hijacked.
 */

type Dir = 'left' | 'right' | 'up' | 'down';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [role="button"], [role="option"], [role="tab"], [tabindex]:not([tabindex="-1"])';

const ARROW_DIR: Record<string, Dir | undefined> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'IFRAME' ||
    tag === 'VIDEO' ||
    tag === 'AUDIO' ||
    (el as HTMLElement).isContentEditable
  );
}

/** Picks the closest element in `dir` from `current`, preferring alignment. */
function findBest(
  current: DOMRect,
  candidates: HTMLElement[],
  dir: Dir,
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // Primary-axis gate: the candidate must be strictly ahead in this direction.
    if (dir === 'right' && r.right <= current.left + 1) continue;
    if (dir === 'left' && r.left >= current.right - 1) continue;
    if (dir === 'down' && r.bottom <= current.top + 1) continue;
    if (dir === 'up' && r.top >= current.bottom - 1) continue;

    // Gap along the primary axis.
    let gap = 0;
    if (dir === 'right') gap = r.left - current.right;
    else if (dir === 'left') gap = current.left - r.right;
    else if (dir === 'down') gap = r.top - current.bottom;
    else gap = current.top - r.bottom;

    // Misalignment on the perpendicular axis — prefer elements that line up.
    let offset = 0;
    if (dir === 'left' || dir === 'right') {
      const overlap =
        Math.min(current.bottom, r.bottom) - Math.max(current.top, r.top);
      offset =
        overlap > 0
          ? 0
          : Math.min(Math.abs(r.top - current.top), Math.abs(r.bottom - current.bottom));
    } else {
      const overlap =
        Math.min(current.right, r.right) - Math.max(current.left, r.left);
      offset =
        overlap > 0
          ? 0
          : Math.min(Math.abs(r.left - current.left), Math.abs(r.right - current.right));
    }

    const score = gap + offset * 1.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function useSpatialNav(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      if (e.key === 'Escape' || e.key === 'GoBack') {
        // Let the browser exit fullscreen first; keep Escape local while typing.
        if (
          !document.fullscreenElement &&
          !isEditable(target) &&
          window.history.length > 1
        ) {
          e.preventDefault();
          window.history.back();
        }
        return;
      }

      const dir = ARROW_DIR[e.key];
      if (!dir) return;

      // Never hijack arrows while typing, or inside embeds / video controls.
      if (isEditable(target)) return;

      // Inside the video player, arrow keys must seek the video (left/right)
      // rather than jump between the server buttons. Let the embed handle them.
      // Covers both focused elements inside the player and the common case
      // where focus sits on <body> while the player is fullscreen.
      if (
        target?.closest('[data-video-player-outer]') ||
        document.fullscreenElement?.closest('[data-video-player-outer]')
      ) {
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const noFocus =
        !active ||
        active === document.body ||
        active === document.documentElement;

      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          el !== active &&
          el.offsetParent !== null &&
          !el.closest('[data-tv-exclude]'),
      );

      // Nothing focused yet — prime navigation by focusing the first (or last,
      // for Up) visible focusable so the D-pad has a starting point.
      if (noFocus) {
        const visible = candidates.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        });
        const prime = dir === 'up' ? visible[visible.length - 1] : visible[0];
        if (prime) {
          e.preventDefault();
          prime.focus();
          prime.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return;
      }

      const current = active.getBoundingClientRect();
      const next = findBest(current, candidates, dir);
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
