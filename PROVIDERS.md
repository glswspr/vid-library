# VidRock, VidAPI & VidSrc Provider Documentation

This document describes the exact endpoints, request formats, query parameters, embed mechanics, player events, CORS behavior, and domain whitelisting details for **VidRock** (`vidrock.ru`), **VidAPI** (`vidapi.ru`) and **VidSrc** (`vidsrc.to`).

---

## 1. VidAPI (`https://vidapi.ru/`)

### Overview
VidAPI is a free video embed provider and aggregator supporting movies and TV shows mapped via IMDB or TMDB IDs. Embeds are served from `https://vaplayer.ru/embed/...`.

### Endpoints

#### Movie Embed
- **Path Endpoint**: `GET https://vaplayer.ru/embed/movie/{id}`
  - `{id}`: IMDB ID (with `tt` prefix, e.g. `tt23779058`) OR numeric TMDB ID (e.g. `1147301`).
- **Query Endpoint**: `GET https://vaplayer.ru/embed/movie?imdb={imdb_id}` OR `?tmdb={tmdb_id}`

#### TV Show Embed
- **Path Endpoint**: `GET https://vaplayer.ru/embed/tv/{id}/{season}/{episode}`
  - Format 1: `/embed/tv/205715/1/1`
  - Format 2: `/embed/tv/tt13159924/S01E01`
  - Format 3: `/embed/tv/205715/1-1`
- **Query Endpoint**: `GET https://vaplayer.ru/embed/tv?tmdb={tmdb_id}&season={season}&episode={episode}`

### Query Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `ds_lang` / `lang` | String | Default subtitle language ISO code (`en`, `sv`, `fa`) or OpenSubtitles code (`eng`, `swe`, `per`). Auto-activates matching subtitles. |
| `sub_url` / `sub_file` | URL | URL-encoded direct SRT/VTT remote subtitle track URL. |
| `sub_label` | String | Subtitle track label. |
| `sub_lang` | String | Subtitle language code (default: `en`). |
| `sub_default` | Boolean | Set subtitle as default track (`true`/`false`). |
| `resumeAt` / `startAt` | Float | Resume playback at specified timestamp (seconds). |
| `autoplay` | `0` or `1` | Enable (`1`) or disable (`0`) autoplay. |
| `primaryColor` / `color` | Hex | Primary UI color code (e.g., `#e50914`). |
| `title` | String | Custom title overlay string (URL encoded). |
| `poster` | URL | Custom thumbnail/poster image URL. |
| `showTitle` | Boolean | Display title overlay (`true`/`false`). |
| `controls` | Boolean | Show or hide player controls bar (`true`/`false`). |
| `overlay` | Boolean | Enable or disable hover gradient overlay (`true`/`false`). |

### Metadata & Listing APIs (Public CORS Enabled `Access-Control-Allow-Origin: *`)

#### Latest Movies
- **Endpoint**: `GET https://vidapi.ru/movies/latest/page-{PAGE}.json`
- **Response**:
  ```json
  {
    "page": 1,
    "per_page": 24,
    "total": 92866,
    "total_pages": 3870,
    "items": [
      {
        "tmdb_id": 1281091,
        "imdb_id": "tt34388152",
        "title": "Officer on Duty",
        "year": "2025",
        "poster_url": "https://image.tmdb.org/t/p/original/...",
        "rating": "7.1",
        "genre": "Action, Drama",
        "popularity": "154.2",
        "type": "movie",
        "embed_url": "https://vaplayer.ru/embed/movie/tt34388152"
      }
    ]
  }
  ```

#### Latest TV Shows
- **Endpoint**: `GET https://vidapi.ru/tvshows/latest/page-{PAGE}.json`
- **Response**: `items` array with `tmdb_id`, `imdb_id`, `title`, `year`, `poster_url`, `rating`, `genre`, `type: "tv"`.

#### Latest Episodes
- **Endpoint**: `GET https://vidapi.ru/episodes/latest/page-{PAGE}.json`
- **Response**: `items` array with `show_tmdb_id`, `season_number`, `episode_number`, `episode_title`, `show_title`, `embed_url`.

### Player Events (`postMessage`)
VidAPI player sends `PLAYER_EVENT` window messages to the parent frame:
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "player_info": {
      "imdb": "tt23779058",
      "tmdb": 1147301,
      "mediaType": "movie",
      "season": null,
      "episode": null,
      "title": "Movie Title",
      "poster": "https://..."
    },
    "player_status": "playing",
    "player_progress": 125.4,
    "player_duration": 7200
  }
}
```
Statuses: `"playing"`, `"paused"`, `"seeked"`, `"completed"`.

> **Note on Playback Controls**: VidAPI does **not** expose inbound `postMessage` commands to control play/pause/seek from the host page. The native player controls inside the iframe must be used for playback interaction.

### Domain Whitelisting
VidAPI supports domain whitelisting via the dashboard at `vadash.app`.
- Public embeds without restriction function out-of-the-box on open domains.
- If domain protection is enabled for an API key or account, the hosting site domain (e.g. `your-app.pages.dev` or `your-domain.com`) must be listed under **Domains → Allowed Sites**.

---

## 2. VidRock (`https://vidrock.ru/`)

### Overview
VidRock is a high-availability video embed provider. Embeds are loaded directly from `https://vidrock.ru/embed/...`.

### Endpoints

#### Movie Embed
- **Endpoint**: `GET https://vidrock.ru/embed/movie/{id}`
  - `{id}`: IMDB ID (e.g. `tt23779058`) or TMDB ID.

