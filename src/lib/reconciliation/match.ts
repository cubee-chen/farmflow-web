import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bankTransactions,
  bankReconciliationBatches,
  orders,
  reconciliationMatches,
} from '@/lib/db/schema';
import type { MatchStatus, MatchSummary } from './types';

// ─── Lightweight in-memory types for the pure matching function ───────────────

export interface TxInput {
  id: string;
  amount: string | number | null;
  account_last_5: string | null;
}

export interface OrderCandidate {
  id: string;
  total_amount: string | number | null;
  bank_last_5: string | null;
}

export interface MatchOutput {
  bank_transaction_id: string;
  order_id: string | null;
  match_status: MatchStatus;
  confidence: string;           // numeric string, e.g. "1.00"
  candidates: string[] | null;  // order IDs when ambiguous
  resolved_by: string;
}

// ─── Pure matching logic (exported for unit tests) ────────────────────────────

export function computeMatch(tx: TxInput, candidates: OrderCandidate[]): MatchOutput {
  const txAmount = parseFloat(String(tx.amount));

  // Rule 1 – amount matches AND (order has no recorded last-5 OR last-5 matches)
  const rule1 = candidates.filter((o) => {
    const oAmt = parseFloat(String(o.total_amount));
    return (
      oAmt === txAmount &&
      (o.bank_last_5 === null || o.bank_last_5 === tx.account_last_5)
    );
  });

  if (rule1.length === 1) {
    return result(tx.id, rule1[0].id, 'matched', '1.00', null);
  }
  if (rule1.length > 1) {
    return result(tx.id, null, 'multi_candidate', '0.50', ids(rule1));
  }

  // Rule 2 – amount-only match (last-5 mismatch or tx has no account info)
  const rule2 = candidates.filter(
    (o) => parseFloat(String(o.total_amount)) === txAmount
  );

  if (rule2.length === 1) {
    return result(tx.id, rule2[0].id, 'matched', '0.80', null);
  }
  if (rule2.length > 1) {
    return result(tx.id, null, 'multi_candidate', '0.50', ids(rule2));
  }

  // Rule 3 – amount within ±10 (possible transfer fee)
  const rule3 = candidates.filter(
    (o) => Math.abs(parseFloat(String(o.total_amount)) - txAmount) <= 10
  );

  if (rule3.length > 0) {
    return result(tx.id, null, 'amount_mismatch', '0.30', ids(rule3));
  }

  return result(tx.id, null, 'unmatched', '0.00', null);
}

function result(
  txId: string,
  orderId: string | null,
  status: MatchStatus,
  confidence: string,
  candidates: string[] | null
): MatchOutput {
  return {
    bank_transaction_id: txId,
    order_id: orderId,
    match_status: status,
    confidence,
    candidates,
    resolved_by: 'auto',
  };
}

function ids(arr: OrderCandidate[]): string[] {
  return arr.map((o) => o.id);
}

// ─── DB-aware orchestrator ────────────────────────────────────────────────────

export async function runMatchEngine(
  batchId: string,
  farmerId: string
): Promise<MatchSummary> {
  // Fetch only 'in' transactions for this batch
  const txRows = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.batch_id, batchId),
        eq(bankTransactions.direction, 'in')
      )
    );

  // Fetch eligible orders for this farmer (enforces cross-farmer isolation)
  const orderRows = await db
    .select({
      id: orders.id,
      total_amount: orders.total_amount,
      bank_last_5: orders.bank_last_5,
    })
    .from(orders)
    .where(
      and(
        eq(orders.farmer_id, farmerId),
        eq(orders.payment_status, 'unpaid'),
        inArray(orders.status, ['confirmed', 'packing', 'shipped'])
      )
    );

  const outputs = txRows.map((tx) => computeMatch(tx, orderRows));

  if (txRows.length > 0) {
    // Delete any prior run's results (makes re-run safe)
    await db.delete(reconciliationMatches).where(
      inArray(
        reconciliationMatches.bank_transaction_id,
        txRows.map((t) => t.id)
      )
    );

    await db.insert(reconciliationMatches).values(
      outputs.map((m) => ({
        bank_transaction_id: m.bank_transaction_id,
        order_id: m.order_id,
        match_status: m.match_status,
        confidence: m.confidence,
        candidates: m.candidates,
        resolved_by: m.resolved_by,
      }))
    );
  }

  const matched = outputs.filter((m) => m.match_status === 'matched').length;
  const amountMismatch = outputs.filter(
    (m) => m.match_status === 'amount_mismatch'
  ).length;
  const multiCandidate = outputs.filter(
    (m) => m.match_status === 'multi_candidate'
  ).length;
  const unmatched = outputs.filter(
    (m) => m.match_status === 'unmatched'
  ).length;

  // amount_mismatch needs manual review, so counts toward unmatched_count in batch
  await db
    .update(bankReconciliationBatches)
    .set({
      matched_count: matched,
      unmatched_count: unmatched + amountMismatch,
      ambiguous_count: multiCandidate,
    })
    .where(eq(bankReconciliationBatches.id, batchId));

  return {
    batchId,
    totalTransactions: txRows.length,
    matched,
    amountMismatch,
    multiCandidate,
    unmatched,
  };
}
