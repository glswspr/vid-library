# Vid Library — Personal Video Streaming Website

A clean, lightweight, publicly accessible web application for browsing movies and TV shows and watching them through third-party video embeds. Built as a pure client-side Single Page Application (SPA) that deploys to Cloudflare Pages, Vercel, or Netlify.

---

## Key Features

- **Eleven embed servers**: VidPrime, VixSrc, VidNest, VidLink, VidSrc, Mapple, VidZee, VidCore, Peachify, VidAPI and 111Movies, each checked playing a movie and a TV episode inside a cross-origin iframe, with manual switching, an editable fallback order, automatic fallback when a server fails, and resume on the three that honour a start position.
- **Downloads**: the player's download menu lists the real MP4/MKV files behind the current episode or movie, with resolution, file size, and a working link. A small Cloudflare Worker resolves and verifies the files, because the upstream CDNs refuse cross-origin reads and require their own Referer.
- **Per-show server pin**: pin a server for one show and it is used every time you open that show.
- **Deep-Link SPA Routing**: Shareable, direct-accessible URLs:
  - `/` (Catalog, Search, Continue Watching)
  - `/movie/{id}` (Movie player page)
  - `/tv/{id}` (TV show page)
  - `/tv/{id}/season/{season}/episode/{episode}` (Direct episode player page)
- **Next Episode Navigation**: Seamless **Next Episode →** button handling intra-season (`S1E4 -> S1E5`) and inter-season (`S1E10 -> S2E1`) transitions.
- **Continue Watching**: Saves playback progress in browser `localStorage` through iframe `PLAYER_EVENT` listeners and presents a "Continue Watching" row on the homepage.
- **Watch history and statistics**: A history page with search, filters, sorting, grid and list views, and an undo after clearing.
- **Keyboard and remote**: Arrow keys move focus between controls; `F` toggles fullscreen on a detail page. Designed for Android TV browsers and D-pads.
- **No account required**: 100% client-side application. No registration, no analytics, no cookies beyond `localStorage`. An optional serverless function proxies TMDB so an API key stays off the client.

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) `^22.22` or `>=24.15` (the floor the test tooling requires)
- `npm` (comes with Node.js)

### Steps

1. **Clone or navigate to the repository**:
   ```bash
   git clone <your-repository-url>
   cd vid-library
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (Optional):
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Note: No API keys are required for the app to function. The public TMDB API provides the catalog out of the box).*

4. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Production Build & Local Preview

To build and test the production bundle locally before deploying:

1. **Run the production build**:
   ```bash
   npm run build
   ```
   This generates optimized static HTML/JS/CSS output in the `dist/` directory.

2. **Preview the production build locally**:
   ```bash
   npm run preview
   ```
   Open the printed URL (typically `http://localhost:4173`) to verify the built site.

---

## Deployment Guide (Step-by-Step)

The project is structured for 1-click deployment from GitHub to free static hosting services.

### Option A: Cloudflare Pages (Recommended)

1. **Push your code to GitHub**:
   - Create a repository on GitHub (public or private).
   - Push your source code:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
     git push -u origin main
     ```

2. **Create Cloudflare Account**:
   - Sign up for a free account at [dash.cloudflare.com](https://dash.cloudflare.com/).

3. **Connect Repository to Cloudflare Pages**:
   - Go to **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
   - Select your GitHub repository.

4. **Configure Build Settings**:
   - **Project Name**: `vid-library` (or any name you prefer)
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
   - **Environment Variables**: None required (or add `VITE_TMDB_API_KEY` if you have one).

5. **Deploy**:
   - Click **Save and Deploy**.
   - Cloudflare will build the site and provide a free HTTPS public URL (e.g. `https://vid-library.pages.dev`).

6. **Updating the Website Later**:
   - Every time you push a git commit to the `main` branch, Cloudflare automatically builds and updates the live website within seconds.

---

### Option B: Vercel

