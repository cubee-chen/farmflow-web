import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  reconciliationMatches,
  orders,
} from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { AuthError } from '@/lib/auth/get-current-farmer';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { batchId } = await params;

  const [batch] = await db
    .select()
    .from(bankReconciliationBatches)
    .where(
      and(
        eq(bankReconciliationBatches.id, batchId),
        eq(bankReconciliationBatches.farmer_id, farmer.id)
      )
    )
    .limit(1);

  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const matchRows = await db
    .select({
      matchId: reconciliationMatches.id,
      matchStatus: reconciliationMatches.match_status,
      matchConfidence: reconciliationMatches.confidence,
      matchCandidates: reconciliationMatches.candidates,
      matchOrderId: reconciliationMatches.order_id,
      matchResolvedBy: reconciliationMatches.resolved_by,
      txId: bankTransactions.id,
      txDate: bankTransactions.tx_date,
      txAmount: bankTransactions.amount,
      txAccountLast5: bankTransactions.account_last_5,
      txMemo: bankTransactions.memo,
      orderNumber: orders.order_number,
      orderRecipientName: orders.recipient_name,
      orderTotalAmount: orders.total_amount,
    })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .leftJoin(orders, eq(reconciliationMatches.order_id, orders.id))
    .where(eq(bankTransactions.batch_id, batchId))
    .orderBy(asc(bankTransactions.tx_date), asc(reconciliationMatches.created_at));

  // Collect all candidate order IDs from the jsonb arrays
  const allCandidateIds = [
    ...new Set(
      matchRows.flatMap((r) => {
        const c = r.matchCandidates;
        return Array.isArray(c) ? (c as string[]) : [];
      })
    ),
  ];

  let candidateOrders: { id: string; orderNumber: string | null; recipientName: string; totalAmount: string }[] = [];
  if (allCandidateIds.length > 0) {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.order_number,
        recipientName: orders.recipient_name,
        totalAmount: orders.total_amount,
      })
      .from(orders)
      .where(inArray(orders.id, allCandidateIds));
    candidateOrders = rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      recipientName: r.recipientName,
      totalAmount: r.totalAmount,
    }));
  }

  return NextResponse.json({
    batch: {
      id: batch.id,
      source: batch.source,
      uploadedFilename: batch.uploaded_filename,
      rowCount: batch.row_count,
      matchedCount: batch.matched_count,
      unmatchedCount: batch.unmatched_count,
      ambiguousCount: batch.ambiguous_count,
      status: batch.status,
      createdAt: batch.created_at,
    },
    matches: matchRows.map((r) => ({
      id: r.matchId,
      matchStatus: r.matchStatus,
      confidence: r.matchConfidence,
      candidates: r.matchCandidates as string[] | null,
      orderId: r.matchOrderId,
      resolvedBy: r.matchResolvedBy,
      tx: {
        id: r.txId,
        txDate: r.txDate,
        amount: r.txAmount,
        accountLast5: r.txAccountLast5,
        memo: r.txMemo,
      },
      order: r.matchOrderId
        ? {
            orderNumber: r.orderNumber,
            recipientName: r.orderRecipientName ?? '',
            totalAmount: r.orderTotalAmount ?? '0',
          }
        : null,
    })),
    candidateOrders,
  });
}
