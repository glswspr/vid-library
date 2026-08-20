/**
 * Post-build step: copy the standalone `lite/` folder (old Android TV
 * version) into the production output at `dist/lite/` so a single deploy
 * ships both the modern app and the legacy-compatible version.
 *
 * Old TV users browse to:  <site-root>/lite/
 *
 * NOTE: named `.cjs` because this package is ESM ("type": "module").
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'lite');
const dest = path.join(__dirname, '..', 'dist', 'lite');

if (!fs.existsSync(src)) {
  console.error('[copy-lite] lite/ folder not found, skipping.');
  process.exit(0);
}

fs.cpSync(src, dest, { recursive: true });
console.log('[copy-lite] Copied lite/ -> dist/lite/');
