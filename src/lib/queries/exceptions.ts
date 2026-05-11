import { and, count, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  notificationLogs,
  orders,
  reconciliationMatches,
} from '@/lib/db/schema';

const RECONCILIATION_ANOMALY_STATUSES = ['amount_mismatch', 'unmatched', 'multi_candidate'] as const;

export interface ReconciliationAnomaly {
  batchId: string;
  filename: string | null;
  anomalyCount: number;
}

export interface FailedNotifyLog {
  id: string;
  orderId: string;
  triggerEvent: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface LowConfidenceOrder {
  id: string;
  orderNumber: string | null;
  recipientName: string;
  parseConfidence: string | null;
  createdAt: string;
}

export async function getExceptionCount(farmerId: string): Promise<number> {
  const [reconciliationRow, failedNotifyRow, lowConfidenceRow] = await Promise.all([
    db
      .select({ c: count() })
      .from(reconciliationMatches)
      .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
      .innerJoin(bankReconciliationBatches, eq(bankTransactions.batch_id, bankReconciliationBatches.id))
      .where(
        and(
          eq(bankReconciliationBatches.farmer_id, farmerId),
          eq(bankReconciliationBatches.status, 'draft'),
          inArray(reconciliationMatches.match_status, RECONCILIATION_ANOMALY_STATUSES)
        )
      ),

    db
      .select({ c: count() })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.farmer_id, farmerId),
          eq(notificationLogs.status, 'failed')
        )
      ),

    db
      .select({ c: count() })
      .from(orders)
      .where(
        and(
          eq(orders.farmer_id, farmerId),
          eq(orders.status, 'draft'),
          isNotNull(orders.parse_confidence),
          lt(orders.parse_confidence, '0.7')
        )
      ),
  ]);

  return (
    Number(reconciliationRow[0]?.c ?? 0) +
    Number(failedNotifyRow[0]?.c ?? 0) +
    Number(lowConfidenceRow[0]?.c ?? 0)
  );
}

export async function getExceptionData(farmerId: string): Promise<{
  reconciliationAnomalies: ReconciliationAnomaly[];
  failedNotifyLogs: FailedNotifyLog[];
  lowConfidenceOrders: LowConfidenceOrder[];
}> {
  // 1. Reconciliation anomalies grouped by batch
  const anomalyRows = await db
    .select({
      batchId: bankReconciliationBatches.id,
      filename: bankReconciliationBatches.uploaded_filename,
      matchStatus: reconciliationMatches.match_status,
    })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .innerJoin(bankReconciliationBatches, eq(bankTransactions.batch_id, bankReconciliationBatches.id))
    .where(
      and(
        eq(bankReconciliationBatches.farmer_id, farmerId),
        eq(bankReconciliationBatches.status, 'draft'),
        inArray(reconciliationMatches.match_status, RECONCILIATION_ANOMALY_STATUSES)
      )
    );

  const batchMap = new Map<string, ReconciliationAnomaly>();
  for (const row of anomalyRows) {
    const existing = batchMap.get(row.batchId);
    if (existing) {
      existing.anomalyCount++;
    } else {
      batchMap.set(row.batchId, { batchId: row.batchId, filename: row.filename, anomalyCount: 1 });
    }
  }
  const reconciliationAnomalies = Array.from(batchMap.values());

  // 2. Failed notification logs (most recent per order+event, limit 50)
  const failedRows = await db
    .select({
      id: notificationLogs.id,
      order_id: notificationLogs.order_id,
      trigger_event: notificationLogs.trigger_event,
      error_message: notificationLogs.error_message,
      created_at: notificationLogs.created_at,
    })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.farmer_id, farmerId),
        eq(notificationLogs.status, 'failed'),
        isNotNull(notificationLogs.order_id)
      )
    )
    .orderBy(notificationLogs.created_at)
    .limit(50);

  const failedNotifyLogs: FailedNotifyLog[] = failedRows.map((r) => ({
    id: r.id,
    orderId: r.order_id!,
    triggerEvent: r.trigger_event,
    errorMessage: r.error_message,
    createdAt: r.created_at?.toISOString() ?? '',
  }));

  // 3. Low-confidence draft orders
  const lowConfRows = await db
    .select({
      id: orders.id,
      order_number: orders.order_number,
      recipient_name: orders.recipient_name,
      parse_confidence: orders.parse_confidence,
      created_at: orders.created_at,
    })
    .from(orders)
    .where(
      and(
        eq(orders.farmer_id, farmerId),
        eq(orders.status, 'draft'),
        isNotNull(orders.parse_confidence),
        lt(orders.parse_confidence, '0.7')
      )
    )
    .orderBy(orders.created_at)
    .limit(50);

  const lowConfidenceOrders: LowConfidenceOrder[] = lowConfRows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    recipientName: r.recipient_name,
    parseConfidence: r.parse_confidence,
    createdAt: r.created_at?.toISOString() ?? '',
  }));

  return { reconciliationAnomalies, failedNotifyLogs, lowConfidenceOrders };
}
