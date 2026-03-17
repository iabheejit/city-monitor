# Plan: Add Content-Security-Policy Headers for Static Frontend

**Type:** feature
**Complexity:** simple
**Date:** 2026-03-16

## Goal

Add a Content-Security-Policy (CSP) header to the static frontend on Render.com via `render.yaml` headers configuration. This hardens the SPA against XSS and injection attacks without affecting the API server (which already uses `helmet()` with CSP disabled).

## Background

The frontend is a static SPA served by Render's static site hosting. Render supports per-path response headers in `render.yaml`. The API server proxies through `/api/*` rewrites, so the CSP only applies to the HTML/JS/CSS served by the static site.

## Research: External Origins Required

Analysis of the frontend codebase reveals these external origins:

| Category | Origins | Used By |
|---|---|---|
| Map style JSON | `https://basemaps.cartocdn.com` | MapLibre GL (CARTO basemaps) |
| Map tiles | `https://*.basemaps.cartocdn.com` | CARTO raster tiles (subdomains a-d) |
| WMS tiles (Berlin) | `https://gdi.berlin.de` | Rent map overlay, noise map overlay |
| WMS tiles (Hamburg) | `https://geodienste.hamburg.de` | Noise map overlay |
| Analytics script | `https://scripts.simpleanalyticscdn.com` | Simple Analytics (`<script>` in index.html) |
| Analytics beacon | `https://queue.simpleanalyticscdn.com` | Simple Analytics data reporting |
| Avatar image | `https://avatars.githubusercontent.com` | Imprint page (`<img>` via github.com redirect) |
| OG images | `https://citymonitor.app` | Open Graph meta tags (self-referencing) |

Additional CSP considerations:
- **Inline script** in `index.html` (CARTO style preload) requires `'unsafe-inline'` for `script-src` or a nonce/hash. Since Render static sites cannot inject nonces, `'unsafe-inline'` is needed alongside the analytics CDN.
- **Tailwind v4** uses inline styles, requiring `'unsafe-inline'` in `style-src`.
- **MapLibre GL** uses Web Workers via `blob:` URLs for GeoJSON parsing.
- **Vite** generates hashed JS/CSS in `/assets/` served from `'self'`.
- **`data:` URIs** are used by MapLibre for canvas-rendered icons.

## Implementation

### File: `render.yaml`

Add a single CSP header under the existing `headers:` block for the static frontend service. The header applies to `/*` (all paths). Render merges multiple headers for the same path.

**CSP directives:**

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://scripts.simpleanalyticscdn.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://gdi.berlin.de https://geodienste.hamburg.de https://avatars.githubusercontent.com;
font-src 'self';
connect-src 'self' https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://gdi.berlin.de https://geodienste.hamburg.de https://queue.simpleanalyticscdn.com;
worker-src 'self' blob:;
child-src 'self' blob:;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

**Directive rationale:**

- `default-src 'self'` -- restrictive baseline, only allow same-origin by default.
- `script-src` -- `'self'` for Vite bundles, `'unsafe-inline'` for the theme-detection script in index.html, `https://scripts.simpleanalyticscdn.com` for analytics.
- `style-src` -- `'self'` for CSS files, `'unsafe-inline'` for Tailwind's inline styles and MapLibre's dynamic style injection.
- `img-src` -- `'self'` for local assets/favicons, `data:` for MapLibre canvas icons, `blob:` for MapLibre-generated images, CARTO domains for map tiles, WMS domains for overlay tiles, GitHub avatars for imprint page.
- `font-src 'self'` -- no external fonts used.
- `connect-src` -- `'self'` for API calls (proxied via `/api/*`), CARTO for style JSON fetch, WMS domains for tile fetches, Simple Analytics beacon endpoint.
- `worker-src 'self' blob:` -- MapLibre GL uses blob: workers for GeoJSON processing.
- `child-src 'self' blob:` -- same reasoning as worker-src (some browsers check child-src for workers).
- `frame-src 'none'` -- no iframes used.
- `object-src 'none'` -- no plugins/embeds.
- `base-uri 'self'` -- prevent base tag injection.
- `form-action 'self'` -- no external form submissions.

### Exact render.yaml change

Add a new header entry after the existing Cache-Control headers, under the `city-monitor-web` service's `headers:` list:

```yaml
      - path: /*
        name: Content-Security-Policy
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://scripts.simpleanalyticscdn.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://gdi.berlin.de https://geodienste.hamburg.de https://avatars.githubusercontent.com; font-src 'self'; connect-src 'self' https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://gdi.berlin.de https://geodienste.hamburg.de https://queue.simpleanalyticscdn.com; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
```

## Testing

1. Deploy to Render (or test with Render preview if available).
2. Open the site and verify in browser DevTools > Network that no CSP violations appear in the Console.
3. Verify map loads (CARTO tiles, overlays).
4. Verify imprint page avatar loads.
5. Verify Simple Analytics script loads.
6. Check response headers with `curl -I https://citymonitor.app/` to confirm the CSP header is present.

## Alternatives Considered

1. **Nonce-based script-src instead of `'unsafe-inline'`**: Render static sites serve pre-built HTML and cannot inject per-request nonces. Would require moving to a dynamic server or Cloudflare Workers. Not worth the complexity for a single inline script that only does theme detection. Chose `'unsafe-inline'` as the pragmatic option.

2. **Hash-based script-src**: Could compute a SHA-256 hash of the inline script. However, the inline script may change across builds, and Render YAML is not generated per-build. This would be fragile. Rejected in favor of `'unsafe-inline'`.

3. **Report-Only mode first**: Could use `Content-Security-Policy-Report-Only` initially to catch violations without breaking the site. This is a good idea for rollout but adds complexity (need a reporting endpoint). The policy has been carefully audited against the codebase, so going directly to enforcement is acceptable. If issues arise, can temporarily switch to report-only.

4. **Moving the inline script to an external file**: Would eliminate the need for `'unsafe-inline'` in script-src. However, the inline script exists for performance (runs before any external JS loads to prevent FOUC). The tradeoff isn't worth it -- `'unsafe-inline'` with a restricted domain allowlist is still a strong policy.

## Files Changed

1. `render.yaml` -- add CSP header entry (1 line addition)
2. `.context/deployment.md` -- document CSP header in the Static Frontend section

## Out of Scope

- API server CSP (not needed for JSON-only responses, helmet already handles other security headers)
- Permissions-Policy header (could be a separate follow-up)
- CSP reporting endpoint
