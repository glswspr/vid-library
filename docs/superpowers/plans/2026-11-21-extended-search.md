# Extended Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the search functionality to accept actors, directors, genres, and character names in addition to movie/TV titles.

**Architecture:** Extend the existing `SearchResult` type to include a `person` type (for actors/directors), add genre detection that routes to TMDB discover with `with_genres`, and add Wikidata entity search as a fallback for character names. The search flow remains a single entry point (`searchByTitle`) that tries multiple strategies in sequence.

**Tech Stack:** TypeScript, React, Vite, Vitest, TMDB API, Wikidata API, OMDb API

**Spec:** This plan implements the design discussed in the conversation (Approach 1: extend SearchResult + genre detection + Wikidata character fallback).

## Global Constraints

- Existing `searchByTitle(query: string, signal?: AbortSignal): Promise<SearchResult[]>` signature must not change
- `SearchResult` type exported from `src/services/catalog.ts` (re-exported from `search.ts`)
- `SearchResults` component in `src/components/SearchResults.tsx` renders results
- `Navbar` and `HomePage` both call `searchByTitle` via `performSearch`
- TMDB genre catalog already cached via `getMovieGenres()` in `rows.ts`
- MIN_SEARCH_QUERY_LENGTH = 2 (constants.ts)

## Review Focus

| Input / Condition | Expected Behavior |
|-------------------|-------------------|
| Query is a person name (e.g., "Tom Hanks") | Returns person results with `known_for_department` and `known_for` titles; clicking re-searches with that name |
| Query matches a genre name (e.g., "sci-fi", "horror") | Returns movies/TV of that genre via TMDB discover with `with_genres` |
| Query is a character name (e.g., "Jon Snow", "Darth Vader") | Returns matching character entities from Wikidata with title/year/type; clicking navigates to that title |
| Query is an IMDb ID (already works) | Continues to resolve via Wikidata/TMDB as before |
| Search returns mixed types (movies, TV, people) | SearchResults renders each with appropriate badge and action |

---

### Task 1: Extend SearchResult type with person support

**Files:**
- Modify: `src/services/search.ts:3-10`
- Modify: `src/services/catalog.ts:19-20` (re-export)

**Interfaces:**
- Consumes: None (base type change)
- Produces: Extended `SearchResult` interface with `type: 'movie' | 'tv' | 'person'`, optional `known_for_department`, `known_for`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/search.test.ts (new file)
import { describe, it, expect } from 'vitest';
import { searchByTitle } from './search';

