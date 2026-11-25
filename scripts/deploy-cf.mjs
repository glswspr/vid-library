// Deploy the built dist/ to Cloudflare Pages via wrangler.
//
// Reads the project name from an optional CLOUDFLARE_PROJECT_NAME env var;
// defaults to the package's name field.
//
// Setup (once):
//   1. `npm install -g wrangler` or `npx wrangler`
//   2. `wrangler login` (authenticate with Cloudflare)
//   3. `wrangler pages project create vid-library --production-branch main`
//      (one-time project setup — creates the Cloudflare Pages project)
//   4. Run `npm run deploy:cf` to deploy.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const projectName = process.env.CLOUDFLARE_PROJECT_NAME || pkg.name || 'vid-library';

console.log(`Deploying to Cloudflare Pages project: ${projectName}`);
execSync(`npx wrangler pages deploy dist/ --project-name ${projectName}`, {
  cwd: root,
  stdio: 'inherit',
});