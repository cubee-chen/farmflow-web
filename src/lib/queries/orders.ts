import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/db/schema';
import type { Order } from '@/lib/db/schema';

export type OrderWithItems = Order & {
  items: { quantity: number; display_name: string }[];
};

const PAGE_SIZE = 50;

function buildWhere(farmerId: string, status: string, q: string, intake: string) {
  return and(
    eq(orders.farmer_id, farmerId),
    status === 'ready_to_ship'
      ? and(
          inArray(orders.status, ['confirmed', 'packing']),
          eq(orders.payment_status, 'paid')
        )
      : status && status !== 'all'
        ? eq(orders.status, status)
        : undefined,
    intake ? eq(orders.intake_mode, intake) : undefined,
    q
      ? or(
          ilike(orders.recipient_name, `%${q}%`),
          ilike(orders.recipient_phone, `%${q}%`)
        )
      : undefined
  );
}

export async function listOrders({
  farmerId,
  status = '',
  q = '',
  intake = '',
  page = 1,
}: {
  farmerId: string;
  status?: string;
  q?: string;
  intake?: string;
  page?: number;
}): Promise<{ orders: OrderWithItems[]; hasMore: boolean }> {
  const where = buildWhere(farmerId, status, q, intake);
  const limit = PAGE_SIZE + 1;
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.created_at))
    .limit(limit)
    .offset(offset);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  if (pageRows.length === 0) return { orders: [], hasMore: false };

  const orderIds = pageRows.map((o) => o.id);
  const itemRows = await db
    .select({
      order_id: orderItems.order_id,
      quantity: orderItems.quantity,
      display_name: products.display_name,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(inArray(orderItems.order_id, orderIds));

  const itemsByOrderId = itemRows.reduce<Record<string, { quantity: number; display_name: string }[]>>(
    (acc, row) => {
      (acc[row.order_id] ??= []).push({
        quantity: row.quantity,
        display_name: row.display_name ?? '',
      });
      return acc;
    },
    {}
  );

  return {
    orders: pageRows.map((o) => ({ ...o, items: itemsByOrderId[o.id] ?? [] })),
    hasMore,
  };
}
