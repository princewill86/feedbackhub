ALTER TABLE "subscription_plans" ADD COLUMN "product_limit" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "member_limit" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "api_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "widget_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "analytics_enabled" boolean DEFAULT true NOT NULL;