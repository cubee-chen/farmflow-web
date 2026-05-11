import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const farmers = pgTable("farmers", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").unique(),
  name: text("name").notNull(),
  farm_name: text("farm_name"),
  phone: text("phone"),
  line_official_id: text("line_official_id"),
  line_channel_secret: text("line_channel_secret"),
  line_channel_access_token: text("line_channel_access_token"),
  bank_account: text("bank_account"),
  bank_name: text("bank_name"),
  default_shipping_provider: text("default_shipping_provider").default("tcat"),
  notification_lead_time_hours: integer("notification_lead_time_hours").default(24),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Farmer = InferSelectModel<typeof farmers>;
export type NewFarmer = InferInsertModel<typeof farmers>;

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmer_id: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id, { onDelete: "cascade" }),
    display_name: text("display_name").notNull(),
    short_aliases: text("short_aliases").array(),
    sku: text("sku"),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    weight_g: integer("weight_g"),
    is_active: boolean("is_active").default(true),
    sort_order: integer("sort_order").default(0),
    photo_url: text("photo_url"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("products_farmer_id_is_active_idx").on(table.farmer_id, table.is_active),
  ]
);

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmer_id: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id, { onDelete: "cascade" }),
    primary_phone: text("primary_phone").notNull(),
    default_name: text("default_name"),
    default_address: text("default_address"),
    line_display_name: text("line_display_name"),
    line_user_id: text("line_user_id"),
    line_linked_at: timestamp("line_linked_at", { withTimezone: true }),
    notes: text("notes"),
    total_orders: integer("total_orders").default(0),
    total_amount: numeric("total_amount", { precision: 10, scale: 2 }).default("0"),
    last_ordered_at: timestamp("last_ordered_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_farmer_id_primary_phone_idx").on(
      table.farmer_id,
      table.primary_phone
    ),
  ]
);

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmer_id: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id),
    customer_id: uuid("customer_id").references(() => customers.id),
    order_number: text("order_number").unique(),
    intake_mode: text("intake_mode").notNull(),
    raw_text: text("raw_text"),
    parse_confidence: numeric("parse_confidence", { precision: 3, scale: 2 }),
    parse_ambiguities: jsonb("parse_ambiguities"),
    recipient_name: text("recipient_name").notNull(),
    recipient_phone: text("recipient_phone").notNull(),
    recipient_address: text("recipient_address"),
    delivery_zip: text("delivery_zip"),
    delivery_preference: text("delivery_preference"),
    desired_arrival_date: date("desired_arrival_date"),
    ship_date: date("ship_date"),
    shipping_provider: text("shipping_provider"),
    tracking_number: text("tracking_number"),
    payment_method: text("payment_method").default("transfer"),
    payment_status: text("payment_status").default("unpaid"),
    bank_last_5: text("bank_last_5"),
    paid_at: timestamp("paid_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    total_amount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    raw_image_urls: text("raw_image_urls").array(),
    image_quality: text("image_quality"),
    notified_customer_at: timestamp("notified_customer_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("orders_farmer_id_status_idx").on(table.farmer_id, table.status),
    index("orders_farmer_id_ship_date_idx").on(table.farmer_id, table.ship_date),
    index("orders_farmer_id_created_at_idx").on(table.farmer_id, table.created_at),
  ]
);

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_id: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  product_id: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    order_id: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    payload: jsonb("payload"),
    created_by: text("created_by"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("order_events_order_id_created_at_idx").on(
      table.order_id,
      table.created_at.desc()
    ),
  ]
);

export type OrderEvent = InferSelectModel<typeof orderEvents>;
export type NewOrderEvent = InferInsertModel<typeof orderEvents>;

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmer_id: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id, { onDelete: "cascade" }),
    trigger_event: text("trigger_event").notNull(),
    template_text: text("template_text").notNull(),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_templates_farmer_id_trigger_event_idx").on(
      table.farmer_id,
      table.trigger_event
    ),
  ]
);

export type NotificationTemplate = InferSelectModel<typeof notificationTemplates>;
export type NewNotificationTemplate = InferInsertModel<typeof notificationTemplates>;

export const bankReconciliationBatches = pgTable(
  "bank_reconciliation_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmer_id: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id),
    source: text("source").notNull(),
    uploaded_filename: text("uploaded_filename"),
    row_count: integer("row_count").notNull().default(0),
    matched_count: integer("matched_count").notNull().default(0),
    unmatched_count: integer("unmatched_count").notNull().default(0),
    ambiguous_count: integer("ambiguous_count").notNull().default(0),
    status: text("status").notNull().default("draft"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("bank_reconciliation_batches_farmer_id_idx").on(table.farmer_id),
  ]
);

export type BankReconciliationBatch = InferSelectModel<typeof bankReconciliationBatches>;
export type NewBankReconciliationBatch = InferInsertModel<typeof bankReconciliationBatches>;

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batch_id: uuid("batch_id")
      .notNull()
      .references(() => bankReconciliationBatches.id, { onDelete: "cascade" }),
    tx_date: date("tx_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    direction: text("direction").notNull(),
    account_last_5: text("account_last_5"),
    memo: text("memo"),
    raw_row: jsonb("raw_row").notNull(),
  },
  (table) => [
    index("bank_transactions_batch_id_idx").on(table.batch_id),
  ]
);

export type BankTransaction = InferSelectModel<typeof bankTransactions>;
export type NewBankTransaction = InferInsertModel<typeof bankTransactions>;

export const reconciliationMatches = pgTable(
  "reconciliation_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bank_transaction_id: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "cascade" }),
    order_id: uuid("order_id").references(() => orders.id),
    match_status: text("match_status").notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    candidates: jsonb("candidates"),
    resolved_by: text("resolved_by"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("reconciliation_matches_bank_tx_id_idx").on(table.bank_transaction_id),
    index("reconciliation_matches_order_id_idx").on(table.order_id),
  ]
);

export type ReconciliationMatch = InferSelectModel<typeof reconciliationMatches>;
export type NewReconciliationMatch = InferInsertModel<typeof reconciliationMatches>;

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmer_id: uuid("farmer_id")
      .notNull()
      .references(() => farmers.id, { onDelete: "cascade" }),
    order_id: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    trigger_event: text("trigger_event").notNull(),
    channel: text("channel").notNull(),
    recipient_line_user_id: text("recipient_line_user_id"),
    rendered_text: text("rendered_text"),
    status: text("status").notNull().default("queued"),
    error_message: text("error_message"),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("notification_logs_farmer_id_created_at_idx").on(
      table.farmer_id,
      table.created_at.desc()
    ),
    index("notification_logs_order_id_idx").on(table.order_id),
    index("notification_logs_status_idx").on(table.status),
  ]
);

export type NotificationLog = InferSelectModel<typeof notificationLogs>;
export type NewNotificationLog = InferInsertModel<typeof notificationLogs>;
