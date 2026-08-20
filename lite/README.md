# VidLibrary Lite — for old Android TV browsers

A **standalone, dependency-free** version of the VidLibrary website built for the
built-in browsers / WebViews found on **older Android TVs** (Android 4.4+,
Chromium ~30+). The modern React app won't load there, but this version will.

**Where it lives:** `lite/` in this repo. After `npm run build` it is copied to
`dist/lite/`, so a single deploy ships both versions. Old TV users browse to:

```
https://<your-site>/lite/
```

## What it is

- **No framework, no build step, no dependencies.** Plain HTML + CSS + vanilla
  JavaScript written in strict **ES5** (no `fetch`, no `Promise` from the runtime,
  no arrow functions, no template literals, no optional chaining, no modules).
  It ships with its own tiny Promise polyfill and uses `XMLHttpRequest`.
- **Old-browser-safe CSS** — no CSS grid, no `gap` in flexbox, no CSS custom
  properties, no `aspect-ratio`, no `backdrop-filter`, no `position: sticky`.
- **D-pad / remote navigation** — arrow keys move focus spatially between cards,
  buttons and inputs; Enter selects; Escape (and the page's Back button) go home.
- **Shared data with the main app** — uses the *same* `localStorage` keys
  (`vid_library_progress_v2`, `vid_library_watchlist_v1`, `vid_library_provider`,
  `vid_library_provider_memory_v1`), so **Continue Watching**, **My List** and
  the remembered server carry over between the full site and Lite.

## Features

- **Home**: search (TMDB → Wikidata), open by IMDb ID, Continue Watching,
  My List, Trending Movies, Trending TV Shows.
- **Movie page**: details + player + More Like This + My List toggle.
- **TV page**: seasons, episode grid with progress bars, Prev/Next episode.
- **Player**: 7 iframe-embed servers —
  - Server 1 · VidRock (embed iframe)
  - Server 2 · VidAPI (embed iframe)
  - Server 3 · Videoasy (embed iframe)
  - Server 4 · Peachify (embed iframe)
  - Server 5 · VidSrc (embed iframe)
  - Server 6 · VidCore (embed iframe)
  - Server 7 · VidZee (embed iframe)
  - The native Direct MP4 player was removed (it never worked reliably); the
    player is now embed-only, matching the main app.
- **Watch progress** saved automatically from embed `PLAYER_EVENT` postMessages
  and Videoasy JSON progress messages.

## Files

```
lite/
  index.html      # SPA shell (hash-routed)
  css/lite.css    # old-browser-safe styles
  js/core.js      # Promise polyfill, XHR, DOM/format helpers
  js/api.js       # 2embed + TMDB + Wikidata + VidVault data layer
  js/store.js     # localStorage (shared keys with main app)
  js/player.js    # embed-only player (7 servers), progress saving
  js/views.js     # home / movie / tv / not-found renderers
  js/nav.js       # hash router + D-pad spatial navigation
```

## Local testing

```bash
# Any static file server works — there is no build step.
npx serve lite
# or
python -m http.server 8080 --directory lite
```

## API notes / fallbacks

- **2embed catalog** (`api.2embed.cc`) is used for trending/details/episodes when
  reachable (CORS-open from most hosts). If it fails, the app silently falls back
  to **TMDB** (using the public fallback key already embedded in the main app) and
  **Wikidata** for search.
- Videoasy and VidZee (like Peachify) require numeric TMDB ids, so IMDB ids are
  resolved via the TMDB API before building the embed URL.
