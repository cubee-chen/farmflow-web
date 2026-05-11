import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  reconciliationMatches,
  orders,
  notificationTemplates,
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
    })
    .from(reconciliationMatches)
    .innerJoin(bankTransactions, eq(reconciliationMatches.bank_transaction_id, bankTransactions.id))
    .innerJoin(orders, eq(reconciliationMatches.order_id, orders.id))
    .where(
      and(
        eq(bankTransactions.batch_id, batchId),
        inArray(reconciliationMatches.match_status, ['matched', 'manual_override']),
        isNotNull(reconciliationMatches.order_id)
      )
    )
    .orderBy(asc(bankTransactions.tx_date));

  const templateRows = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.farmer_id, farmer.id),
        eq(notificationTemplates.is_active, true)
      )
    );

  const paidTemplate =
    templateRows.find((t) => t.trigger_event === 'paid') ?? templateRows[0] ?? null;

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

    return {
      matchId: r.matchId,
      orderId: r.orderId as string,
      orderNumber: r.orderNumber,
      recipientName: r.recipientName,
      txAmount: r.txAmount,
      txDate: r.txDate,
      notificationText,
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
