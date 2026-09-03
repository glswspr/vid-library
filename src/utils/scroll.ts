/**
 * Scroll helpers shared between the "Scroll To Video" button
 * (VideoPlayer) and the ScrollManager in App.tsx.
 *
 * Both use the same vertical-centering formula so that clicking an
 * episode thumbnail scrolls to the video player with identical
 * behaviour to the manual "Scroll To Video" button.
 */

const NAVBAR_HEIGHT = 64;

/**
 * Scroll the window so that `el` is vertically centered in the
 * viewport area below the navbar.
 */
export function scrollToElement(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const targetY =
    window.scrollY +
    rect.top -
    (window.innerHeight - rect.height - NAVBAR_HEIGHT) / 2 -
    NAVBAR_HEIGHT;
  window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
}

/**
 * Scroll to the video player element (the inner iframe container).
 * Uses `data-video-player-inner` which is also targeted by the
 * "Scroll To Video" button via its containerRef.
 */
export function scrollToVideoPlayer(): void {
  const el = document.querySelector('[data-video-player-inner]');
  if (!el) return;
  scrollToElement(el as HTMLElement);
}
