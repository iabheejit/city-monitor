# Static Pages (Legal, Privacy, No-Tracking, Sources) & SEO

## Goal

Add four new pages (Imprint, Privacy, No-Ads-No-Tracking, Sources) and proper per-page `<title>` / OG meta tags.

## Current State

- **Routing**: Single `/:cityId` route + catch-all redirect to `/berlin`. No static page routes.
- **Shell**: `Shell.tsx` depends on `CityProvider` (city context) — can't be used for city-independent pages.
- **SEO**: Static meta tags in `index.html` hardcoded to Berlin. No head management library. Only `document.title` updated client-side.
- **Footer**: External links only (GitHub, World Monitor, OpenWeatherMap, Ko-fi). No internal legal links.
- **i18n**: 4 languages, flat key namespace. No page content keys yet.

## Architecture Decision: OG Tags for Crawlers

Social media crawlers (Facebook, Twitter, LinkedIn) **do not execute JavaScript**. Since this is a Vite SPA deployed as a Render static site, crawlers will always see the default `index.html` meta tags regardless of which route they visit.

**Options:**

| Approach | Crawler support | Complexity | Build impact |
|---|---|---|---|
| A. `react-helmet-async` only | Browser only; crawlers see defaults | Low | None |
| B. A + build-time prerender (`vite-plugin-prerender`) | Full | Medium | Adds Puppeteer to build |
| C. Express serves SPA with route-based meta injection | Full | Medium | Changes deployment arch |

**Decision: Option B** (build-time prerender) — but using a lightweight custom Vite plugin instead of Puppeteer. The plugin reads the built `index.html` as a template, replaces `<title>` and `<meta>` tags for each configured route, and writes the result to `dist/{route}/index.html`. Crawlers get correct OG tags from static HTML; browsers get the full SPA experience via react-helmet-async.

## Plan

### 1. Install `react-helmet-async`

Lightweight head management. Wrap `App` in `<HelmetProvider>`, then use `<Helmet>` in each page to set title + description + OG tags.

### 2. Create `PageShell` layout component

A simplified shell for static (non-dashboard) pages:
- Minimal header: City Monitor logo/name (links to `/`), language switcher, theme toggle
- `<main>` with centered prose container (`max-w-3xl mx-auto prose`)
- Same `Footer` component (updated with legal links)

No city context dependency.

### 3. Create page components

**`/imprint`** — Legal Notice / Impressum
- Adapted from actuallyrelevant.news/imprint for City Monitor
- Author profile card (Odin Mühlenbein, photo, links)
- § 5 DDG information, § 18 Abs. 2 MStV editorial responsibility
- Links to privacy policy + GitHub/license

**`/privacy`** — Privacy Policy
- Adapted from actuallyrelevant.news/privacy for City Monitor
- Key difference: City Monitor has **zero** analytics, **zero** newsletter, **zero** cookies
- Sections: What we collect (nothing client-side), server logs, third-party services table (Render hosting, OpenAI for AI summarization, external data APIs), local storage (theme preference, language), GDPR rights

**`/no-ads-no-tracking`** — No Ads, No Tracking
- Adapted comparison table: City Monitor vs typical city dashboards
- "What we don't do" cards (no ads, no tracking, no cookies, no paywalls)
- Support CTA (Ko-fi link)

**`/:cityId/sources`** — Data Sources
- Per-city list of all external data sources
- Grouped by category (Weather, Transit, Safety, News, etc.)
- Each entry: source name, provider, link to data source, brief description
- City-conditional entries (e.g. Berlin-only sources marked)

### 4. Add routes to `App.tsx`

```
/imprint              → <ImprintPage />
/privacy              → <PrivacyPage />
/no-ads-no-tracking   → <NoTrackingPage />
/:cityId/sources      → <SourcesPage />   (inside CityRoute, needs city context)
```

Static pages wrapped in `PageShell`. Sources page uses existing `Shell` (or `PageShell` + city name in header).

### 5. Update Footer

Add internal links: "Legal Notice" | "Privacy" | "No Tracking" | "Sources"
Sources link is city-aware (uses current city if on dashboard, defaults to `/berlin/sources` on static pages).

### 6. Update `index.html` default meta tags

Make the defaults generic (not Berlin-specific) so crawlers get reasonable fallback:
- `<title>City Monitor</title>`
- `<meta property="og:title" content="City Monitor" />`
- `<meta property="og:description" content="Real-time city dashboard: news, weather, transit, events, and safety." />`

### 7. Add i18n keys

Add translation keys for:
- Page titles and meta descriptions
- Footer link labels
- Page content (at minimum: section headings, table headers, CTA text)
- Content prose can stay in English only initially (legal text is typically not translated)

### 8. Content details

All page content in **English only** (user decision). Hardcoded JSX prose, only nav elements use i18n.

### 9. Build-time SEO plugin

Custom Vite plugin (`vite-plugin-seo.ts`):
- Runs at `closeBundle` (build only, not dev)
- Reads `dist/index.html` as template
- For each configured route: replaces `<title>`, `<meta name="description">`, `<meta property="og:*">` tags
- Writes to `dist/{route}/index.html`
- Configured routes: `/imprint`, `/privacy`, `/no-ads-no-tracking`, `/berlin/sources`, `/hamburg/sources`

## Files to Create/Modify

**New files:**
- `packages/web/src/components/layout/PageShell.tsx`
- `packages/web/src/pages/ImprintPage.tsx`
- `packages/web/src/pages/PrivacyPage.tsx`
- `packages/web/src/pages/NoTrackingPage.tsx`
- `packages/web/src/pages/SourcesPage.tsx`

**Modified files:**
- `packages/web/src/App.tsx` — add routes + HelmetProvider
- `packages/web/src/components/layout/Footer.tsx` — add legal links
- `packages/web/index.html` — genericize default meta tags
- `packages/web/src/i18n/en.json` — add page/footer keys
- `packages/web/src/i18n/de.json` — add page/footer keys
- `packages/web/src/i18n/tr.json` — add page/footer keys
- `packages/web/src/i18n/ar.json` — add page/footer keys
- `packages/web/package.json` — add react-helmet-async dep
