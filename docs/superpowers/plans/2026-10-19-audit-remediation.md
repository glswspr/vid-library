# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding from the 2026-10-19 project audit, and stop arrow keys from changing episodes.

**Architecture:** Fixes are applied per subsystem in dependency order: test harness, then deployment routing, then pure logic (settings, URLs, stats), then UI behaviour (search, player, cards, keyboard), then documentation. Pure functions get unit tests; behaviour that only exists in the DOM gets a Playwright check.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, Playwright (installed), Vitest + jsdom (added in Task 1), Electron 44.

**Spec:** The audit findings in this session (19 items) plus the two decisions below and the arrow-key requirement. No separate spec file exists; this plan is the record.

## Global Constraints

- Node engine floor: `"^20.19.0 || >=22.12.0"` (Vite 8 requirement). Add to `package.json` as `engines.node`.
- No new runtime dependencies. `vitest` and `jsdom` are dev-only.
- Keep `tsconfig.app.json` flags as they are (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`). Every task must pass `npx tsc -b --force`.
- Do not change the `VideoProvider` interface or `PROVIDERS` registry shape.
- Documentation is written in Simplified Technical English.
- Behaviour decisions locked by this plan:
  - **D1:** Provider precedence is `per-show pin > global default > remembered > first preferred`. Remembered still drives fallback order.
  - **D2:** The player's prev/next server buttons walk the user's server order, and the label shows the position in that order.

## Review Focus

1. **Non-numeric route params** (`/tv/x/season/abc/episode/xyz`) — a person pastes or mistypes a URL; the page must show season 1 episode 1 or a not-found state, never `NaN`.
2. **A provider whose template already contains a query string** — appending `?` twice silently drops resume position.
3. **A very dark accent colour** — accent-filled buttons must keep readable text.
4. **A keyboard user inside the episode grid** — arrows must move focus, never change episode.
5. **Two search inputs mounted at once** — a `?q=` deep link must issue one query and produce one result list.

---

### Task 1: Test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/utils/settings.test.ts`

**Interfaces:**
- Produces: `npm test` runs `vitest run`. Every later `*.test.ts` task uses this command.

- [ ] **Step 1: Add devDependencies and scripts**

Add to `package.json` `devDependencies`: `"vitest": "^3.2.4"`, `"jsdom": "^26.1.0"`. Add `"test": "vitest run"` to `scripts`. Add `"engines": { "node": "^20.19.0 || >=22.12.0" }` at top level.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

Clear `localStorage` before each test: `beforeEach(() => localStorage.clear());`

- [ ] **Step 4: Write the first failing test in `src/utils/settings.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings } from './settings';

describe('settings defaults', () => {
  it('returns a default server when nothing is stored', () => {
    expect(getSettings().defaultProvider).toBe('vidrock');
  });

  it('persists a changed default server', () => {
    saveSettings({ defaultProvider: 'videasy' });
    expect(getSettings().defaultProvider).toBe('videasy');
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 2 passed. If `vitest` is missing, `npm install` first.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/utils/settings.test.ts
git commit -m "test: add vitest harness"
```

---

### Task 2: TMDB proxy routing on Vercel

**Files:**
- Create: `api/tmdb/[...path].ts` (moved from `api/tmdb.ts`)
- Delete: `api/tmdb.ts`
- Modify: `vercel.json`
- Modify: `server/tmdbProxy.ts` (comment only)

**Interfaces:**
- Consumes: `proxyTmdb(req)` from `server/tmdbProxy.ts` (already strips the `/api/tmdb` prefix).
- Produces: `GET /api/tmdb/<anything>` reaches the function on Vercel.

- [ ] **Step 1: Move the handler to a catch-all route**

`git mv api/tmdb.ts "api/tmdb/[...path].ts"`. Keep the body unchanged except the usage comment, which must read `fetch('/api/tmdb/movie/603')` (it currently documents the wrong `/api/tmdb/3/movie/603`).

- [ ] **Step 2: Guard the SPA catch-all in `vercel.json`**

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Verify locally**

Run: `npx tsc -b --force`
Expected: no errors (confirms `api/tmdb/[...path].ts` is still inside the `tsconfig.node.json` include glob `api/**/*.ts`).

Run: `npm run build`
Expected: `built in` with no error.

- [ ] **Step 4: Commit**

```bash
git add -A api vercel.json server/tmdbProxy.ts
git commit -m "fix: route /api/tmdb sub-paths to the proxy function"
```

---

### Task 3: Deploy script reads the real env file

**Files:**
- Modify: `scripts/deploy-vercel.mjs:22-30`

**Interfaces:**
- Produces: `hookFromEnvFile()` reads `VERCEL_DEPLOY_HOOK` from the first of `.env`, `.env.local` that exists.

- [ ] **Step 1: Change the reader**

Replace the single-path read with a loop over `['.env', '.env.local']`, returning the first match. Update the header comment and the error text to name `.env.local` as the file this repo actually uses.

- [ ] **Step 2: Verify**

Run: `node scripts/deploy-vercel.mjs`
Expected with no hook configured: the "Missing VERCEL_DEPLOY_HOOK" message listing both filenames, exit code 1. It must not crash on a missing file.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy-vercel.mjs
git commit -m "fix: read deploy hook from .env.local"
```

---

### Task 4: Embed URLs keep their existing query string

**Files:**
- Modify: `src/providers/BaseEmbedProvider.ts:20-31`
- Modify: `src/providers/VidCoreProvider.ts:12-13`
- Create: `src/providers/BaseEmbedProvider.test.ts`

**Interfaces:**
- Produces: `buildEmbedUrl(template, options)` joins params with `&` when `template` already contains `?`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildEmbedUrl } from './BaseEmbedProvider';

describe('buildEmbedUrl', () => {
  it('uses ? for a template without a query', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie', resumeAt: 120 }))
      .toBe('https://x.test/movie/tt1?resumeAt=120');
  });

  it('uses & for a template that already has a query', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}?autoPlay=true', { id: 'tt1', type: 'movie', resumeAt: 120 }))
      .toBe('https://x.test/movie/tt1?autoPlay=true&resumeAt=120');
  });

  it('returns the bare template when there is nothing to add', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie' }))
      .toBe('https://x.test/movie/tt1');
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/providers/BaseEmbedProvider.test.ts`
Expected: the `&` case fails with `?autoPlay=true?resumeAt=120`.

- [ ] **Step 3: Fix the join**

In `buildEmbedUrl`, choose the separator from `url.includes('?')` instead of always `?`.

- [ ] **Step 4: Drop the hardcoded query from VidCore**

`VidCoreProvider` templates become `https://vidcore.io/movie/{id}` and `https://vidcore.io/tv/{id}/{season}/{episode}`. Update the doc comment to say autoplay is passed through `buildEmbedUrl`, not hardcoded.

- [ ] **Step 5: Run it**

Run: `npm test -- src/providers/BaseEmbedProvider.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/providers
git commit -m "fix: keep existing query strings in embed URLs"
```

---

### Task 5: Invalid route params never become NaN

**Files:**
- Create: `src/utils/params.ts`
- Create: `src/utils/params.test.ts`
- Modify: `src/pages/TVShowPage.tsx:31-32`

**Interfaces:**
- Produces: `parsePositiveInt(value: string | undefined, fallback: number): number` — returns `fallback` for `undefined`, empty, non-numeric, `NaN`, zero, or negative input.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parsePositiveInt } from './params';

