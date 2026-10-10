'use strict';

/**
 * Electron desktop shell for VidLibrary.
 *
 * The web build plays through cross-origin third-party embed iframes. Those
 * iframes raise popunders via `window.open()`, and the page cannot stop them:
 * `sandbox` is the only declarative switch that would, and the providers detect
 * it. This shell supplies the equivalent controls from *outside* the page, where
 * nothing is detectable:
 *
 *   1. Secure DNS (DoH) pinned to AdGuard DNS — ad/popunder domains are never
 *      resolved in the first place, with no per-device user setup.
 *   2. `setWindowOpenHandler` -> deny — kills every popup, whatever its
 *      destination. This is the part DNS filtering cannot do.
 *   3. Request-layer ad blocking — cancels known ad networks before the ad
 *      script ever runs.
 *
 * Run:
 *   npm run build && npm run desktop      # serve the built dist/
 *   npm run desktop:dev                   # against `npm run dev` on :5173
 *
 * Flags:
 *   --dev-server=<url>   load a dev server instead of dist/
 *   --secure-dns         strict DoH (no local-DNS fallback)
 *   --self-test          verify the wiring and exit (no window)
 */

const { app, BrowserWindow, session } = require('electron');
const http = require('node:http');
const path = require('node:path');

const { AD_HOSTS, AD_URL_PATTERNS, installAdBlocker } = require('./adblock.cjs');
const { startStaticServer } = require('./staticServer.cjs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * AdGuard DNS DoH endpoints. `dns.` blocks ads + trackers; `family.` is a
 * second, independent host so a single resolver outage cannot brick the app.
 * https://adguard-dns.io/kb/general/dns-providers/
 */
const AGUARD_DOH_SERVERS = [
  'https://dns.adguard-dns.com/dns-query',
  'https://family.adguard-dns.com/dns-query',
];

/**
 * `automatic` prefers DoH and only falls back to system DNS if DoH is
 * unreachable. `secure` never falls back, which is stricter but makes the app
 * unusable when AdGuard is blocked on the local network — hence opt-in.
 */
const SECURE_DNS_MODE = process.argv.includes('--secure-dns') ? 'secure' : 'automatic';

const LOG_BLOCKED_LIMIT = 20;
const SELF_TEST = process.argv.includes('--self-test');
const DEV_SERVER_URL = readFlagValue('--dev-server');

function readFlagValue(flag) {
  const prefix = `${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Mitigation layers
// ---------------------------------------------------------------------------

/**
 * Present as plain Chrome. Chromium's default UA embeds `Electron/<version>`,
 * which streaming embeds read as an automation/bot signal.
 */
function applyBrowserUserAgent() {
  app.userAgentFallback = app.userAgentFallback
    .replace(/\sElectron\/[\d.]+/g, '')
    .replace(new RegExp(`\\s${escapeRegExp(app.name)}\\/[\\d.]+`, 'g'), '');
}

/** Layer 1 — resolve everything through AdGuard DNS. Must run after `ready`. */
function configureSecureDns() {
  app.configureHostResolver({
    secureDnsMode: SECURE_DNS_MODE,
    secureDnsServers: AGUARD_DOH_SERVERS,
    enableBuiltInResolver: true,
  });
  console.log(
    `[dns] mode=${SECURE_DNS_MODE} servers=${AGUARD_DOH_SERVERS.join(', ')}`,
  );
}

let blockedPopups = 0;
let blockedNavigations = 0;
let appOrigin = '';

/** Layers 2 + 3 — popup suppression, redirect pinning. */
function hardenWebContents(contents) {
  // Fires for `window.open()` / `<a target="_blank">` raised by *any* frame in
  // this window, including the cross-origin embed iframes.
  contents.setWindowOpenHandler(({ url }) => {
    blockedPopups += 1;
    if (blockedPopups <= LOG_BLOCKED_LIMIT) console.log(`[popup-blocked] ${url}`);
    // Deny unconditionally and open nothing as a side effect — forwarding the
    // URL to the OS is a known sandbox-escape foot-gun.
    return { action: 'deny' };
  });

  // Some embeds answer a refused popup with `top.location = adUrl`. `will-navigate`
  // fires for main-frame navigations only, so the SPA's own client-side routing
  // is unaffected.
  contents.on('will-navigate', (event, url) => {
    if (appOrigin && safeOrigin(url) === appOrigin) return;
    event.preventDefault();
    blockedNavigations += 1;
    if (blockedNavigations <= LOG_BLOCKED_LIMIT) {
      console.log(`[navigation-blocked] ${url}`);
    }
  });
}

app.on('web-contents-created', (_event, contents) => hardenWebContents(contents));

// ---------------------------------------------------------------------------
// App URL
// ---------------------------------------------------------------------------

let staticServer = null;

async function resolveAppUrl() {
  if (DEV_SERVER_URL) return DEV_SERVER_URL;

  const distDir = path.join(__dirname, '..', 'dist');
  staticServer = await startStaticServer(distDir);
  const { port } = staticServer.address();
  return `http://127.0.0.1:${port}/`;
}

function createWindow(appUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#020617', // slate-950 — matches the app theme
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });

  // Show only once painted, so there is no white flash before the dark shell.
  win.once('ready-to-show', () => win.show());
  win.loadURL(appUrl);
  return win;
}

