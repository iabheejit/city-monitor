CREATE TABLE "population_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"geojson" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "population_city_idx" ON "population_snapshots" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_city_hash_idx" ON "events" USING btree ("city_id","hash");--> statement-breakpoint
CREATE INDEX "news_city_published_idx" ON "news_items" USING btree ("city_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "news_city_hash_idx" ON "news_items" USING btree ("city_id","hash");--> statement-breakpoint
CREATE UNIQUE INDEX "nina_city_warning_version_idx" ON "nina_warnings" USING btree ("city_id","warning_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "safety_city_hash_idx" ON "safety_reports" USING btree ("city_id","hash");