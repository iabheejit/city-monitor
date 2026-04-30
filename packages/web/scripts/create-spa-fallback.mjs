import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const indexPath = resolve(distDir, 'index.html');
const notFoundPath = resolve(distDir, '404.html');
const redirectsPath = resolve(distDir, '_redirects');

// Ensure deep links render the SPA on hosts that serve custom 404 pages.
copyFileSync(indexPath, notFoundPath);

// Hosts that support Netlify-style redirects will rewrite all paths to index.
writeFileSync(redirectsPath, '/* /index.html 200\n', 'utf8');

console.log('Generated SPA fallback files: 404.html and _redirects');
