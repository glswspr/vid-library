'use strict';

/**
 * Ad / popunder domain blocking for the Electron desktop shell.
 *
 * WHY THIS LAYER EXISTS
 * ---------------------
 * The embed iframes in `src/components/VideoPlayer.tsx` are cross-origin, so the
 * page itself cannot stop their `window.open()` calls. `sandbox` would, but the
 * providers detect it. Two layers in this shell replace it:
 *
 *   1. `setWindowOpenHandler` -> { action: 'deny' }  (see main.cjs)
 *      Kills *every* popup, whatever its destination, invisibly to the provider.
 *   2. This module.
 *      Cancels requests to known ad/popunder networks before they leave the
 *      browser. This matters in addition to DNS filtering because a DNS-blocked
 *      name still resolves to an error page and the popup tab still opens —
 *      blocking at the request layer means the ad script never runs at all.
 *
 * The list below is deliberately limited to domains that are unambiguously ad
 * networks. Anything that a legitimate player embed needs (googleapis.com,
 * gstatic.com, jsdelivr.net, unpkg.com, cloudflare.com) is intentionally absent
 * — blocking those is a known way to break playback.
 */

const AD_HOSTS = [
  // --- Google advertising & analytics ---
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  '2mdn.net',
  'google-analytics.com',
  'googletagmanager.com',

  // --- Popunder / pop-up specialists (the usual source of these popups) ---
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'propellerpops.com',
  'onclickalgo.com',
  'onclickads.net',
  'adcash.com',
  'adsterra.com',
  'highperformanceformat.com',
  'profitableratecpm.com',
  'monetag.com',
  'clickadu.com',
  'hilltopads.net',
  'zeropark.com',
  'adnium.com',
  'kadam.net',
  'galaksion.com',

  // --- Adult ad networks (also heavy popunder users) ---
  'exoclick.com',
  'exosrv.com',
  'realsrv.com',
  'juicyads.com',
  'trafficjunky.net',

  // --- Programmatic / display ad exchanges ---
  'adnxs.com',
  'amazon-adsystem.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'revcontent.com',
  'mgid.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'adsrvr.org',
  'casalemedia.com',
  'smartadserver.com',
  'yieldmo.com',
  'sovrn.com',
  'adform.net',
  'teads.tv',
  'sharethrough.com',
  'spotxchange.com',
];

/**
 * Chromium match patterns covering a host and all of its subdomains.
 * @param {string[]} hosts
 * @returns {string[]}
 */
function toUrlPatterns(hosts) {
  return hosts.flatMap((host) => [`*://${host}/*`, `*://*.${host}/*`]);
}

const AD_URL_PATTERNS = toUrlPatterns(AD_HOSTS);

/**
 * Attach the request-layer ad blocker to a session.
 *
 * Note: Electron keeps only the LAST listener per `webRequest` event, so this
 * must be called exactly once per session.
 *
 * @param {import('electron').Session} partitionSession
 * @param {{ onBlocked?: (url: string, total: number) => void }} [hooks]
 * @returns {() => number} getter returning the number of blocked requests so far
 */
function installAdBlocker(partitionSession, hooks = {}) {
  const { onBlocked } = hooks;
  let blockedCount = 0;

  partitionSession.webRequest.onBeforeRequest(
    { urls: AD_URL_PATTERNS },
    (details, callback) => {
      blockedCount += 1;
      if (onBlocked) {
        try {
          onBlocked(details.url, blockedCount);
        } catch {
          /* logging must never break request handling */
        }
      }
      callback({ cancel: true });
    },
  );

  return () => blockedCount;
}

module.exports = { AD_HOSTS, AD_URL_PATTERNS, toUrlPatterns, installAdBlocker };
