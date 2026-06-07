CREATE TABLE "onchain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_type" text NOT NULL,
	"token" text NOT NULL,
	"from_address" text,
	"to_address" text,
	"value_human" text,
	"value_usd" numeric,
	"tx_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"detected_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onchain_events" ADD CONSTRAINT "onchain_events_tx_hash_unique" UNIQUE("tx_hash");
--> statement-breakpoint
CREATE INDEX "idx_onchain_events_detected" ON "onchain_events" ("detected_at");
--> statement-breakpoint
CREATE INDEX "idx_onchain_events_type" ON "onchain_events" ("event_type");
--> statement-breakpoint
CREATE TABLE "job_locks" (
	"job_name" text PRIMARY KEY NOT NULL,
	"locked_at" timestamptz DEFAULT now() NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"runner_pid" integer,
	"runner_host" text
);
--> statement-breakpoint
CREATE INDEX "job_locks_expires_at_idx" ON "job_locks" ("expires_at");
