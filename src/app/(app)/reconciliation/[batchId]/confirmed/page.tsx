import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  reconciliationMatches,
  orders,
  customers,
  notificationTemplates,
  notificationLogs,
} from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { renderTemplate } from '@/lib/notification/render';
import { ConfirmedSummaryClient } from './_components/confirmed-summary-client';

interface Props {
  params: Promise<{ batchId: string }>;
}

function buildDefaultText(recipientName: string, amount: string) {
  return `親愛的 ${recipientName} 您好，\n\n我們已收到您的付款 NT$${Number(amount).toLocaleString()}，感謝您！`;
}

export default async function ConfirmedSummaryPage({ params }: Props) {
  const { batchId } = await params;
  const farmer = await getCurrentFarmer();

  const [batch] = await db
    .select({ id: bankReconciliationBatches.id, status: bankReconciliationBatches.status })
    .from(bankReconciliationBatches)
    .where(
      and(
        eq(bankReconciliationBatches.id, batchId),
        eq(bankReconciliationBatches.farmer_id, farmer.id)
      )
    )
    .limit(1);

  if (!batch) notFound();

  const matchRows = await db
    .select({
      matchId: reconciliationMatches.id,
      orderId: reconciliationMatches.order_id,
      txAmount: bankTransactions.amount,
      txDate: bankTransactions.tx_date,
      orderNumber: orders.order_number,
      recipientName: orders.recipient_name,
      totalAmount: orders.total_amount,
      customerLineUserId: customers.line_user_id,
    })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .innerJoin(orders, eq(reconciliationMatches.order_id, orders.id))
    .leftJoin(customers, eq(orders.customer_id, customers.id))
    .where(
      and(
        eq(bankTransactions.batch_id, batchId),
        inArray(reconciliationMatches.match_status, ['matched', 'manual_override']),
        isNotNull(reconciliationMatches.order_id)
      )
    )
    .orderBy(asc(bankTransactions.tx_date));

  const orderIds = matchRows.map((r) => r.orderId as string);

  // Find the most recent 'paid' notification log per order so the UI can show
  // whether the auto-dispatch (from confirmReconciliationBatch) succeeded.
  const logRows = orderIds.length
    ? await db
        .select({
          order_id: notificationLogs.order_id,
          status: notificationLogs.status,
          error_message: notificationLogs.error_message,
          sent_at: notificationLogs.sent_at,
          created_at: notificationLogs.created_at,
        })
        .from(notificationLogs)
        .where(
          and(
            inArray(notificationLogs.order_id, orderIds),
            eq(notificationLogs.trigger_event, 'paid')
          )
        )
        .orderBy(desc(notificationLogs.created_at))
    : [];

  const latestLogByOrder = new Map<
    string,
    { status: string; error_message: string | null; sent_at: Date | null }
  >();
  for (const log of logRows) {
    if (!log.order_id) continue;
    if (!latestLogByOrder.has(log.order_id)) {
      latestLogByOrder.set(log.order_id, {
        status: log.status,
        error_message: log.error_message,
        sent_at: log.sent_at,
      });
    }
  }

  const [paidTemplate] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.farmer_id, farmer.id),
        eq(notificationTemplates.trigger_event, 'paid'),
        eq(notificationTemplates.is_active, true)
      )
    )
    .limit(1);

  const confirmedOrders = matchRows.map((r) => {
    const notificationText = paidTemplate
      ? renderTemplate(paidTemplate.template_text, {
          recipient_name: r.recipientName,
          order_number: r.orderNumber ?? '',
          total_amount: `NT$${Number(r.totalAmount).toLocaleString()}`,
          amount: `NT$${Number(r.txAmount).toLocaleString()}`,
          ship_date: '',
          tracking_number: '',
          items_summary: '',
          recipient_address: '',
          desired_arrival_date: '',
          shipping_provider: '',
        })
      : buildDefaultText(r.recipientName, r.txAmount);

    const log = latestLogByOrder.get(r.orderId as string) ?? null;

    return {
      matchId: r.matchId,
      orderId: r.orderId as string,
      orderNumber: r.orderNumber,
      recipientName: r.recipientName,
      txAmount: r.txAmount,
      txDate: r.txDate,
      notificationText,
      hasLineBinding: !!r.customerLineUserId,
      pushStatus: log?.status ?? null,
      pushError: log?.error_message ?? null,
      pushSentAt: log?.sent_at ? log.sent_at.toISOString() : null,
    };
  });

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/reconciliation"
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
          aria-label="返回對帳列表"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">對帳確認完成</h1>
      </div>
      <ConfirmedSummaryClient confirmedOrders={confirmedOrders} />
    </div>
  );
}
