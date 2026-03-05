-- Consolidate 21 snapshot tables into 1 unified "snapshots" table.
-- No data migration: cron jobs repopulate within hours.

CREATE TABLE IF NOT EXISTS "snapshots" (
  "id" serial PRIMARY KEY NOT NULL,
  "city_id" text NOT NULL,
  "type" text NOT NULL,
  "data" jsonb NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_city_type_fetched_idx" ON "snapshots" USING btree ("city_id","type","fetched_at");
--> statement-breakpoint
DROP TABLE IF EXISTS "weather_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "water_level_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "appointment_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "budget_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "construction_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "traffic_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "pharmacy_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "aed_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "social_atlas_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "wastewater_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "bathing_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "labor_market_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "population_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "feuerwehr_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "pollen_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "noise_sensor_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "council_meeting_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "transit_disruptions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "air_quality_grid" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "nina_warnings" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "political_districts" CASCADE;
