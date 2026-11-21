CREATE TABLE "mail_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "mail_jobs_ready_idx" ON "mail_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "mail_jobs_created_idx" ON "mail_jobs" USING btree ("created_at","id");