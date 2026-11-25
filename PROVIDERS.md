# Embed Provider Documentation

This document describes the endpoints, parameters, resume behaviour and framing
rules of the embed servers the app ships with. Each one was played in a real
browser inside a cross-origin iframe, for a movie and for a TV episode, on
2026-11-25.

---

## Default order

| # | Server | Domain | Resume | Notes |
| :-- | :--- | :--- | :--- | :--- |
| 1 | VidPrime | `vidprime.top` | `startAt` | Started first time for every title tried. |
| 2 | VixSrc | `vixsrc.to` | `startAt` | TMDB or IMDB id. |
| 3 | VidNest | `vidnest.pro` | `t` | The only server that accepts inbound `postMessage` commands. |
| 4 | VidLink | `vidlink.pro` | none | Its own player keeps progress; `startAt` is ignored. |
| 5 | VidSrc | `vidsrc.to` | none | Walks to `vidsrc.sh` and its CDN host before playing. |
| 6 | Mapple | `mappletv.uk` | none | Redirects to `mapple.fun`. |
| 7 | VidZee | `player.vidzee.wtf` | none | Frames and plays; the earlier `X-Frame-Options` block is gone. |
| 8 | VidCore | `vidcore.io` | none | A few titles answer "(555) OOPS" instead of a stream. |
| 9 | Peachify | `peachify.net` | none | `peachify.top` is dead; `.net` is live. |
| 10 | VidAPI | `vaplayer.ru` | none | Needs a one-time gate pass on `vaplayer.ru` before an embed plays. |
| 11 | 111Movies | `111movies.net` | none | Player host shows a Cloudflare check before the stream. |

---

## 1. VidPrime (`https://vidprime.top`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vidprime.top/movie/{tmdbId}` |
| TV | `GET https://vidprime.top/tv/{tmdbId}/{season}/{episode}` |

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `t` / `startAt` | Seconds or `1h5m30s` | Start position. Verified: `startAt=300` starts at 5:00. |
| `autoplay` | `1` | Start when ready; stays muted until the viewer interacts. |
| `theme` | Hex | Accent colour. |
| `episodes` | `1` | TV only. Adds the episode browser and next-episode button. |
| `autonext` | `1` | TV only. Plays the next episode after a countdown. |

---

## 2. VixSrc (`https://vixsrc.to`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vixsrc.to/movie/{id}` |
| TV | `GET https://vixsrc.to/tv/{id}/{season}/{episode}` |

`{id}` may be a TMDB id or an IMDb id.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `startAt` | Seconds | Start position. Verified. |
| `autoplay` | Boolean | Start when ready. |
| `primaryColor` / `secondaryColor` | Hex without `#` | Player colours. |
| `lang` | ISO code | Preferred audio track. |

Events: `PLAYER_EVENT` with `event` in `play`, `pause`, `seeked`, `ended`,
`timeupdate`, and `currentTime`, `duration`, `video_id` in `data`.

---

## 3. VidNest (`https://vidnest.pro`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vidnest.pro/movie/{id}` |
| TV | `GET https://vidnest.pro/tv/{id}/{season}/{episode}` |
| TV, short | `GET https://vidnest.pro/tv/{id}-{season}-{episode}` |

`{id}` may be a TMDB id or an IMDb id.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `t` / `startAt` | Seconds or `1h5m30s` | Start position. Verified. An explicit start beats a saved position. |
| `theme` | Hex | Accent colour. |
| `autoplay` | `1` | Start when ready. |
| `episodes` | `1` | TV only. Episode list and next-episode button. |
| `autonext` | `1` | TV only. Auto-advance with an "Up next" card. |

Events carry `source: 'vidnext-player'`. It also accepts inbound actions
(`play`, `pause`, `seek`, `setVolume`, `mute`, `setTheme`, `enterFullscreen`),
which no other shipped server does.

---

## 4. VidLink (`https://vidlink.pro`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vidlink.pro/movie/{tmdbId}` |
| TV | `GET https://vidlink.pro/tv/{tmdbId}/{season}/{episode}` |
| Anime | `GET https://vidlink.pro/anime/{malId}/{number}/{subOrDub}` |

Parameters: `primaryColor`, `secondaryColor`, `iconColor`, `icons`, `title`,
`poster`, `autoplay`, `nextbutton`, `player=jw`, `sub_file`, `sub_label`,
`fallback_url`. `startAt` is documented but ignored; the player keeps its own
progress. Its CDN host returns 428 for some titles, which is why it is not
first.

---

## 5. VidSrc (`https://vidsrc.to`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vidsrc.to/embed/movie/{id}` |
| TV | `GET https://vidsrc.to/embed/tv/{id}/{season}/{episode}` |

