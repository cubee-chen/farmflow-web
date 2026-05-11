CREATE TABLE "bank_reconciliation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"source" text NOT NULL,
	"uploaded_filename" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"tx_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" text NOT NULL,
	"account_last_5" text,
	"memo" text,
	"raw_row" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_transaction_id" uuid NOT NULL,
	"order_id" uuid,
	"match_status" text NOT NULL,
	"confidence" numeric(3, 2),
	"candidates" jsonb,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bank_reconciliation_batches" ADD CONSTRAINT "bank_reconciliation_batches_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_batch_id_bank_reconciliation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."bank_reconciliation_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_reconciliation_batches_farmer_id_idx" ON "bank_reconciliation_batches" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_batch_id_idx" ON "bank_transactions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "reconciliation_matches_bank_tx_id_idx" ON "reconciliation_matches" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "reconciliation_matches_order_id_idx" ON "reconciliation_matches" USING btree ("order_id");