CREATE TABLE "provider_throttle" (
	"provider" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"backoff_until" timestamp with time zone
);