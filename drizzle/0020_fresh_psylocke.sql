CREATE TABLE "stripe_billing" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"attempt_id" text NOT NULL,
	"price_id" text NOT NULL,
	"checkout_email" text NOT NULL,
	"checkout_expires_at" timestamp with time zone NOT NULL,
	"customer_id" text,
	"subscription_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_billing_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "stripe_billing_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "stripe_billing" ADD CONSTRAINT "stripe_billing_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_billing" ADD CONSTRAINT "stripe_billing_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;