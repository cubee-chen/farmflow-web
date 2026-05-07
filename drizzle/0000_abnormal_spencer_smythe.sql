CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"primary_phone" text NOT NULL,
	"default_name" text,
	"default_address" text,
	"line_display_name" text,
	"notes" text,
	"total_orders" integer DEFAULT 0,
	"total_amount" numeric(10, 2) DEFAULT '0',
	"last_ordered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "farmers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"farm_name" text,
	"phone" text,
	"line_official_id" text,
	"bank_account" text,
	"bank_name" text,
	"default_shipping_provider" text DEFAULT 'tcat',
	"notification_lead_time_hours" integer DEFAULT 24,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"trigger_event" text NOT NULL,
	"template_text" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_number" text,
	"intake_mode" text NOT NULL,
	"raw_text" text,
	"parse_confidence" numeric(3, 2),
	"parse_ambiguities" jsonb,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_address" text,
	"delivery_zip" text,
	"delivery_preference" text,
	"desired_arrival_date" date,
	"ship_date" date,
	"shipping_provider" text,
	"tracking_number" text,
	"payment_method" text DEFAULT 'transfer',
	"payment_status" text DEFAULT 'unpaid',
	"bank_last_5" text,
	"paid_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"notes" text,
	"notified_customer_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"short_aliases" text[],
	"sku" text,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"weight_g" integer,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_farmer_id_primary_phone_idx" ON "customers" USING btree ("farmer_id","primary_phone");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_farmer_id_trigger_event_idx" ON "notification_templates" USING btree ("farmer_id","trigger_event");--> statement-breakpoint
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events" USING btree ("order_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_farmer_id_status_idx" ON "orders" USING btree ("farmer_id","status");--> statement-breakpoint
CREATE INDEX "orders_farmer_id_ship_date_idx" ON "orders" USING btree ("farmer_id","ship_date");--> statement-breakpoint
CREATE INDEX "orders_farmer_id_created_at_idx" ON "orders" USING btree ("farmer_id","created_at");--> statement-breakpoint
CREATE INDEX "products_farmer_id_is_active_idx" ON "products" USING btree ("farmer_id","is_active");