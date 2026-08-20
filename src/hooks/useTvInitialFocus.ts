import { useEffect } from 'react';
import type { RefObject } from 'react';
import { isTvDevice } from '../utils/tv';

/**
 * On TV (D-pad only) every route needs a focused element so the remote has a
 * starting point for spatial navigation. Focuses `[data-tv-autofocus]` if
 * present, otherwise the first focusable element inside the container.
 */
export function useTvInitialFocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
  ready = true,
): void {
  useEffect(() => {
    if (!ready || !isTvDevice()) return;
    const root = ref.current;
    if (!root) return;
    // Skip submit buttons (e.g. the IMDb "Open" form) so a D-pad press never
    // submits an empty form — prefer a real navigation link / content card.
    const target =
      root.querySelector<HTMLElement>('[data-tv-autofocus]') ||
      root.querySelector<HTMLElement>('a[href], button:not([type="submit"])');
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [ref, ready]);
}