describe('searchByTitle extended types', () => {
  it('SearchResult type includes person with known_for_department', () => {
    // Type test: SearchResult should accept 'person' type
    const personResult: SearchResult = {
      imdbId: 'nm0000123',
      title: 'Tom Hanks',
      type: 'person',
      known_for_department: 'Acting',
      known_for: [{ imdbId: 'tt0120737', title: 'The Shawshank Redemption', type: 'movie' }]
    };
    expect(personResult.type).toBe('person');
    expect(personResult.known_for_department).toBe('Acting');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/search.test.ts`
Expected: FAIL (file doesn't exist, SearchResult doesn't have person type)

- [ ] **Step 3: Implement extended SearchResult in `src/services/search.ts`**

```typescript
// In src/services/search.ts, replace lines 3-10:
export interface SearchResult {
  imdbId: string;
  title: string;
  year?: string;
  type: 'movie' | 'tv' | 'person';
  posterUrl?: string;
  rating?: string;
  known_for_department?: string;
  known_for?: SearchResult[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/search.ts src/services/search.test.ts
git commit -m "feat(search): extend SearchResult with person type"
```

---

### Task 2: Update searchTmdb to include person results

**Files:**
- Modify: `src/services/search.ts:51-94` (searchTmdb function)
- Test: `src/services/search.test.ts`

**Interfaces:**
- Consumes: Extended `SearchResult` from Task 1
- Produces: `searchTmdb` now returns person results alongside movie/tv

- [ ] **Step 1: Write the failing test**

```typescript
// In src/services/search.test.ts (add to existing describe)
it('searchTmdb includes person results when available', async () => {
  // Mock fetch to return TMDB multi-search response with person
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        { media_type: 'person', id: 123, name: 'Tom Hanks', known_for_department: 'Acting', known_for: [], profile_path: '/path.jpg' },
        { media_type: 'movie', id: 456, title: 'Test Movie', poster_path: '/movie.jpg' }
      ]
    })
  });
  
  const results = await searchTmdb('Tom Hanks');
  const person = results.find(r => r.type === 'person');
  expect(person).toBeDefined();
  expect(person?.title).toBe('Tom Hanks');
  expect(person?.known_for_department).toBe('Acting');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/search.test.ts`
Expected: FAIL (searchTmdb filters out person results)

- [ ] **Step 3: Implement person result handling in `searchTmdb`**

In `searchTmdb` function (around line 62-64), change the filter to include `person`:
```typescript
const items = (data.results || []).filter(
  (item: any) => item.media_type === 'movie' || item.media_type === 'tv' || item.media_type === 'person'
);
```

Then handle person items in the results loop (after line 68):
```typescript
for (const item of items.slice(0, 8)) {
  if (item.media_type === 'person') {
    results.push({
      imdbId: `nm${item.id}`, // TMDB person IDs are numeric; prefix with nm for consistency
      title: item.name || 'Unknown',
      type: 'person',
      known_for_department: item.known_for_department,
      known_for: item.known_for?.slice(0, 3).map((kf: any) => ({
        imdbId: kf.id?.startsWith('tt') ? kf.id : `tmdb:${kf.id}`,
        title: kf.title || kf.name || 'Unknown',
        type: kf.media_type === 'movie' ? 'movie' : 'tv',
        posterUrl: kf.poster_path ? `https://image.tmdb.org/t/p/w92${kf.poster_path}` : undefined,
      })) || [],
      posterUrl: item.profile_path ? `https://image.tmdb.org/t/p/w92${item.profile_path}` : undefined,
    });
    continue;
  }
  // ... existing movie/tv handling
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/search.ts src/services/search.test.ts
git commit -m "feat(search): include person results in TMDB search"
```

---

### Task 3: Add genre detection and discover search

**Files:**
- Modify: `src/services/search.ts:32-49` (searchByTitle function)
- Modify: `src/services/rows.ts` (import getMovieGenres)
- Test: `src/services/search.test.ts`

**Interfaces:**
- Consumes: `getMovieGenres()` from `rows.ts`, genre catalog cached in localStorage
- Produces: `searchByTitle` checks query against genre names before TMDB title search

- [ ] **Step 1: Write the failing test**

```typescript
// In src/services/search.test.ts (add)
it('searchByTitle detects genre query and uses discover', async () => {
  // Mock getMovieGenres to return known genres
  vi.mock('./rows', () => ({
    getMovieGenres: async () => [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }]
  }));
  
  // Mock fetch for discover endpoint
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [{ id: 123, title: 'Action Movie', media_type: 'movie', poster_path: '/action.jpg' }] })
  });
  
  const results = await searchByTitle('action');
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].type).toBe('movie');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/search.test.ts`
Expected: FAIL (genre detection not implemented)

- [ ] **Step 3: Implement genre detection in `searchByTitle`**

Add at the top of `searchByTitle` (after line 33):
```typescript
// Check if query matches a genre name
const genres = await getMovieGenres();
const matchedGenre = genres.find(g => g.name.toLowerCase() === cleanQuery.toLowerCase());
if (matchedGenre) {
  const discoverResults = await searchDiscoverByGenre(matchedGenre.id, signal);
  if (discoverResults.length > 0) return discoverResults;
  // Fall through to normal search if discover returns nothing
}
```

Add new helper function `searchDiscoverByGenre` (before `searchTmdb`):
```typescript
async function searchDiscoverByGenre(genreId: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(tmdbKey)) return [];

  try {
    const params = new URLSearchParams({
      sort_by: 'popularity.desc',
      with_genres: String(genreId),
      'vote_average.gte': '6.0',
      'vote_count.gte': '500',
      page: '1',
    });
    if (tmdbKey) params.set('api_key', tmdbKey);

    const res = await fetch(tmdbDirectUrl(`/discover/movie?${params.toString()}`, tmdbKey), { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data.results || []).slice(0, 15);
    
    return items.map((item: any) => ({
      imdbId: item.id?.startsWith('tt') ? item.id : `tmdb:${item.id}`,
      title: item.title || 'Untitled',
      year: (item.release_date || '').substring(0, 4) || undefined,
      type: 'movie' as const,
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : undefined,
      rating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
    }));
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('Genre discover search failed:', e);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/search.ts src/services/search.test.ts
git commit -m "feat(search): add genre detection and discover search"
```

---

### Task 4: Add Wikidata character/entity search fallback

**Files:**
- Modify: `src/services/search.ts:32-49` (searchByTitle function, add as last fallback)
- Test: `src/services/search.test.ts`

**Interfaces:**
- Consumes: Wikidata `wbsearchentities` API
- Produces: Character/entity results as `SearchResult` with type derived from Wikidata instance-of

- [ ] **Step 1: Write the failing test**

```typescript
// In src/services/search.test.ts (add)
it('searchByTitle falls back to Wikidata entity search for characters', async () => {
  // Mock all previous search strategies to return empty
  // Mock Wikidata search to return a character entity
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) }) // TMDB
    .mockResolvedValueOnce({ ok: true, json: async () => ({ search: [] }) }) // Wikidata title
    .mockResolvedValueOnce({ ok: true, json: async () => ({ Response: 'False' }) }) // OMDb
    .mockResolvedValueOnce({ 
      ok: true, 
      json: async () => ({ 
        search: [{ id: 'Q123', label: 'Jon Snow', description: 'Game of Thrones character' }] 
      }) 
    }) // Wikidata entity search
    .mockResolvedValueOnce({ 
      ok: true, 
      json: async () => ({ 
        entities: { 
          Q123: { 
            claims: { 
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }], // human
              P361: [{ mainsnak: { datavalue: { value: { id: 'Q12345' } } } }] // part of Game of Thrones
            } 
          } 
        } 
      }) 
    }); // Wikidata entity claims
  
  const results = await searchByTitle('Jon Snow');
  const character = results.find(r => r.title === 'Jon Snow');
  expect(character).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/search.test.ts`
Expected: FAIL (Wikidata entity search not implemented)

- [ ] **Step 3: Implement Wikidata entity search in `searchByTitle`**

Add after OMDb fallback (around line 46), before `return []`:
```typescript
// 4. Wikidata entity search (characters, etc.) — last resort
const entityResults = await searchWikidataEntities(cleanQuery, signal);
if (entityResults.length > 0) return entityResults;

