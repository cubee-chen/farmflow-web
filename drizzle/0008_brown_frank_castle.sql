CREATE TABLE "pending_text_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"source_user_id" text NOT NULL,
	"texts" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"line_message_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"first_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_order_id" uuid,
	"processing_error" text
);
--> statement-breakpoint
ALTER TABLE "pending_text_groups" ADD CONSTRAINT "pending_text_groups_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_text_groups" ADD CONSTRAINT "pending_text_groups_processed_order_id_orders_id_fk" FOREIGN KEY ("processed_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_text_groups_active_idx" ON "pending_text_groups" USING btree ("farmer_id","source_user_id") WHERE status = 'pending';