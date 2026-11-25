import { useEffect, useState } from 'react';

/**
 * Track a CSS media query from React.
 *
 * The navbar renders one search field at a time — inline on desktop, in a
 * collapsible row on phones — and needs to know which one is mounted so a
 * single input keeps its focus instead of being duplicated in the DOM.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