return [];
```

Add new helper function `searchWikidataEntities` (after `searchWikidata`):
```typescript
async function searchWikidataEntities(cleanQuery: string, signal?: AbortSignal): Promise<SearchResult[]> {
  try {
    // Step 1: search for matching Wikidata entities
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanQuery)}&language=en&limit=10&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { signal });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const entities = searchData?.search || [];
    if (entities.length === 0) return [];

    // Step 2: fetch claims to determine type and associated work
    const entityIds = entities.map((e: any) => e.id).join('|');
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityIds}&props=claims|descriptions&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl, { signal });
    if (!claimsRes.ok) return [];
    const claimsData = await claimsRes.json();
    const entityData = claimsData?.entities || {};

    const results: SearchResult[] = [];

    for (const entity of entities) {
      const claims = entityData[entity.id]?.claims;
      if (!claims) continue;

      // Determine if it's a character (P31 = Q5 human, or P1080 = fictional character)
      // and try to find the work it's from (P361 = part of, P1441 = present in work)
      let imdbId: string | undefined;
      let type: 'movie' | 'tv' = 'movie';
      let year: string | undefined;
      let associatedTitle = entity.description || '';

      // Try to get IMDb ID of the work (P345 on the work entity)
      const partOf = claims.P361 || claims.P1441 || [];
      for (const stmt of partOf) {
        const workQid = stmt?.mainsnak?.datavalue?.value?.id;
        if (workQid) {
          // Fetch the work's claims to get IMDb ID
          try {
            const workUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${workQid}&props=claims&format=json&origin=*`;
            const workRes = await fetch(workUrl, { signal });
            if (workRes.ok) {
              const workData = await workRes.json();
              const workClaims = workData?.entities?.[workQid]?.claims;
              const imdbClaim = workClaims?.P345;
              if (imdbClaim) {
                imdbId = imdbClaim[0]?.mainsnak?.datavalue?.value;
              }
              // Determine type from work's instance of
              const workInstanceOf = workClaims?.P31 || [];
              for (const wStmt of workInstanceOf) {
                const qid = wStmt?.mainsnak?.datavalue?.value?.id;
                if (qid === 'Q5398426' || qid === 'Q15416' || qid === 'Q254440') { // TV series, television program, TV series episode
                  type = 'tv';
                  break;
                }
                if (qid === 'Q11424' || qid === 'Q24869') { // film, feature film
                  type = 'movie';
                  break;
                }
              }
              // Get year from work
              const workPubDate = workClaims?.P577 || workClaims?.P580;
              if (workPubDate) {
                const rawTime = workPubDate[0]?.mainsnak?.datavalue?.value?.time;
                if (rawTime) {
                  const match = (rawTime as string).match(/^\+?(\d{4})/);
                  if (match) year = match[1];
                }
              }
            }
          } catch { /* ignore */ }
        }
      }

      // If no associated work found, use entity's own IMDb ID if available (rare for characters)
      if (!imdbId) {
        const entityImdb = claims.P345;
        if (entityImdb) {
          imdbId = entityImdb[0]?.mainsnak?.datavalue?.value;
        }
      }

      if (!imdbId || !(imdbId as string).startsWith('tt')) continue;

      results.push({
        imdbId: imdbId as string,
        title: entity.label || 'Unknown Character',
        year,
        type,
        posterUrl: undefined, // Could fetch from TMDB using imdbId if needed
      });
    }

    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('Wikidata entity search failed:', e);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/search.ts src/services/search.test.ts
git commit -m "feat(search): add Wikidata entity search for characters"
```

---

### Task 5: Update SearchResults component to render person type

**Files:**
- Modify: `src/components/SearchResults.tsx:12-117`
- Test: `src/components/SearchResults.test.tsx` (new)

**Interfaces:**
- Consumes: Extended `SearchResult` with `person` type, `known_for_department`, `known_for`
- Produces: Rendered person results with department badge and "known for" titles

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/SearchResults.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchResults } from './SearchResults';

describe('SearchResults person rendering', () => {
  it('renders person with Acting badge and known_for titles', () => {
    const personResult: SearchResult = {
      imdbId: 'nm0000123',
      title: 'Tom Hanks',
      type: 'person',
      known_for_department: 'Acting',
      known_for: [
        { imdbId: 'tt0120737', title: 'The Shawshank Redemption', type: 'movie' },
        { imdbId: 'tt0109830', title: 'Forrest Gump', type: 'movie' }
      ],
      posterUrl: 'https://image.tmdb.org/t/p/w92/path.jpg'
    };
    
    render(<SearchResults results={[personResult]} onSelect={vi.fn()} selectedIndex={-1} />);
    expect(screen.getByText('Tom Hanks')).toBeInTheDocument();
    expect(screen.getByText('Acting')).toBeInTheDocument();
    expect(screen.getByText('The Shawshank Redemption')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/SearchResults.test.tsx`
Expected: FAIL (component doesn't handle person type)

- [ ] **Step 3: Implement person rendering in `SearchResults`**

In the map function (around line 43), add handling for `person` type:
```typescript
{results.map((result, index) => {
  const isSelected = index === selectedIndex;
  
  if (result.type === 'person') {
    return (
      <div key={result.imdbId} role="option" aria-selected={isSelected} tabIndex={0} className={...}>
        {/* Poster/avatar */}
        <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center border border-slate-700/50">
          {result.posterUrl ? (
            <img src={result.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <User className="w-6 h-6 text-slate-600" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-100 truncate">{result.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400">
              <User className="w-3.5 h-3.5" />
              {result.known_for_department || 'Person'}
            </span>
          </div>
          
          {result.known_for && result.known_for.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.known_for.slice(0, 3).map((kf, ki) => (
                <span key={kf.imdbId} className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                  {kf.title} ({kf.type === 'movie' ? 'Movie' : 'TV'})
                </span>
              ))}
            </div>
          )}
        </div>
        
        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 shadow-lg shadow-cyan-400/50" />}
      </div>
    );
  }
  
  // ... existing movie/tv rendering
})}
```
(Add `import { User } from 'lucide-react';` at top)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/SearchResults.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchResults.tsx src/components/SearchResults.test.tsx
git commit -m "feat(search): render person results in SearchResults"
```

---

### Task 6: Update Navbar and HomePage to handle person selection

**Files:**
- Modify: `src/components/Navbar.tsx:28-107` (performSearch)
- Modify: `src/pages/HomePage.tsx:60-96` (performSearch)
- Test: Integration test or manual verification

**Interfaces:**
- Consumes: `searchByTitle` returns person results
- Produces: Clicking a person result re-searches with that person's name

- [ ] **Step 1: Write the failing test**

```typescript
// In Navbar.tsx performSearch, person selection should trigger new search
// This is behavioral; test via integration or manual verification
```

- [ ] **Step 2: Implement person selection handling in `Navbar.tsx`**

In `performSearch` (around line 95), after getting searchResults:
```typescript
} else {
  const searchResults = await searchByTitle(query, signal);
  if (signal.aborted) return;
  setResults(searchResults);
}
```

In `SearchResults` component's `handleClick` (SearchResults.tsx), when result.type === 'person':
```typescript
const handleClick = (result: SearchResult) => {
  if (result.type === 'person') {
    // Re-search with person's name to show their filmography
    performSearch(result.title);
    onSelect();
    return;
  }
  // ... existing navigation logic
};
```

Also update `HomePage.tsx` similarly — its `performSearch` is nearly identical.

- [ ] **Step 3: Run manual verification**

Start dev server: `npm run dev`
Test: Search "Tom Hanks" → see person result → click → shows their movies

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx src/pages/HomePage.tsx src/components/SearchResults.tsx
git commit -m "feat(search): handle person selection by re-searching"
```

---

### Task 7: Add comprehensive tests and verify end-to-end

**Files:**
- Test: `src/services/search.test.ts` (extend)
- Test: `src/components/SearchResults.test.tsx` (extend)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Full test coverage for new search behaviors

- [ ] **Step 1: Add integration-style tests**

```typescript
// In search.test.ts
describe('searchByTitle integration', () => {
  it('returns movie results for title query', async () => { ... });
  it('returns person results for actor name', async () => { ... });
  it('returns genre results for genre name', async () => { ... });
  it('returns character results for character name', async () => { ... });
  it('prioritizes exact title match over genre', async () => { ... });
});
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/search.test.ts src/components/SearchResults.test.tsx
git commit -m "test(search): add comprehensive extended search tests"
```

---

## Summary

This plan implements extended search in 7 tasks:
1. **Type extension** — SearchResult supports person
2. **TMDB person search** — Include actors/directors in multi-search
3. **Genre detection** — Route genre queries to TMDB discover
4. **Wikidata entity search** — Fallback for character names
5. **UI rendering** — SearchResults displays person with known-for
6. **Selection handling** — Click person → re-search filmography
7. **Tests** — Coverage for all new behaviors

Each task produces independently testable code and follows the existing codebase patterns.