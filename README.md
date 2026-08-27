# Vid Library — Personal Video Streaming Website

A clean, lightweight, publicly accessible web application for browsing movies and TV shows and watching them using **VidRock** and **VidAPI** video embeds. Built as a zero-backend, pure static Single Page Application (SPA) designed for instant deployment to Cloudflare Pages, Vercel, or Netlify.

---

## Key Features

- **Dual Provider Embeds**: Support for **VidRock** (`vidrock.ru`) and **VidAPI** (`vidapi.ru`) with manual provider switching and clear fallback error UI.
- **Deep-Link SPA Routing**: Shareable, direct-accessible URLs:
  - `/` (Catalog, Search, Continue Watching)
  - `/movie/{id}` (Movie player page)
  - `/tv/{id}` (TV show page)
  - `/tv/{id}/season/{season}/episode/{episode}` (Direct episode player page)
- **Subtitle Selection**: Native language selector for **English** (`en`), **Swedish** (`sv`), and **Persian** (`fa`). Subtitle selection reloads the embed with position retention (`resumeAt`) and saves your language preference locally.
- **Next Episode Navigation**: Seamless **Next Episode →** button handling intra-season (`S1E4 -> S1E5`) and inter-season (`S1E10 -> S2E1`) transitions while preserving provider and subtitle preferences.
- **Continue Watching**: Automatically saves playback progress in browser `localStorage` via iframe `PLAYER_EVENT` listeners and presents a "Continue Watching" row on the homepage.
- **Keyboard Shortcuts**: On TV show pages, `←` / `→` jump between episodes.
- **Zero Account & Zero Backend Required**: 100% client-side application. No servers, VPS, databases, analytics, or user registration required.

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.x or higher)
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
├── public/
│   ├── _redirects         # SPA routing rule for Cloudflare Pages / Netlify
│   └── favicon.ico
├── src/
│   ├── components/        # React UI components (Navbar, VideoPlayer, ContinueWatching, MediaCard)
│   ├── pages/             # Route pages (HomePage, MoviePage, TVShowPage)
│   ├── providers/         # VidRock & VidAPI provider abstractions
│   ├── services/          # Catalog & search service
│   ├── types/             # TypeScript data models
│   ├── utils/             # LocalStorage & helper utilities
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