1. Create a free account at [vercel.com](https://vercel.com).
2. Click **Add New Project** → Select your GitHub repository.
3. Keep default settings (Vite template detected):
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**.
5. Receive your live URL (e.g. `https://vid-library.vercel.app`).

---

### Option C: Netlify

1. Create a free account at [netlify.com](https://netlify.com).
2. Click **Add new site** → **Import an existing project** → GitHub.
3. Build Settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Click **Deploy site**.
5. Receive your live URL (e.g. `https://vid-library.netlify.app`).

---

## Custom Domain Setup (Optional)

If you decide to attach a custom domain (e.g. `https://my-family-videos.com`) later:

1. **Purchase a domain** from any registrar (Namecheap, Cloudflare Registrar, Porkbun, etc.).
2. **In Cloudflare Pages / Vercel / Netlify**:
   - Navigate to **Custom Domains** under your deployment settings.
   - Enter your domain name (e.g. `my-family-videos.com`).
3. **Update DNS Records**:
   - Add a `CNAME` record pointing your domain or subdomain to your hosting provider's target address (e.g. `vid-library.pages.dev`).
4. SSL/HTTPS will be automatically provisioned for free.

---

## Access from Iran

`v1d.surge.sh` is blocked inside Iran. The app loads over HTTPS (port 443, whitelisted in Iran), but Iran's border gateway uses protocol whitelisting and SNI-based filtering. Surge.sh's IP ranges are likely blocklisted and the domain fingerprint is known.

**Key context (2026):** Iran has moved from a blacklist model to a protocol whitelist — only DNS (UDP/53), HTTP (80/TCP), and HTTPS (443/TCP) pass the border. UDP is aggressively dropped (QUIC, WireGuard, OpenVPN UDP all dead). IPv6 is disabled. TLS SNI is inspected at the border. However, [Cloudflare IP ranges are partially whitelisted](https://amnezia.org/blog/internet-censorship-in-iran-q1-2026-and-forecast) because many Iranian government and business sites use Cloudflare — so Cloudflare-hosted pages have a better chance than raw Surge.

### Try these deployments

The app deploys to any static host. If one domain is blocked, deploy to another:

| Host | URL pattern | Works from Iran? |
| :--- | :--- | :--- |
| Cloudflare Pages | `vid-library.pages.dev` | **Best shot among free hosts** — Cloudflare IP ranges are partially whitelisted in Iran because many Iranian sites use them for DDoS protection. |
| GitHub Pages | `your-username.github.io/vid-library` | Worth trying — widely shared IPs, less likely to be target-blocked. |
| Vercel | `vid-library.vercel.app` | Same category as Surge — try if CF is blocked. |
| Custom domain via Cloudflare CDN | `your-own-domain.com` via Cloudflare proxy | **Best odds** — an unknown domain with Cloudflare's IP ranges avoids both SNI and IP blocklists. |

### Embed providers that may work

The video embed iframes load from third-party domains. Iran's filtering blocks most non-HTTP protocols (UDP, QUIC, WireGuard, etc.), but HTTPS embeds with standard HLS over TCP/443 sometimes pass.

Most of the servers sit behind Cloudflare, and Cloudflare ranges are partly whitelisted in Iran, so the default order already starts with the most likely ones:

1. **VidPrime** (`vidprime.top`) - Cloudflare.
2. **VixSrc** (`vixsrc.to`) - Cloudflare.
3. **VidNest** (`vidnest.pro`) - Cloudflare.
4. **VidLink** (`vidlink.pro`) - Cloudflare.
5. **VidSrc**, **Mapple**, **VidZee**, **VidCore**, **Peachify**, **VidAPI** and **111Movies** - try them in order, then reorder in Settings.

If no provider loads, the ISP is likely performing deep packet inspection on the embed traffic. The user may need a TLS tunnel or a **VPN with HTTPS obfuscation** (VLESS/Reality, WebSocket tunnel, or Hysteria 2 with obfuscation).

### Deploy to an alternative domain

```bash
# Deploy current build to Cloudflare Pages (requires wrangler CLI)
npm run deploy:cf

# Or set up Cloudflare Pages from the GitHub repo with zero config:
# GitHub repo > Settings > Pages > Connect Cloudflare Pages via Git integration.
# The `_redirects` file is already in the repo — SPA routing works out of the box.

# If a domain gets blocked, rotate to a fresh Surge subdomain:
npm run deploy:rotate v1d-mirror   # deploys to v1d-mirror.surge.sh
```

---

## Downloads

The player's download button opens a list of the actual MP4/MKV files behind the title you are watching: resolution, file size, and a link that starts the download.

The links cannot be built in the browser. The CDNs behind the embed players refuse cross-origin reads (403 / 427 / 428 / 429 depending on host, User-Agent and Referer), so `worker/download-worker.js` resolves the candidates, asks each one for a byte to prove it works, then streams the bytes back with `Range` support.

### Run the worker locally

```bash
npm run worker:dev     # http://127.0.0.1:8787
```

`worker/.dev.vars` holds the local `DOWNLOAD_SECRET`; it is gitignored and the production value is set once with:

```bash
npx wrangler secret put DOWNLOAD_SECRET --config worker/wrangler.toml
```

Point the app at a local worker with `VITE_DOWNLOAD_WORKER=http://127.0.0.1:8787`.

### Deploy the worker

```bash
npm run worker:deploy
```

The worker only serves a URL it signed itself (HMAC over the target, headers, filename and expiry) and only for hosts on its allowlist, so it cannot be used as an open proxy.

### Known limits

- Only files on the allowlisted CDNs are offered; a provider that serves HLS only (`m3u8`) is skipped, because HLS is a stream, not a file.
- Each provider is probed once before it is listed. A hard refusal (`403`/`427`/`428`) drops it; a throttle (`429`), a server error or a timeout still lists it, since the CDN may simply be limiting the Worker while the user's own download works.
- Results are cached at the edge for ten minutes, so repeat visits do not re-probe the CDNs.
- Some CDNs block the Worker's network even when they serve a browser, so the menu can be short or empty for a given title.
- Links expire. That is why the menu says so, and why the Worker signs its own copy rather than reusing the upstream one.

---

## Domain Restrictions

None of the six shipped servers enforces domain whitelisting, so embeds work on any deployment URL. If a live deployment ever shows a domain restriction error, the fastest fix is switching server in the player's server menu, then pinning the one that works for that show.

---

## Project Structure

```
vid-library/
├── api/
│   └── tmdb/[...path].ts  # Serverless TMDB proxy (Vercel)
├── electron/              # Optional desktop shell (ad blocking, popup suppression)
├── public/
│   ├── _redirects         # SPA routing rule for Cloudflare Pages / Netlify
│   └── favicon.svg
├── server/
│   └── tmdbProxy.ts       # Shared proxy logic for the dev server and Vercel
├── worker/
│   ├── download-worker.js # Resolves and streams the real MP4/MKV download links
│   └── wrangler.toml      # Worker config (name, compatibility date)
├── src/
│   ├── components/        # React UI components (Navbar, VideoPlayer, ContinueWatching, MediaCard)
│   ├── pages/             # Route pages (HomePage, MoviePage, TVShowPage, WatchHistoryPage)
│   ├── providers/         # One file per embed server
│   ├── services/          # Catalog, search, metadata, rows and downloads services
│   ├── types/             # TypeScript data models
│   ├── utils/             # LocalStorage, settings and helper utilities
│   ├── App.tsx            # React router definitions
│   └── main.tsx           # Entry point
├── .env.example           # Example environment variables
├── .gitignore             # Git ignore file
├── PROVIDERS.md           # Technical provider specifications
├── README.md              # Documentation & deployment guide
├── vercel.json            # SPA rewrite rules for Vercel
├── package.json           # Dependencies and scripts
└── vite.config.ts         # Vite build configuration
```
