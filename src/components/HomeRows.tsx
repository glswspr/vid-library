import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { buildHomeRows, getMovieGenres } from '../services/rows';
import { useSettings } from '../hooks/useSettings';
import { HomeRow } from './HomeRow';

/**
 * Builds the curated home-page rows (top rated, new releases, personalized
 * recommendations, coming soon, user-picked genres) and renders them with
 * cross-row dedupe — a title shown in one row won't occupy another.
 */
export const HomeRows: FC = () => {
  const [settings] = useSettings();
  const [genreNames, setGenreNames] = useState<Map<number, string> | null>(null);
  const shownIdsRef = useRef(new Map<string, string[]>());
  const { englishOnly, genreRows } = settings;

  useEffect(() => {
    let cancelled = false;
    getMovieGenres().then((genres) => {
      if (cancelled) return;
      setGenreNames(new Map(genres.map((g) => [g.id, g.name] as [number, string])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () => buildHomeRows({ englishOnly, genreRows }, genreNames),
    [englishOnly, genreRows, genreNames],
  );

  // Reset the dedupe registry whenever the row set itself changes.
  useEffect(() => {
    shownIdsRef.current = new Map();
  }, [rows]);

  const getExcludeIds = useCallback(() => {
    const excluded = new Set<string>();
    for (const ids of shownIdsRef.current.values()) {
      for (const id of ids) excluded.add(id);
    }
    return excluded;
  }, []);

  const handleLoaded = useCallback((rowId: string, ids: string[]) => {
    shownIdsRef.current.set(rowId, ids);
  }, []);

  return (
    <>
      {rows.map((def) => (
        <HomeRow
          key={def.id}
          def={def}
          getExcludeIds={getExcludeIds}
          onLoaded={handleLoaded}
        />
      ))}
    </>
  );
};
