CREATE TABLE "line_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source_user_id" text,
	"raw_payload" jsonb NOT NULL,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "line_webhook_events_farmer_id_created_at_idx" ON "line_webhook_events" USING btree ("farmer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "line_webhook_events_processing_status_idx" ON "line_webhook_events" USING btree ("processing_status");