#### TV Show Embed
- **Endpoint**: `GET https://vidrock.ru/embed/tv/{id}/{season}/{episode}`
  - `{id}`: IMDB ID or TMDB ID.
  - `{season}`: Numeric season index.
  - `{episode}`: Numeric episode index.

### Query Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `ds_lang` / `lang` | String | Subtitle language ISO code (`en`, `sv`, `fa`). |
| `resumeAt` | Float | Resume timestamp in seconds. |
| `autoplay` | Boolean | Auto-start playback (`true`/`false` or `1`/`0`). |
| `autonext` | Boolean | Enable automatic next episode transition (`true`/`false`). |

### Player Events (`postMessage`)
VidRock emits compatible status messages to `window.parent`:
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "event": "playing",
    "currentTime": 125.4,
    "duration": 7200
  }
}
```

---

## 3. VidSrc (`https://vidsrc.to/`)

### Overview
VidSrc is a free video embed provider and aggregator supporting movies and TV shows mapped via IMDB or TMDB IDs. Embeds are served directly from `https://vidsrc.to/embed/...`.

### Endpoints

#### Movie Embed
- **Endpoint**: `GET https://vidsrc.to/embed/movie/{id}`
  - `{id}`: IMDB ID (with `tt` prefix, e.g. `tt23779058`) OR numeric TMDB ID (e.g. `1147301`).

#### TV Show Embed
- **Endpoint**: `GET https://vidsrc.to/embed/tv/{id}/{season}/{episode}`
  - `{id}`: IMDB ID or TMDB ID.
  - `{season}`: Numeric season index.
  - `{episode}`: Numeric episode index.

### Query Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `resumeAt` | Float | Resume timestamp in seconds. |
| `autoplay` | Boolean | Auto-start playback (`1`/`0`). |
| `lang` | String | Subtitle language code. |

### Domain Whitelisting
VidSrc embeds are served on open domains without registration. If a stream fails to load, fall back to the other servers via the player UI pills.

---

## 4. Comparative Summary & Architectural Decisions

1. **Player Control**: Neither provider exposes inbound `postMessage` command handlers. We use the provider's native player controls inside the iframe, and handle subtitle switching by updating the iframe `src` with `ds_lang={code}&resumeAt={progress}`.
2. **CORS & Authentication**: VidAPI listing endpoints allow public cross-origin CORS requests (`Access-Control-Allow-Origin: *`). Neither provider requires server secrets for embeds. A 100% static client-side web application is optimal.
3. **Resiliency**: If one provider is unavailable, the user can choose the alternative provider via unobtrusive UI pills (`[ VidRock ] [ VidAPI ] [ VidSrc ]`). Provider switching is always explicit upon user interaction.

---

## 5. VidVault (`vidvault.ru`) — Direct Source

VidVault is a **direct-source** backend (Server 6, native player) — not an embed.
It resolves TMDb IDs to direct MP4 download links (multiple resolutions) plus
SRT subtitles, proxied through a CORS-open worker so a pure client can stream them.

### API (CORS-open, `Access-Control-Allow-Origin: *`)

#### Get token
- **Endpoint**: `GET https://vidvault.ru/api/get-token`
- **Response**: `{ "t": "<token>", "e": "<expiry epoch ms>" }`

#### Resolve downloads
- **Endpoint**: `POST https://vidvault.ru/api/download-proxy`
- **Headers**: `Content-Type: application/json`, `x-request-token: <token>`
  (preflight `OPTIONS` allows `content-type,x-request-token`).
- **Body**: `{ "type": "movie"|"tv", "tmdbId": "<numeric>", "season": n, "episode": n }`
  (`season`/`episode` only for `tv`).
- **Response** (movies/episodes):
  ```json
  {
    "mp4Data": {
      "downloadInfo": { "data": {
        "downloads": [ { "url": "...", "resolution": 720, "size": "872092884", "format": "MP4", "codecName": "h264", "vipLocked": false } ],
        "captions":  [ { "lan": "ar", "lanName": "العربية", "url": "https://cacdn.hakunaymatata.com/subtitle/...srt?Policy=...&Signature=...&Key-Pair-Id=..." } ]
      } }
    },
    "mkvData": ..., "mkvV2Data": ..., "mkvV3Data": ..., "cached": true
  }
  ```
  (MKV variants are ignored client-side — browsers can't play MKV.)

### Delivery & CORS reality (verified 2026-08)
- Raw video CDN `bcdnxw.hakunaymatata.com/*.mp4` → **429 rate-limited, no ACAO**
  (not client-viable).
- Primary proxy `dl.gemlelispe.workers.dev/<encURL>?n=name` → 403/451, no ACAO.
- **Working stream path**: `https://vlaq11.site/<encodeURIComponent(url)>?n=<name>`
  → **206 Partial Content, `video/mp4`, `ACAO: *`** (this is the site's own
  fallback proxy; used directly in `VidVaultDirectSource`).
- Subtitles: raw caption CDN `cacdn.hakunaymatata.com/...srt` is CORS-open;
  fetched as a blob. SRT is converted to WebVTT client-side
  (`src/utils/subtitles.ts`) because `<track>` requires VTT.

### Implementation notes
- Provider file: `src/providers/VidVaultDirectSource.ts` (`fetchVidVaultStreams`),
  wired in `NativePlayer` via a `source` prop and exposed as **Server 6** in
  `VideoPlayer` (`SERVER_BUTTONS`). Not part of the embed `PROVIDERS` registry.
- Sources are sorted by resolution descending; the player auto-falls back to
  lower resolutions on error. Token is cached in-memory until its expiry.
- Results are cached with the shared `utils/streamCache.ts` (key prefix `vidvault`).
