# Security Hardening

Add missing security headers, restrict CORS, add rate limiting, and validate inputs.

## Changes

### 1. Security headers — `packages/server/src/app.ts`

Add `helmet` middleware. This sets X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, and other security headers automatically.

```
npm install helmet  (in packages/server)
```

### 2. CORS origin restriction — `packages/server/src/app.ts`

Replace `app.use(cors())` with explicit origin allowlist:
- Production: `https://citymonitor.app`
- Development: `http://localhost:5173`
- Read from `ALLOWED_ORIGINS` env var (comma-separated), falling back to the production URL.

### 3. Rate limiting — `packages/server/src/app.ts`

Add `express-rate-limit` middleware:
- Global: 100 requests/minute per IP
- Bootstrap endpoint: 10 requests/minute per IP (heavy payload)

```
npm install express-rate-limit  (in packages/server)
```

### 4. Input validation on city parameter — `packages/server/src/lib/city-config.ts` or middleware

Create a `validateCity` middleware that:
- Checks `req.params.city` matches `/^[a-z][a-z0-9-]{0,30}$/`
- Returns 400 if invalid format (before hitting `getCityConfig`)
- Returns 404 if valid format but unknown city

Apply to all `/:city/*` routes.

### 5. External API response validation — cron jobs

Add Zod schemas for the major external APIs and validate responses before processing:
- Open-Meteo weather response
- WAQI air quality response
- VBB transit response
- VIZ construction response
- PEGELONLINE water levels response

This prevents malformed upstream data from corrupting the cache/DB. Use the existing Zod dependency.

### Decision: Rate limit storage

Use **in-memory** rate limiting. Single-instance Render deployment doesn't need Redis. Revisit if scaling to multiple instances.

## Testing

- Unit test: CORS rejects unauthorized origins
- Unit test: rate limiter returns 429 after threshold
- Unit test: city param validation rejects invalid inputs
- Unit test: Zod schemas reject malformed API responses

## Scope

- 2 new dependencies (helmet, express-rate-limit)
- 5-8 files modified
- No migration
