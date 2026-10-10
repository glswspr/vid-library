'use strict';

/**
 * Minimal static file server for the built SPA (`dist/`).
 *
 * The app is a deep-link SPA (`/movie/{id}`, `/tv/{id}/season/{s}/episode/{e}`)
 * that also calls public APIs (TMDB, vidapi.ru). Loading it from `file://` would
 * give every request an opaque origin and break both router deep links and CORS,
 * so the desktop shell serves `dist/` over loopback HTTP instead.
 *
 * No dependencies — plain `node:http` — so it can be exercised by a plain Node
 * smoke test without booting Electron.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/**
 * Map a request path to a file inside `rootDir`, falling back to `index.html`
 * for extension-less SPA routes.
 *
 * @returns {string | null} absolute file path, or null if the path escapes root
 */
function resolveRequestPath(rootDir, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const candidate = path.resolve(rootDir, `.${path.posix.normalize(decoded)}`);
  const relative = path.relative(rootDir, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  // SPA deep link (or unknown asset): hand back the app shell.
  return path.join(rootDir, 'index.html');
}

/**
 * Start the server on a loopback port.
 *
 * @param {string} rootDir directory to serve (usually `<repo>/dist`)
 * @param {{ host?: string, port?: number }} [options]
 * @returns {Promise<http.Server>} listening server (`server.address().port` is real)
 */
function startStaticServer(rootDir, options = {}) {
  const { host = '127.0.0.1', port = 0 } = options;
  const indexFile = path.join(rootDir, 'index.html');

  if (!fs.existsSync(indexFile)) {
    return Promise.reject(
      new Error(
        `No built app found at ${indexFile}.\n` +
          'Run `npm run build` first (or `npm run desktop:dev` against the Vite dev server).',
      ),
    );
  }

  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url || '/', `http://${host}`);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const filePath = resolveRequestPath(rootDir, pathname);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    const isShell = filePath === indexFile;
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      // Never cache the shell — it is what makes deep links resolve.
      'Cache-Control': isShell ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

module.exports = { startStaticServer, resolveRequestPath, contentTypeFor, MIME_TYPES };
