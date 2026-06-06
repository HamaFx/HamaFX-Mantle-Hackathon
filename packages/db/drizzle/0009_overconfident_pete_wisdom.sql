CREATE TABLE "onchain_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"signal_type" text NOT NULL,
	"asset" text NOT NULL,
	"direction" text NOT NULL,
	"confidence" integer NOT NULL,
	"committee_grade" text,
	"go_no_go" text,
	"summary" text NOT NULL,
	"full_analysis" text,
	"tx_hash" text,
	"onchain_signal_id" integer,
	"explorer_url" text,
	"trigger_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source" text NOT NULL
);
