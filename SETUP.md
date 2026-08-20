# SETUP — Going Live (Anonymous & Free)

This guide walks you through making your VidLibrary publicly accessible online — **no credit card, no phone number, no real name required**. You only need a throwaway email address.

---

## Deploy with Surge.sh (Recommended)

[Surge.sh](https://surge.sh) is a CLI-based static hosting service — free, no account verification, and it supports Single Page Application routing out of the box.

### One-time setup

#### 1. Build the site

```bash
cd vid-library
npm install
npm run build
```

This creates a `dist/` folder with the production-ready site **and** a `dist/200.html` file (needed for deep-link SPA routing on Surge). The `postbuild` script in `package.json` does this automatically — no extra steps needed.

#### 2. Deploy

```bash
npm run deploy:surge
```

Or manually:

```bash
npx surge dist
```

**First run only:** Surge asks for an **email** and a **password**. Use a throwaway email (ProtonMail, Guerrilla Mail, etc.). No verification code is sent — the account just works.

It then prints your free live URL, e.g.:

```
https://obtainable-tank.surge.sh
```

> **Tip:** Pick your own subdomain for easier updates:
> ```bash
> npx surge dist my-vid-library-2026.surge.sh
> ```

---

### Updating the site later

Whenever you make changes to the code:

```bash
npm run build
npx surge dist --domain my-vid-library-2026.surge.sh
```

Both steps take about 10 seconds. The URL stays the same.

> Or use the convenience script:
> ```bash
> npm run deploy:surge -- --domain my-vid-library-2026.surge.sh
> ```

---

## Alternative: GitHub Pages + Netlify (Less Anonymous)

If you're okay using a GitHub account (still free, no credit card), these providers offer automatic deploys from Git:

| Provider | Key file | How |
|---|---|---|
| **Vercel** | `vercel.json` | Push to GitHub → import repo at [vercel.com](https://vercel.com) |
| **Cloudflare Pages** | `public/_redirects` | Push to GitHub → import at [dash.cloudflare.com](https://dash.cloudflare.com) |
| **Netlify** | `public/_redirects` | Push to GitHub → import at [netlify.com](https://netlify.com), or drag `dist/` into [app.netlify.com/drop](https://app.netlify.com/drop) |

All three are pre-configured. Just connect your repo — build command: `npm run build`, output folder: `dist`.

---

## Alternative: IPFS (Zero Account — Max Anonymity)

IPFS requires no email, no account, no login whatsoever. The site is content-addressed and served through a public gateway.

**Tradeoff:** Deep links (`/movie/tt0120737`, `/tv/tt0944947/season/1/episode/1`) break on IPFS gateways. You'd need to switch the app from `BrowserRouter` to `HashRouter` — changing all URLs to `/#/movie/tt0120737`. Let me know if you want this path and I'll make the switch.

---

## Privacy Notes

- **No analytics.** The app has zero tracking, zero cookies beyond `localStorage`, zero third-party scripts.
- **No server.** All data (watch progress, provider preference) stays in the visitor's own browser. Nothing is sent anywhere.
- **Surge.sh** does not require phone verification, billing info, or real identity. One throwaway email is the only requirement.

---

## VidAPI Domain Whitelisting

Some embeds from VidAPI may restrict playback to whitelisted domains. If the video player shows a "domain not allowed" error after deployment:

1. Go to [vadash.app](https://vadash.app) → **Domains** → **Allowed Sites**
2. Add your Surge URL (e.g. `my-vid-library-2026.surge.sh`)
3. Refresh the page — embeds should work

VidRock generally does not enforce domain restrictions.

---

## Quick Reference

```bash
# Build the site
npm run build

# Deploy (first time — choose a subdomain)
npx surge dist my-cool-name.surge.sh

# Re-deploy (update after code changes)
npm run build && npx surge dist --domain my-cool-name.surge.sh

# Or use the convenience script
npm run deploy:surge -- --domain my-cool-name.surge.sh
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "This site can't be reached" | Surge generates random subdomains — make sure you saved the exact URL it printed |
| Deep link shows blank page | Rebuild: `npm run build` (the `postbuild` step creates `dist/200.html` automatically) |
| Video embed shows "domain not allowed" | Whitelist your domain at [vadash.app](https://vadash.app) → Domains |
| `npx surge` command not found | Run `npm run deploy:surge` instead — it uses the local `npx` cache |
| Search shows no results | The app uses IMDb's suggestion API — it queries `v2.sg.media-imdb.com`. Make sure your network allows it |
