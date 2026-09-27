// Copies only the files the browser needs into dist/, so tests, SQL and docs are never served.
// Run: node scripts/build.mjs   Deploy: npx wrangler pages deploy dist --project-name murph-in-progress --branch main
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const files = ['index.html', 'style.css', 'config.js', 'model.js', 'store.js', 'sync.js', 'app.js', 'sw.js', 'manifest.webmanifest', '_headers', 'icons', 'vendor'];
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const f of files) cpSync(join(root, f), join(dist, f), { recursive: true });
console.log(`dist/ ready: ${files.join(', ')}`);
