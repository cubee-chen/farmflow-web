ALTER TABLE "orders" DROP CONSTRAINT "orders_order_number_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "orders_farmer_id_order_number_idx" ON "orders" USING btree ("farmer_id","order_number");