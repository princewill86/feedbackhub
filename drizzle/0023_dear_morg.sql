ALTER TABLE "paystack_payments" ADD COLUMN "provider" text DEFAULT 'paystack' NOT NULL;--> statement-breakpoint
ALTER TABLE "paystack_payments" ADD COLUMN "invoice_id" text;--> statement-breakpoint
ALTER TABLE "paystack_payments" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "bitcoin_amount" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "bitcoin_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "paystack_payments" ADD CONSTRAINT "paystack_payments_invoice_id_unique" UNIQUE("invoice_id");