// Deploy scripts.
//
// The Vercel deploy hook URL ends in a secret token. It is read from the
// environment instead of being embedded here, because package.json is tracked
// in git — a token in it can be read by anyone with repository access and
// used to trigger arbitrary production deploys.
//
// Setup (once per machine):
//   1. Create a .env or .env.local file in the project root (both are
//      gitignored):
//        VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/<project>/<token>
//   2. Run `npm run deploy` as usual.
//
// IMPORTANT: if the hook URL was ever committed to this repo, rotation in the
// Vercel dashboard is the only fix — the old secret remains in git history.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function hookFromEnvFile() {
  // `.env` is the documented file; `.env.local` is what this repo actually
  // uses (it is also the file Vercel CLI creates). Read the first that exists.
  for (const name of ['.env', '.env.local']) {
    const envPath = path.join(root, name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*VERCEL_DEPLOY_HOOK\s*=\s*(.+)\s*$/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const hook = process.env.VERCEL_DEPLOY_HOOK || hookFromEnvFile();

if (!hook) {
  console.error(
    'Missing VERCEL_DEPLOY_HOOK.\n' +
    '  1. Create .env or .env.local in the project root (both gitignored) with:\n' +
    '       VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/<project>/<token>\n' +
    '  2. Re-run `npm run deploy:vercel`.\n' +
    '  Generate the hook at: Vercel dashboard > Project > Settings > Git > Deploy Hooks',
  );
  process.exit(1);
}

const res = await fetch(hook, { method: 'POST' });
if (!res.ok) {
  console.error(`Vercel deploy hook failed: HTTP ${res.status}`);
  process.exit(1);
}

console.log(`Vercel deploy triggered (HTTP ${res.status}). Skipping Surge step is not automatic — run it separately if needed.`);