Plays through `vidsrc.sh` and a per-session CDN host. Ad-heavy: the frame
carries its own popup layer, so the server menu is the way out when it stalls.
Verified playing both a movie and a TV episode with subtitles.

---

## 6. Mapple (`https://mappletv.uk`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://mappletv.uk/watch/movie/{tmdbId}` |
| TV | `GET https://mappletv.uk/watch/tv/{tmdbId}/{season}/{episode}` |

Redirects to `mapple.fun`, which plays. Verified movie and TV. A bare HEAD
request gets `403`; a framed browser gets the player.

---

## 7. VidZee (`https://player.vidzee.wtf`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://player.vidzee.wtf/embed/movie/{tmdbId}` |
| TV | `GET https://player.vidzee.wtf/embed/tv/{tmdbId}/{season}/{episode}` |

Verified playing movie and TV in a cross-origin frame. The embed path carries
no `X-Frame-Options`, so it frames fine.

---

## 8. VidCore (`https://vidcore.io`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vidcore.io/movie/{tmdbId}` |
| TV | `GET https://vidcore.io/tv/{tmdbId}/{season}/{episode}` |

The `.org` host also works with an `/embed/` path
(`https://vidcore.org/embed/movie/{id}`) and is kept as a fallback.
A bare request to `vidcore.io` gets `403` from a bot filter, while
a real browser plays, which is why an earlier sweep recorded it as dead.

Parameters: `autoplay`, `theme`, `color`, `lang`, `title`, `poster`,
`disableInfo`, `disableControls`, `showRelated`. Some titles answer
`(555) OOPS! SOMETHING WENT WRONG` instead of a stream.

---

## 9. Peachify (`https://peachify.net`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://peachify.net/movie/{tmdbId}` |
| TV | `GET https://peachify.net/tv/{tmdbId}/{season}/{episode}` |

Numeric TMDB id only. `peachify.top` returns Cloudflare `523`; `.net` is live.
Documents `autoplay` and `startAt` and honours neither, so the app sends no
position. Subtitles are switched inside the player.

---

## 10. VidAPI (`https://vaplayer.ru`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://vaplayer.ru/embed/movie/{id}` |
| TV | `GET https://vaplayer.ru/embed/tv/{id}/{season}/{episode}` |

Accept TMDB or IMDB ids. The embed runs a one-time gate pass and then hands the
frame to a per-session host; the handoff only completes after `vaplayer.ru`
itself has been opened once in that browser. Verified playing a movie once that
pass had happened.

---

## 11. 111Movies (`https://111movies.net`)

| Kind | URL |
| :--- | :--- |
| Movie | `GET https://111movies.net/movie/{tmdbId}` |
| TV | `GET https://111movies.net/tv/{tmdbId}/{season}/{episode}` |

Redirects to the player at `player.vidmario.net`. TMDB id only. The player
shows a Cloudflare check before the stream and shows the title while it waits,
so a viewer can pass it with one click. It never posts an error, so the app's
automatic fallback cannot detect it and the server arrows are the way out.

---

## Servers removed on 2026-11-26

| Server | Last known domain | Why it was dropped |
| :--- | :--- | :--- |
| VidRock | `vidrock.ru` | The apex frames an ad page (`vinniebags.com/go/...`). `vidrock.to` is the live mirror and is not in this list because a mirror can move again; add it manually if wanted. |
| Videasy | `player.videasy.to` | Domain no longer resolves. The service announced shutdown for 2026-09-15. |
| StreamX | `embed.streamxtv.tech` | Domain no longer resolves. |

---

## Networks with filtering (e.g. Iran)

Iran's border gateway allows DNS (UDP/53), HTTP (80/TCP) and HTTPS (443/TCP),
inspects the TLS SNI, and drops UDP wholesale. An embed iframe therefore loads
over HTTPS like any other page; what decides its fate is whether that domain's
SNI is on the blocklist.

Most of the shipped servers sit behind Cloudflare, whose ranges are partly
whitelisted because many Iranian sites use them. Users can reorder servers in
**Settings**, and the per-show pin keeps a working choice for one show.

If no server loads, the ISP is inspecting HTTPS traffic, and the answer is a
tunnel rather than another domain: VLESS/Reality, a WebSocket tunnel, or
Hysteria 2 with obfuscation.

## Architectural notes

1. **Player control**: only VidNest accepts inbound `postMessage` commands. The
   others are driven by their own controls, and the app passes a resume position
   through the provider's query parameter where that works.
2. **No secrets**: no provider needs a key or an account, so the app stays a
   client-side application.
3. **Fallback**: the arrows walk the order set in Settings, a failed server
   falls back automatically, and a server can be pinned for one show.
4. **Silent stalls**: a server that shows a challenge or an error inside its own
   frame posts nothing the app can read. The arrows are the reliable escape.
