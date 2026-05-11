CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"order_id" uuid,
	"trigger_event" text NOT NULL,
	"channel" text NOT NULL,
	"recipient_line_user_id" text,
	"rendered_text" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "line_user_id" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "line_linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "farmers" ADD COLUMN "line_channel_secret" text;--> statement-breakpoint
ALTER TABLE "farmers" ADD COLUMN "line_channel_access_token" text;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_logs_farmer_id_created_at_idx" ON "notification_logs" USING btree ("farmer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_logs_order_id_idx" ON "notification_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "notification_logs_status_idx" ON "notification_logs" USING btree ("status");