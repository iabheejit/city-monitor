# Appointments DB Persistence

## Goal

Add PostgreSQL persistence for citizen services (Bürgeramt) appointment data. Currently cache-only — data is lost on server restart until the next Firecrawl scrape (up to 6 hours).

## Pattern

Follow the water levels pattern: single JSONB snapshot row per city, delete-then-insert on each ingestion, DB fallback in the route.

## Changes

1. **`schema.ts`** — Add `appointmentSnapshots` table (cityId, services JSONB, bookingUrl, fetchedAt)
2. **`writes.ts`** — Add `saveAppointments(db, cityId, data)`
3. **`reads.ts`** — Add `loadAppointments(db, cityId)`
4. **`ingest-appointments.ts`** — Accept `db` param, call `saveAppointments` after cache write
5. **`appointments.ts` route** — Add DB fallback: cache miss → DB → empty default
6. **`warm-cache.ts`** — Add appointments to `warmCity` parallel reads
7. **`app.ts`** — Pass `db` to `createAppointmentIngestion`
8. **Migration** — Run `db:push` to create the new table