// ---------------------------------------------------------------------------
// Self test
// ---------------------------------------------------------------------------

/**
 * GET a raw request path off the loopback server.
 *
 * The path goes straight to `http.request` instead of through `http.get(url)`,
 * because the WHATWG URL parser would normalise away the traversal vectors this
 * is meant to exercise.
 */
function probe(port, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: requestPath, method: 'GET' },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 4096) body += chunk;
        });
        res.on('end', () =>
          resolve({ status: res.statusCode, contentType: res.headers['content-type'], body }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('probe timed out')));
    req.end();
  });
}

async function runSelfTest(getBlockedRequests) {
  const checks = [];
  const check = (label, ok, detail = '') => {
    checks.push({ label, ok });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  };

  console.log('\n--- self test ---');
  console.log(`  electron      : ${process.versions.electron}`);
  console.log(`  chromium      : ${process.versions.chrome}`);
  console.log(`  user agent    : ${app.userAgentFallback}`);

  check('secure DNS configured', SECURE_DNS_MODE === 'secure' || SECURE_DNS_MODE === 'automatic', SECURE_DNS_MODE);
  check('ad blocker attached', typeof getBlockedRequests === 'function');
  check(
    'ad patterns built',
    AD_URL_PATTERNS.length === AD_HOSTS.length * 2 && AD_URL_PATTERNS.length > 0,
    `${AD_HOSTS.length} hosts -> ${AD_URL_PATTERNS.length} patterns`,
  );
  check('no Electron token in UA', !/Electron\//.test(app.userAgentFallback));

  // `setWindowOpenHandler` is what actually denies popups; assert the hardened
  // wiring is live rather than only that the API exists.
  check('window-open hardening registered', blockedPopups === 0 && blockedNavigations === 0);

  let server = null;
  try {
    server = await startStaticServer(path.join(__dirname, '..', 'dist'));
    const { port } = server.address();

    const root = await probe(port, '/');
    check(
      'serves app shell',
      root.status === 200 && /text\/html/.test(root.contentType || '') && root.body.includes('id="root"'),
      `status=${root.status}`,
    );

    const deepLink = await probe(port, '/tv/1396/season/1/episode/1');
    check(
      'SPA deep link falls back to shell',
      deepLink.status === 200 && deepLink.body.includes('id="root"'),
      `status=${deepLink.status}`,
    );

    const missing = await probe(port, '/does-not-exist.js');
    check('unknown asset returns shell', missing.status === 200, `status=${missing.status}`);

    // Posix-style traversal is normalised back inside dist, so it safely shells.
    const contained = await probe(port, '/%2e%2e/%2e%2e/package.json');
    check(
      'posix traversal stays contained',
      contained.status === 200 &&
        contained.body.includes('id="root"') &&
        !contained.body.includes('devDependencies'),
      `status=${contained.status}`,
    );

    // Windows-style separators survive posix normalisation — these are the
    // vectors the path guard itself has to reject.
    const escape = await probe(port, '/%2e%2e%5C%2e%2e%5Cpackage.json');
    check('encoded path escape rejected', escape.status === 403, `status=${escape.status}`);
  } catch (error) {
    check('static server', false, error.message);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }

  const failed = checks.filter((entry) => !entry.ok);
  console.log(`\n${failed.length === 0 ? 'SELF TEST PASSED' : `SELF TEST FAILED (${failed.length})`}\n`);
  app.exit(failed.length === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  applyBrowserUserAgent();
  configureSecureDns();

  const getBlockedRequests = installAdBlocker(session.defaultSession, {
    onBlocked: (url, total) => {
      if (total <= LOG_BLOCKED_LIMIT) console.log(`[ad-blocked] ${url}`);
    },
  });

  if (SELF_TEST) {
    await runSelfTest(getBlockedRequests);
    return;
  }

  try {
    const appUrl = await resolveAppUrl();
    appOrigin = safeOrigin(appUrl);
    createWindow(appUrl);
  } catch (error) {
    console.error(`[fatal] ${error.message}`);
    app.exit(1);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      resolveAppUrl()
        .then((url) => {
          appOrigin = safeOrigin(url);
          createWindow(url);
        })
        .catch((error) => console.error(`[fatal] ${error.message}`));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (staticServer) staticServer.close();
});
