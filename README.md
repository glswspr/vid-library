# Vid Library — Personal Video Streaming Website

A clean, lightweight, publicly accessible web application for browsing movies and TV shows and watching them through third-party video embeds. Built as a pure client-side Single Page Application (SPA) that deploys to Cloudflare Pages, Vercel, or Netlify.

---

## Key Features

- **Ten embed servers**: VidRock, VidAPI, Videasy, Peachify, VidSrc, VidCore, VidZee, Mapple, 111Movies and StreamX, with manual switching, an editable fallback order, and automatic fallback when a server fails.
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
- [Node.js](https://nodejs.org/) `^20.19` or `>=22.12` (the floor Vite 8 requires)
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
   *(Note: No API keys are required for the app to function. VidAPI public APIs provide built-in metadata catalog fallback out-of-the-box).*

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

## VidAPI Domain Whitelisting (Note)

VidAPI supports domain whitelisting for player embeds.
- Standard public embeds work across open domains without restrictions.
- If VidAPI displays a domain restriction error on your live deployment URL, log in to `https://vadash.app/`, go to **Domains → Allowed Sites**, and add your deployment domain (e.g. `vid-library.pages.dev` or your custom domain).

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
├── src/
│   ├── components/        # React UI components (Navbar, VideoPlayer, ContinueWatching, MediaCard)
│   ├── pages/             # Route pages (HomePage, MoviePage, TVShowPage, WatchHistoryPage)
│   ├── providers/         # One file per embed server
│   ├── services/          # Catalog, search, metadata and row services
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
