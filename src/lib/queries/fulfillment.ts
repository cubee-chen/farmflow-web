import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/db/schema';
import type { Order } from '@/lib/db/schema';

export type FulfillmentItem = {
  quantity: number;
  display_name: string;
  weight_g: number | null;
};

export type FulfillmentOrder = Order & {
  items: FulfillmentItem[];
};

export type FulfillmentStage = 'todo' | 'packing' | 'all';

// 'todo'    — confirmed (post-recon, awaiting Excel download)
// 'packing' — Excel downloaded, awaiting handoff to courier
// 'all'     — both, optionally including unpaid (for the "include unpaid" toggle)
export async function listFulfillmentOrders({
  farmerId,
  stage = 'todo',
  includeUnpaid = false,
}: {
  farmerId: string;
  stage?: FulfillmentStage;
  includeUnpaid?: boolean;
}): Promise<FulfillmentOrder[]> {
  const statusFilter =
    stage === 'packing'
      ? eq(orders.status, 'packing')
      : stage === 'all'
        ? inArray(orders.status, ['confirmed', 'packing'])
        : eq(orders.status, 'confirmed');

  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.farmer_id, farmerId),
        statusFilter,
        includeUnpaid ? undefined : eq(orders.payment_status, 'paid')
      )
    )
    .orderBy(orders.created_at);

  if (rows.length === 0) return [];

  const orderIds = rows.map((o) => o.id);
  const itemRows = await db
    .select({
      order_id: orderItems.order_id,
      quantity: orderItems.quantity,
      display_name: products.display_name,
      weight_g: products.weight_g,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(inArray(orderItems.order_id, orderIds));

  const byId = itemRows.reduce<Record<string, FulfillmentItem[]>>((acc, r) => {
    (acc[r.order_id] ??= []).push({
      quantity: r.quantity,
      display_name: r.display_name ?? '',
      weight_g: r.weight_g,
    });
    return acc;
  }, {});

  return rows.map((o) => ({ ...o, items: byId[o.id] ?? [] }));
}
