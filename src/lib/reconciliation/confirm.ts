import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  reconciliationMatches,
  orders,
  orderEvents,
} from '@/lib/db/schema';

export interface ConfirmResult {
  confirmedCount: number;
  orderIds: string[];
}

export async function confirmReconciliationBatch(
  batchId: string,
  farmerId: string
): Promise<ConfirmResult> {
  // Verify ownership before opening transaction
  const [batch] = await db
    .select({ id: bankReconciliationBatches.id, status: bankReconciliationBatches.status })
    .from(bankReconciliationBatches)
    .where(
      and(
        eq(bankReconciliationBatches.id, batchId),
        eq(bankReconciliationBatches.farmer_id, farmerId)
      )
    )
    .limit(1);

  if (!batch) throw new Error('NOT_FOUND');
  if (batch.status === 'confirmed') throw new Error('ALREADY_CONFIRMED');

  // Fetch matches to confirm: matched or manual_override with an order assigned
  const matchRows = await db
    .select({
      matchId: reconciliationMatches.id,
      orderId: reconciliationMatches.order_id,
      resolvedBy: reconciliationMatches.resolved_by,
      amount: bankTransactions.amount,
    })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .where(
      and(
        eq(bankTransactions.batch_id, batchId),
        inArray(reconciliationMatches.match_status, ['matched', 'manual_override']),
        isNotNull(reconciliationMatches.order_id)
      )
    );

  const orderIds = matchRows.map((r) => r.orderId as string);

  await db.transaction(async (tx) => {
    const now = new Date();

    // Update each matched order + insert payment event
    for (const row of matchRows) {
      const oid = row.orderId as string;

      await tx
        .update(orders)
        .set({ payment_status: 'paid', paid_at: now, updated_at: now })
        .where(eq(orders.id, oid));

      await tx.insert(orderEvents).values({
        order_id: oid,
        event_type: 'paid',
        payload: {
          amount: row.amount,
          batch_id: batchId,
          matched_via: row.resolvedBy ?? 'auto',
        },
        created_by: 'system',
      });
    }

    // Lock the batch
    await tx
      .update(bankReconciliationBatches)
      .set({ status: 'confirmed', confirmed_at: now })
      .where(eq(bankReconciliationBatches.id, batchId));
  });

  // TODO: dispatch LINE push notifications for each paid order when N-series is implemented

  return { confirmedCount: orderIds.length, orderIds };
}
