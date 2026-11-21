CREATE TABLE "paystack_payments" (
	"reference" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"term_days" integer NOT NULL,
	"checkout_url" text NOT NULL,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "paystack_amount" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "paystack_currency" text DEFAULT 'NGN' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "paystack_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "paystack_payments" ADD CONSTRAINT "paystack_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paystack_payments" ADD CONSTRAINT "paystack_payments_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paystack_payments_workspace_idx" ON "paystack_payments" USING btree ("workspace_id","created_at","reference");