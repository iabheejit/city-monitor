import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const indexPath = resolve(distDir, 'index.html');
const notFoundPath = resolve(distDir, '404.html');
const redirectsPath = resolve(distDir, '_redirects');
const cityRoutes = ['berlin', 'hamburg', 'nagpur', 'san-francisco'];

// Ensure deep links render the SPA on hosts that serve custom 404 pages.
copyFileSync(indexPath, notFoundPath);

// Create static city route entry points for hosts without SPA rewrites.
for (const cityId of cityRoutes) {
	const cityDir = resolve(distDir, cityId);
	mkdirSync(cityDir, { recursive: true });
	copyFileSync(indexPath, resolve(cityDir, 'index.html'));
}

// Hosts that support Netlify-style redirects will rewrite all paths to index.
writeFileSync(redirectsPath, '/* /index.html 200\n', 'utf8');

console.log('Generated SPA fallback files: 404.html, _redirects, and city route index files');
