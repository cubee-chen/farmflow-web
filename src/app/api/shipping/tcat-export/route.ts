import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { generateTcatBatchExcel } from '@/lib/shipping/tcat-excel';

const schema = z.object({
  orderIds: z.array(z.string().uuid()),
  shipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  const farmer = await getCurrentFarmer();
  const body = schema.parse(await req.json());
  const { orderIds, shipDate } = body;

  if (orderIds.length === 0) {
    return NextResponse.json({ error: 'No orders selected' }, { status: 400 });
  }

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(inArray(orders.id, orderIds), eq(orders.farmer_id, farmer.id)));

  if (orderRows.length !== orderIds.length) {
    return NextResponse.json({ error: 'Invalid order IDs' }, { status: 403 });
  }

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

  const itemsById = itemRows.reduce<
    Record<string, { quantity: number; display_name: string; weight_g: number | null }[]>
  >((acc, r) => {
    (acc[r.order_id] ??= []).push({
      quantity: r.quantity,
      display_name: r.display_name ?? '',
      weight_g: r.weight_g,
    });
    return acc;
  }, {});

  const excelOrders = orderRows.map((o) => ({
    recipient_name: o.recipient_name,
    recipient_phone: o.recipient_phone,
    recipient_address: o.recipient_address,
    desired_arrival_date: o.desired_arrival_date,
    notes: o.notes,
    payment_method: o.payment_method,
    total_amount: o.total_amount,
    items: itemsById[o.id] ?? [],
  }));

  const buffer = await generateTcatBatchExcel(excelOrders, {
    name: farmer.name,
    phone: farmer.phone,
  });

  if (shipDate) {
    const toUpdate = orderRows.filter((o) => !o.ship_date).map((o) => o.id);
    if (toUpdate.length > 0) {
      await db
        .update(orders)
        .set({ ship_date: shipDate, updated_at: new Date() })
        .where(inArray(orders.id, toUpdate));
    }
  }

  const dateStr = shipDate ? shipDate.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=tcat-export-${dateStr}.xlsx`,
    },
  });
}
