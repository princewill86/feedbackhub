CREATE TABLE "feedback_widgets" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"origins" text[] NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"minute" timestamp with time zone,
	"submissions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "feedback_widgets_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "feedback_widgets" ADD CONSTRAINT "feedback_widgets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;