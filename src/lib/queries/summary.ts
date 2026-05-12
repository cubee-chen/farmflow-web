import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/db/schema';
import type { Product } from '@/lib/db/schema';

export type ProductSummary = Pick<
  Product,
  'id' | 'display_name' | 'photo_url' | 'weight_g' | 'sort_order'
> & {
  total_qty: number;
  total_weight_kg: number;
};

export type SummaryOrderItem = {
  display_name: string;
  quantity: number;
};

export type SummaryOrder = {
  id: string;
  order_number: string | null;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string | null;
  delivery_zip: string | null;
  delivery_preference: string | null;
  total_amount: string;
  payment_status: string | null;
  items: SummaryOrderItem[];
};

export async function getShippingSummary(
  farmerId: string,
  date: string
): Promise<{ products: ProductSummary[]; orders: SummaryOrder[] }> {
  const [allProducts, dateOrders] = await Promise.all([
    db
      .select({
        id: products.id,
        display_name: products.display_name,
        photo_url: products.photo_url,
        weight_g: products.weight_g,
        sort_order: products.sort_order,
      })
      .from(products)
      .where(and(eq(products.farmer_id, farmerId), eq(products.is_active, true)))
      .orderBy(asc(products.sort_order), asc(products.display_name)),

    db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.farmer_id, farmerId),
          inArray(orders.status, ['confirmed', 'packing']),
          // Show paid-but-no-ship-date orders alongside orders explicitly
          // scheduled for `date`. This way an order moves into the farmer's
          // packing view the moment reconciliation confirms it, even before
          // the Excel export has assigned a ship_date.
          or(eq(orders.ship_date, date), isNull(orders.ship_date))
        )
      )
      .orderBy(
        sql`${orders.delivery_zip} NULLS LAST`,
        asc(orders.created_at)
      ),
  ]);

  if (dateOrders.length === 0) {
    return {
      products: allProducts.map((p) => ({
        ...p,
        sort_order: p.sort_order ?? 0,
        total_qty: 0,
        total_weight_kg: 0,
      })),
      orders: [],
    };
  }

  const orderIds = dateOrders.map((o) => o.id);
  const itemRows = await db
    .select({
      order_id: orderItems.order_id,
      product_id: orderItems.product_id,
      quantity: orderItems.quantity,
      display_name: products.display_name,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(inArray(orderItems.order_id, orderIds));

  // Build per-product totals
  const qtyByProduct = itemRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.product_id] = (acc[r.product_id] ?? 0) + r.quantity;
    return acc;
  }, {});

  // Build items per order
  const itemsByOrder = itemRows.reduce<Record<string, SummaryOrderItem[]>>((acc, r) => {
    (acc[r.order_id] ??= []).push({
      display_name: r.display_name ?? '',
      quantity: r.quantity,
    });
    return acc;
  }, {});

  const productSummaries: ProductSummary[] = allProducts.map((p) => {
    const qty = qtyByProduct[p.id] ?? 0;
    const weightKg = qty * (p.weight_g ?? 0) / 1000;
    return {
      ...p,
      sort_order: p.sort_order ?? 0,
      total_qty: qty,
      total_weight_kg: weightKg,
    };
  });

  const summaryOrders: SummaryOrder[] = dateOrders.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    recipient_name: o.recipient_name,
    recipient_phone: o.recipient_phone,
    recipient_address: o.recipient_address,
    delivery_zip: o.delivery_zip,
    delivery_preference: o.delivery_preference,
    total_amount: o.total_amount,
    payment_status: o.payment_status,
    items: itemsByOrder[o.id] ?? [],
  }));

  return { products: productSummaries, orders: summaryOrders };
}
