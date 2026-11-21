CREATE TABLE "feedback_status_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"feedback_id" text NOT NULL,
	"status_id" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_statuses" (
	"workspace_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "feedback_statuses_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "feedback_status_workspace_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "feedback_status_changes" ADD CONSTRAINT "feedback_status_changes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_status_changes" ADD CONSTRAINT "feedback_status_changes_item_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback_items"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_status_changes" ADD CONSTRAINT "feedback_status_changes_status_fk" FOREIGN KEY ("workspace_id","status_id") REFERENCES "public"."feedback_statuses"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_statuses" ADD CONSTRAINT "feedback_statuses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_status_changes_item_idx" ON "feedback_status_changes" USING btree ("workspace_id","feedback_id","created_at","id");