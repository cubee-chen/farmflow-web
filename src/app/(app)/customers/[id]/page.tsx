import { notFound } from 'next/navigation';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, lineWebhookEvents, orders } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { CustomerDetailClient } from './_components/customer-detail-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const farmer = await getCurrentFarmer();

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.farmer_id, farmer.id)))
    .limit(1);

  if (!customer) notFound();

  const orderList = await db
    .select({
      id: orders.id,
      order_number: orders.order_number,
      status: orders.status,
      total_amount: orders.total_amount,
      created_at: orders.created_at,
      bank_last_5: orders.bank_last_5,
    })
    .from(orders)
    .where(and(eq(orders.customer_id, id), eq(orders.farmer_id, farmer.id)))
    .orderBy(desc(orders.created_at))
    .limit(50);

  // Distinct bank_last_5 codes this customer has used, newest first. Helps the
  // farmer cross-check when reconciling: if a bank transaction's last 5 matches
  // one of these, it's likely from this customer even if amount is off.
  const last5Rows = await db
    .select({ bank_last_5: orders.bank_last_5, last_used: sql<Date>`max(${orders.updated_at})` })
    .from(orders)
    .where(
      and(
        eq(orders.customer_id, id),
        eq(orders.farmer_id, farmer.id),
        isNotNull(orders.bank_last_5)
      )
    )
    .groupBy(orders.bank_last_5)
    .orderBy(sql`max(${orders.updated_at}) DESC`)
    .limit(5);
  const bankLast5History = last5Rows
    .filter((r) => r.bank_last_5)
    .map((r) => r.bank_last_5 as string);

  const lineHistory = customer.line_user_id
    ? await db
        .select({
          id: lineWebhookEvents.id,
          raw_payload: lineWebhookEvents.raw_payload,
          created_at: lineWebhookEvents.created_at,
        })
        .from(lineWebhookEvents)
        .where(
          and(
            eq(lineWebhookEvents.farmer_id, farmer.id),
            eq(lineWebhookEvents.source_user_id, customer.line_user_id),
          ),
        )
        .orderBy(desc(lineWebhookEvents.created_at))
        .limit(10)
    : [];

  return (
    <CustomerDetailClient
      customer={customer}
      orders={orderList}
      lineHistory={lineHistory}
      bankLast5History={bankLast5History}
    />
  );
}