describe('parsePositiveInt', () => {
  it('parses a normal value', () => expect(parsePositiveInt('3', 1)).toBe(3));
  it('falls back for undefined', () => expect(parsePositiveInt(undefined, 1)).toBe(1));
  it('falls back for text', () => expect(parsePositiveInt('abc', 1)).toBe(1));
  it('falls back for zero', () => expect(parsePositiveInt('0', 1)).toBe(1));
  it('falls back for a negative number', () => expect(parsePositiveInt('-2', 1)).toBe(1));
  it('truncates a decimal', () => expect(parsePositiveInt('2.9', 1)).toBe(2));
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/utils/params.test.ts`
Expected: FAIL, `parsePositiveInt is not a function`.

- [ ] **Step 3: Implement `src/utils/params.ts`**

`Number.parseInt` on the raw string, then `Number.isFinite(n) && n > 0 ? n : fallback`.

- [ ] **Step 4: Use it in `TVShowPage`**

`const currentSeason = parsePositiveInt(seasonParam, 1);` and the same for `currentEpisode`. Remove the two `parseInt` calls.

- [ ] **Step 5: Run it**

Run: `npm test -- src/utils/params.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Verify in the browser**

Start `npm run dev`, open `/tv/tt0903747/season/abc/episode/xyz`.
Expected: the page renders "Season 1" and an episode grid. No `NaN` in the DOM, no React `value` warning in the console.

- [ ] **Step 7: Commit**

```bash
git add src/utils/params.ts src/utils/params.test.ts src/pages/TVShowPage.tsx
git commit -m "fix: fall back to season 1 episode 1 for invalid params"
```

---

### Task 6: One search owner for `?q=`

**Files:**
- Modify: `src/components/Navbar.tsx` (remove the `?q=` effect at lines 176-182)
- Modify: `src/components/HomePage.tsx:236` and `src/components/Navbar.tsx:247` (listbox roles and ids)
- Modify: `src/components/SearchResults.tsx:36` (keep its `role="listbox"`)

**Interfaces:**
- Produces: `/?q=<text>` issues exactly one search, rendered by `HomePage`. The navbar dropdown gets `id="navbar-search-results"`; the home page keeps `id="search-results"`.

- [ ] **Step 1: Remove the navbar `?q=` effect**

Delete the `useEffect` that reads `searchParams.get('q')` in `Navbar.tsx`. Keep the `FOCUS_SEARCH_EVENT` listener. Remove the now-unused `useSearchParams` import and `searchParams` binding.

- [ ] **Step 2: Remove the wrapper listbox roles**

In `HomePage.tsx`, the wrapper `<div id="search-results" role="listbox">` becomes `<div id="search-results">` — `SearchResults` already carries `role="listbox"`. Same for the navbar wrapper, which becomes `<div id="navbar-search-results">`, and add `aria-controls="navbar-search-results"` plus `aria-expanded` to the navbar input.

- [ ] **Step 3: Verify**

Run `npm run dev`, then open `/?q=matrix` with DevTools network filtered to `search/multi`.
Expected: one `search/multi` request. In the console, `[...document.querySelectorAll('[id]')]` has no duplicates.

- [ ] **Step 4: Verify the navbar still searches**

Type in the navbar input on the home page.
Expected: the dropdown appears with results and no duplicate-id warning.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx src/pages/HomePage.tsx
git commit -m "fix: single owner for the q search deep link"
```

---

### Task 7: Explicit server choice beats remembered server

**Files:**
- Modify: `src/utils/settings.ts:126-137`
- Modify: `src/components/SettingsMenu.tsx:142-144` (copy)
- Modify: `src/utils/settings.test.ts`

**Interfaces:**
- Consumes: `getRememberedProvider` from `./storage`.
- Produces: `resolveDefaultProvider(mediaId)` order is pin, then `settings.defaultProvider`, then remembered.

- [ ] **Step 1: Write the failing test**

```ts
import { resolveDefaultProvider, saveSettings, setShowDefaultProvider } from './settings';
import { rememberProvider } from './storage';

it('uses the global default over a remembered server', () => {
  rememberProvider('tt1', 'm111');
  saveSettings({ defaultProvider: 'videasy' });
  expect(resolveDefaultProvider('tt1')).toBe('videasy');
});

it('still lets a pin beat the global default', () => {
  rememberProvider('tt1', 'm111');
  saveSettings({ defaultProvider: 'videasy' });
  setShowDefaultProvider('tt1', 'vidapi', 'Test');
  expect(resolveDefaultProvider('tt1')).toBe('vidapi');
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/utils/settings.test.ts`
Expected: the first new test fails, receiving `'m111'`.

- [ ] **Step 3: Reorder the lookup**

Pin first, then `settings.defaultProvider`, then `getRememberedProvider(mediaId)` as the last fallback before `'vidrock'`.

- [ ] **Step 4: Update the menu copy**

The "Default server" hint becomes: "Starting server for every title. A server you pin for one show wins over this."

- [ ] **Step 5: Run it**

Run: `npm test -- src/utils/settings.test.ts`
Expected: all passed.

- [ ] **Step 6: Commit**

```bash
git add src/utils/settings.ts src/utils/settings.test.ts src/components/SettingsMenu.tsx
git commit -m "fix: default server applies to every title"
```

---

### Task 8: Server buttons follow the user's order

**Files:**
- Modify: `src/components/VideoPlayer.tsx:30-41` (labels), `:202-207` (`cycleServer`), `:128-132` (`currentServer`)
- Modify: `src/components/SettingsMenu.tsx` (order list is already the source)

**Interfaces:**
- Consumes: `getProviderFallbackOrder(preferred: ProviderId[])` from `../utils/storage`.
- Produces: `cycleServer(±1)` moves through `getProviderFallbackOrder(settings.preferredProviders)`. The centre label reads `Server <n>` where `n` is the 1-based index in that order.

- [ ] **Step 1: Replace the fixed button table**

Delete the `SERVER_BUTTONS` constant. Build the order once per render: `const serverOrder = getProviderFallbackOrder(settings.preferredProviders);`

- [ ] **Step 2: Rewrite `cycleServer` and the label**

`cycleServer(dir)` uses the index of `providerId` in `serverOrder` and wraps. The label is `Server ${serverOrder.indexOf(providerId) + 1}`; keep `PROVIDER_NAMES` for the name beside it.

- [ ] **Step 3: Verify**

Run `npm run dev`, open a movie, open Settings, move a server to position 1, close Settings, reload the page.
Expected: the player starts on that server and the label reads `Server 1`.

- [ ] **Step 4: Verify cycling**

Click the next-server arrow twice.
Expected: the server names follow the order shown in Settings, and the label counts 2, 3.

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoPlayer.tsx
git commit -m "fix: server buttons follow the user's order"
```

---

### Task 9: Watch time counts finished content

**Files:**
- Create: `src/utils/watchStats.ts`
- Create: `src/utils/watchStats.test.ts`
- Modify: `src/components/WatchStats.tsx:31-76`

**Interfaces:**
- Produces: `computeWatchTime(items: WatchProgress[]): number` — sum of `duration` for completed entries, plus `min(progress, duration)` for the rest.

- [ ] **Step 1: Write the failing test**

```ts
import { computeWatchTime } from './watchStats';
import type { WatchProgress } from '../types';

const base = { id: 'tt1', title: 'T', type: 'movie' as const, progress: 0, duration: 3600, updatedAt: 1 };

it('counts a finished title as its full duration', () => {
  expect(computeWatchTime([{ ...base, progress: 60, completed: true }])).toBe(3600);
});

it('counts an unfinished title by its position', () => {
  expect(computeWatchTime([{ ...base, progress: 600 }])).toBe(600);
});

it('never counts more than the duration', () => {
  expect(computeWatchTime([{ ...base, progress: 9999, duration: 3600 }])).toBe(3600);
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/utils/watchStats.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `computeWatchTime` and use it**

`WatchStats` calls it instead of the `totalSeconds += item.progress` loop. Keep the existing `formatWatchTime` and the "Time watched" label.

- [ ] **Step 4: Run it**

Run: `npm test -- src/utils/watchStats.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/utils/watchStats.ts src/utils/watchStats.test.ts src/components/WatchStats.tsx
git commit -m "fix: count finished titles at full duration in watch time"
```

---

### Task 10: Remove the second preferred-provider store

**Files:**
- Modify: `src/utils/storage.ts:90-98` (delete `getPreferredProvider`, `setPreferredProvider`, `KEYS.PROVIDER`)
- Modify: `src/components/VideoPlayer.tsx` (remove both call sites at the import, `handleProviderChange`, and `onLoad`)

**Interfaces:**
- Produces: `settings.defaultProvider` is the only stored global preference. Remembered-per-title still uses `KEYS.PROVIDER_MEMORY`.

- [ ] **Step 1: Delete the dead pair**

Remove `getPreferredProvider`, `setPreferredProvider`, and the `PROVIDER` key from `KEYS`. Confirm with `grep -rn "PreferredProvider(" src` that nothing remains.

- [ ] **Step 2: Remove the writes in the player**

Delete the import and both calls. `rememberProvider(media.id, providerId)` on load stays.

- [ ] **Step 3: Verify**

Run: `npx tsc -b --force` then `npm run build`.
Expected: no errors, no unused-import error.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts src/components/VideoPlayer.tsx
git commit -m "refactor: drop the unused preferred-provider store"
```

---

### Task 11: One cached IMDb to TMDB resolver

**Files:**
- Modify: `src/components/VideoPlayer.tsx:19` and `:336-344`
- Modify: `src/utils/tv.ts:45-84` (delete `resolveImdbToTmdb`)

**Interfaces:**
- Consumes: `resolveTmdbFromImdb(imdbId, type)` from `../services/metadata` (24h cache).
- Produces: `utils/tv.ts` exports only `isTvDevice` and `applyTvMode`.

- [ ] **Step 1: Swap the call site**

In the player's TMDB-resolution effect, call `resolveTmdbFromImdb(media.imdbId, media.type)` and use `.id`. The `type` argument fixes a latent bug: the old helper always preferred the show bucket, so a movie could resolve to a same-id show.

- [ ] **Step 2: Delete the duplicate**

Remove `resolveImdbToTmdb` and the now-unused `FALLBACK_TMDB_API_KEY`/`canUseTmdb`/`tmdbFetchJson` import from `utils/tv.ts`.

- [ ] **Step 3: Verify**

Run: `npx tsc -b --force`
Expected: no errors.

Open a movie page with the network tab filtered to `find/`.
Expected: one request per title per session, not two.

- [ ] **Step 4: Commit**

```bash
git add src/components/VideoPlayer.tsx src/utils/tv.ts
git commit -m "refactor: single cached imdb to tmdb resolver"
```

---

### Task 12: Delete unused files and exports

**Files:**
- Delete: `src/components/ServerStatusDot.tsx`, `src/hooks/useServerHealth.ts`, `src/assets/hero.png`, `test-wiki-episodes.mjs`
- Modify: `src/utils/imdb.ts` (delete `isImdbId`)

**Interfaces:**
- Produces: no dangling imports; `getServerHealth` stays in `storage.ts` because `recordServer*` share its key.

- [ ] **Step 1: Confirm no references**

Run: `grep -rn "ServerStatusDot\|useServerHealth\|hero.png\|isImdbId" src`
Expected: only the definitions themselves.

- [ ] **Step 2: Delete**

`git rm` the four files and the `isImdbId` function.

- [ ] **Step 3: Verify**

Run: `npx tsc -b --force && npm run build && npm run lint`
Expected: build passes; lint warnings drop to the `TVShowPage`/`VideoPlayer` hook warnings only.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused files and exports"
```

---

### Task 13: `.env.example` survives `.gitignore`

**Files:**
- Modify: `.gitignore:33`

**Interfaces:**
- Produces: `.env.example` is not ignored; `.env`, `.env.local`, `.env.*.local` still are.

- [ ] **Step 1: Replace the blanket pattern**

Replace the trailing `.env*` line with:

```
.env
.env.*
!.env.example
```

- [ ] **Step 2: Verify**

Run: `git check-ignore -v --no-index .env.example`
Expected: no output (not ignored).

Run: `git check-ignore -v --no-index .env.local`
Expected: reports the `.env.*` line.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: keep .env.example trackable"
```

---

### Task 14: Dark accent colours stay readable

**Files:**
- Create: `src/utils/accent.ts`
- Create: `src/utils/accent.test.ts`
- Modify: `src/App.tsx:16-38`
- Modify: `src/components/SettingsMenu.tsx` (accent hint)

**Interfaces:**
- Produces: `readableAccent(hex: string): string` — returns the input when its relative luminance is at least `0.20`, otherwise the input blended 50% toward white, repeated until it passes.

- [ ] **Step 1: Write the failing test**

```ts
import { readableAccent } from './accent';

it('keeps a bright accent unchanged', () => expect(readableAccent('#06b6d4')).toBe('#06b6d4'));
it('lightens a near-black accent', () => expect(readableAccent('#101010')).not.toBe('#101010'));
it('returns a 6-digit hex', () => expect(readableAccent('#101010')).toMatch(/^#[0-9a-f]{6}$/));
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/utils/accent.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `readableAccent`**

Relative luminance per WCAG (`0.2126R + 0.7152G + 0.0722B` on linearised channels). Blend toward `#ffffff` while below `0.20`.

- [ ] **Step 4: Use it in `AccentApplier`**

Run `settings.accentColor` through `readableAccent` before deriving the shades.

- [ ] **Step 5: Add the hint**

Under the colour input: "Very dark colours are lightened so button text stays readable."

- [ ] **Step 6: Run it**

Run: `npm test -- src/utils/accent.test.ts`
Expected: 3 passed.

- [ ] **Step 7: Verify in the browser**

Set the accent to `#101010`, then check a `bg-cyan-500` button's computed `background-color`.
Expected: not `rgb(16, 16, 16)`.

- [ ] **Step 8: Commit**

```bash
git add src/utils/accent.ts src/utils/accent.test.ts src/App.tsx src/components/SettingsMenu.tsx
git commit -m "fix: keep text readable on accent-coloured surfaces"
```

---

### Task 15: Arrow keys move focus, not episodes

**Files:**
- Modify: `src/pages/TVShowPage.tsx:271-283` (delete the handler)
- Modify: `README.md` (remove the shortcut claim)

**Interfaces:**
- Produces: `TVShowPage` installs no global arrow-key listener. Episode changes come only from the Prev/Next buttons, the end card, and autoplay. `useSpatialNav` owns arrow keys everywhere.

- [ ] **Step 1: Delete the effect**

Remove the whole `useEffect` that maps `ArrowRight`/`ArrowLeft` to `handleNextEpisode`/`handlePrevEpisode`. Keep `useEpisodeNavigation`, `handleNextEpisode`, and `handlePrevEpisode` — the buttons and autoplay still call them.

- [ ] **Step 2: Confirm the failure first**

Before deleting, with `npm run dev` open on a TV show page, press ArrowRight with focus on the last episode card in a row.
Expected: the page navigates to the next episode. This is the bug. After deleting the effect, the same key press leaves the URL unchanged.

- [ ] **Step 3: Verify the grid still navigates**

Press ArrowRight with focus on an episode card that has a neighbour.
Expected: focus moves to the next card, URL unchanged.

- [ ] **Step 4: Verify the player still seeks**

Focus the iframe and press ArrowRight.
Expected: `useSpatialNav` returns early inside `[data-video-player-outer]`, so the embed handles the key.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TVShowPage.tsx
git commit -m "fix: arrow keys no longer change episodes"
```

---

### Task 16: No interactive element inside a link

**Files:**
- Modify: `src/components/MediaCard.tsx:42-114`
- Modify: `src/components/ContinueWatching.tsx:271-341` and `:346-416`
- Modify: `src/pages/WatchHistoryPage.tsx:530-565` and `:585-651`

**Interfaces:**
- Produces: the pattern already used by `TVShowPage` episode cards — a `relative` wrapper `div`, the `<Link>` as a sibling, the `<button>` positioned over it.

- [ ] **Step 1: Fix `MediaCard`**

Wrap in `<div className="relative">`. The `<Link>` keeps the card markup and loses the bookmark `<button>`. The button becomes a sibling after the `</Link>`, absolutely positioned at `bottom-2.5 right-2.5 z-10`. `handleToggleList` no longer needs `preventDefault`.

- [ ] **Step 2: Fix `ContinueWatching`**

Both card branches (`cw_` and `cw_next_`) follow the same shape: wrapper `div` (keeps `shrink-0 snap-start`), `<Link>`, then the remove button as a sibling with `absolute top-1.5 right-1.5 z-20`. The button keeps `handleRemove` minus `preventDefault`.

- [ ] **Step 3: Fix `WatchHistoryPage`**

Grid and list rows: move `renderRemoveButton(...)` out of the `<Link>` into the wrapper. The wrapper needs `relative`; the list row already is not, so add it.

- [ ] **Step 4: Verify with the keyboard**

Run `npm run dev`, open the home page, `Tab` to a card.
Expected: one tab stop per card. `Tab` again moves to the next card, not to the bookmark button. Clicking the bookmark still toggles without navigating.

- [ ] **Step 5: Verify with the accessibility tree**

In DevTools, inspect a card.
Expected: no `<button>` descendant of an `<a>`.

- [ ] **Step 6: Commit**

```bash
git add src/components/MediaCard.tsx src/components/ContinueWatching.tsx src/pages/WatchHistoryPage.tsx
git commit -m "fix: no nested interactive elements in cards"
```

---

### Task 17: Documentation matches the code

**Files:**
- Modify: `README.md`
- Modify: `PROVIDERS.md`
- Delete: `AUDIT.md`
- Modify: `src/pages/HomePage.tsx:275`

**Interfaces:**
- Produces: README lists ten providers, no subtitle claim, no "zero backend" claim, correct `favicon.svg`, Node floor `^20.19 || >=22.12`. `PROVIDERS.md` has no VidVault section.

- [ ] **Step 1: README feature list**

Replace the two-provider claim with ten (VidRock, VidAPI, Videasy, Peachify, VidSrc, VidCore, VidZee, Mapple, 111Movies, StreamX). Delete the subtitle-selection bullet. Replace "Zero Account & Zero Backend Required" with "No account required", and state that the optional TMDB proxy runs as a serverless function. Fix the Node prerequisite to `^20.19 or >=22.12`. Fix the project tree: `favicon.svg`, and add `api/`, `electron/`, `server/`.

- [ ] **Step 2: Remove the dead shortcut claim**

The "Keyboard Shortcuts" bullet said arrows change episodes. Replace with: "Keyboard: arrows move focus; `F` toggles fullscreen on a detail page."

- [ ] **Step 3: Remove PROVIDERS.md section 5**

Delete "VidVault (`vidvault.ru`) — Direct Source" in full. It documents `VidVaultDirectSource.ts`, `NativePlayer`, `utils/subtitles.ts`, `utils/streamCache.ts`, and a "Server 6" that do not exist.

- [ ] **Step 4: Delete the stale audit**

`git rm AUDIT.md`. Its recommendations (Open Graph tags, skeleton loaders, `aria-live`, genre rows, resume button) are all implemented, so it misleads.

- [ ] **Step 5: Fix the home page comment**

`HomePage.tsx:275` claims "Top Rated, New This Month, Because You Watched, Coming Soon, Genre rows". Replace with "Top Rated, Because You Watched, Genre rows" — what `buildHomeRows` actually returns.

- [ ] **Step 6: Verify**

Run: `grep -rn "VidVault\|NativePlayer\|streamCache\|Subtitle Selection" README.md PROVIDERS.md`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: describe the app that exists"
```

---

## Self-Review

**Spec coverage:** all 19 audit findings plus the arrow-key requirement map to a task. 1→2, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7, 8→8, 9→9, 10→17, 11→10, 12→11, 13→12, 14→17, 15→17, 16→17, 17→13, 18→14, 19→16, arrow keys→15. Task 1 is harness only.

**Type consistency:** `parsePositiveInt`, `computeWatchTime`, `readableAccent`, `buildEmbedUrl` keep one name each across tasks. `getProviderFallbackOrder(preferred)` matches its Task 10-era signature (already changed in this session).

**Open risk left in the plan:** Task 9 counts a rewatched title once, not twice, because `WatchProgress` has no accumulated-watch field. Fixing that properly needs a schema change and a migration; it is out of scope here and is noted rather than silently accepted.
