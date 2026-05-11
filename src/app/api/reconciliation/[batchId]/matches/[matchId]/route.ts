import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  reconciliationMatches,
} from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { AuthError } from '@/lib/auth/get-current-farmer';

async function refreshBatchCounts(batchId: string) {
  const rows = await db
    .select({
      status: reconciliationMatches.match_status,
      orderId: reconciliationMatches.order_id,
    })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .where(eq(bankTransactions.batch_id, batchId));

  let matched = 0, unmatched = 0, ambiguous = 0;
  for (const r of rows) {
    if (r.status === 'multi_candidate') {
      ambiguous++;
    } else if ((r.status === 'matched' || r.status === 'manual_override') && r.orderId) {
      matched++;
    } else {
      unmatched++;
    }
  }

  await db
    .update(bankReconciliationBatches)
    .set({ matched_count: matched, unmatched_count: unmatched, ambiguous_count: ambiguous })
    .where(eq(bankReconciliationBatches.id, batchId));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string; matchId: string }> }
) {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { batchId, matchId } = await params;

  // Verify match ownership via batch
  const [owned] = await db
    .select({ id: reconciliationMatches.id })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .innerJoin(
      bankReconciliationBatches,
      eq(bankTransactions.batch_id, bankReconciliationBatches.id)
    )
    .where(
      and(
        eq(reconciliationMatches.id, matchId),
        eq(bankReconciliationBatches.farmer_id, farmer.id),
        eq(bankReconciliationBatches.id, batchId)
      )
    )
    .limit(1);

  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { orderId: string | null };
  const { orderId } = body;

  const newStatus = orderId ? 'manual_override' : 'unmatched';
  await db
    .update(reconciliationMatches)
    .set({
      order_id: orderId,
      match_status: newStatus,
      resolved_by: 'farmer',
      resolved_at: new Date(),
    })
    .where(eq(reconciliationMatches.id, matchId));

  await refreshBatchCounts(batchId);

  return NextResponse.json({ ok: true });
}
