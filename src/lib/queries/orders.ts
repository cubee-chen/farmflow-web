import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/db/schema';
import type { Order } from '@/lib/db/schema';

export type OrderWithItems = Order & {
  items: { quantity: number; display_name: string }[];
};

export interface StatusCounts {
  all: number;
  draft: number;
  confirmed: number;
  ready_to_ship: number;
  packing: number;
  shipped: number;
  completed: number;
}

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

export type SortDirection = 'asc' | 'desc';

export async function listOrders({
  farmerId,
  status = '',
  q = '',
  intake = '',
  page = 1,
  sort = 'desc',
}: {
  farmerId: string;
  status?: string;
  q?: string;
  intake?: string;
  page?: number;
  sort?: SortDirection;
}): Promise<{ orders: OrderWithItems[]; hasMore: boolean }> {
  const where = buildWhere(farmerId, status, q, intake);
  const limit = PAGE_SIZE + 1;
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(sort === 'asc' ? asc(orders.created_at) : desc(orders.created_at))
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

// Per-status counts for the filter chips. `ready_to_ship` is a derived view
// (status confirmed/packing AND payment_status=paid) so we count it explicitly
// rather than relying on a status enum value.
export async function getOrderStatusCounts(farmerId: string): Promise<StatusCounts> {
  const rows = await db
    .select({
      status: orders.status,
      payment_status: orders.payment_status,
      n: sql<number>`cast(count(*) as integer)`,
    })
    .from(orders)
    .where(eq(orders.farmer_id, farmerId))
    .groupBy(orders.status, orders.payment_status);

  const counts: StatusCounts = {
    all: 0,
    draft: 0,
    confirmed: 0,
    ready_to_ship: 0,
    packing: 0,
    shipped: 0,
    completed: 0,
  };

  for (const r of rows) {
    const n = r.n ?? 0;
    counts.all += n;
    if (r.status === 'draft') counts.draft += n;
    else if (r.status === 'confirmed') counts.confirmed += n;
    else if (r.status === 'packing') counts.packing += n;
    else if (r.status === 'shipped') counts.shipped += n;
    else if (r.status === 'completed') counts.completed += n;

    if ((r.status === 'confirmed' || r.status === 'packing') && r.payment_status === 'paid') {
      counts.ready_to_ship += n;
    }
  }

  return counts;
}
