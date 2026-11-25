// Deploy to a different Surge subdomain to avoid domain-based blocking.
//
// Usage:
//   node scripts/deploy-rotate.mjs <subdomain>
//
// Example:
//   node scripts/deploy-rotate.mjs v1d-backup   → deploys to v1d-backup.surge.sh
//
// The new subdomain is printed at the end so you can share it directly.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const subdomain = process.argv[2];
if (!subdomain) {
  console.error('Usage: node scripts/deploy-rotate.mjs <subdomain>');
  console.error('  e.g. node scripts/deploy-rotate.mjs v1d-mirror  →  v1d-mirror.surge.sh');
  process.exit(1);
}

// Make sure it's only the subdomain part
const clean = subdomain.replace(/\.surge\.sh$/i, '');
const domain = `${clean}.surge.sh`;

const root = path.resolve(fileURLToPath(import.meta.url), '../..');

console.log(`Building and deploying to ${domain} ...`);
execSync('npm run build', { cwd: root, stdio: 'inherit' });
execSync(`npx surge dist ${domain}`, { cwd: root, stdio: 'inherit' });

console.log(`\n=== Deployed to: https://${domain} ===`);