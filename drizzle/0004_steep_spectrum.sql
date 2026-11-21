ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_workspace_id_unique" UNIQUE("workspace_id","id");
--> statement-breakpoint
CREATE TABLE "feedback_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"feedback_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_votes" (
	"workspace_id" text NOT NULL,
	"feedback_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "feedback_votes_workspace_id_feedback_id_user_id_pk" PRIMARY KEY("workspace_id","feedback_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_item_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback_items"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_item_fk" FOREIGN KEY ("workspace_id","feedback_id") REFERENCES "public"."feedback_items"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_comments_item_created_idx" ON "feedback_comments" USING btree ("workspace_id","feedback_id","created_at","id");
