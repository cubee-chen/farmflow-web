import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, orderEvents, orders } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { dispatchNotification } from '@/lib/notify/dispatch';

const schema = z.object({
  orderIds: z.array(z.string().uuid()),
  status: z.enum(['draft', 'confirmed', 'packing', 'shipped', 'completed']),
  dispatch: z.boolean().optional(),
});

const STATUS_TO_EVENT: Record<string, string> = {
  confirmed: 'confirmed',
  packing: 'packing',
  shipped: 'shipped',
  completed: 'completed',
};

export async function POST(req: NextRequest) {
  const farmer = await getCurrentFarmer();
  const { orderIds, status, dispatch: shouldDispatch } = schema.parse(await req.json());

  if (orderIds.length === 0) return NextResponse.json({ updated: 0 });

  const now = new Date();

  // Apply update + event log in a single transaction so the audit trail
  // never diverges from orders.status.
  const updatedOrderIds = await db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ status, updated_at: now })
      .where(and(inArray(orders.id, orderIds), eq(orders.farmer_id, farmer.id)))
      .returning({ id: orders.id });

    const eventType = STATUS_TO_EVENT[status];
    if (eventType && updated.length > 0) {
      await tx.insert(orderEvents).values(
        updated.map((o) => ({
          order_id: o.id,
          event_type: eventType,
          payload: { bulk: true },
          created_by: 'farmer',
        }))
      );
    }

    return updated.map((o) => o.id);
  });

  // Fire notifications outside the transaction. Only 'shipped' currently has a
  // bulk trigger from the UI; 'confirmed'/'paid' are sent from their own
  // single-order entrypoints (intake confirm, reconciliation confirm).
  let dispatched = 0;
  let skippedNoLine = 0;
  if (shouldDispatch && status === 'shipped' && updatedOrderIds.length > 0) {
    // Pre-compute which updated orders have a LINE-bound customer so the
    // toast can show a clear breakdown instead of just "已推播 0 則".
    const lineBoundRows = await db
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(customers, eq(orders.customer_id, customers.id))
      .where(and(inArray(orders.id, updatedOrderIds), isNotNull(customers.line_user_id)));
    const lineBoundSet = new Set(lineBoundRows.map((r) => r.id));
    skippedNoLine = updatedOrderIds.length - lineBoundSet.size;

    for (const orderId of updatedOrderIds) {
      if (!lineBoundSet.has(orderId)) continue;
      try {
        const result = await dispatchNotification({ orderId, triggerEvent: 'shipped' });
        if (result.status === 'sent') dispatched++;
      } catch (err) {
        console.error('[bulk-status] dispatch failed for', orderId, err);
      }
    }
  }

  return NextResponse.json({
    updated: updatedOrderIds.length,
    dispatched,
    skippedNoLine,
  });
}
