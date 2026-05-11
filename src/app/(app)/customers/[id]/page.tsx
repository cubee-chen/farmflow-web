import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
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
    })
    .from(orders)
    .where(and(eq(orders.customer_id, id), eq(orders.farmer_id, farmer.id)))
    .orderBy(desc(orders.created_at))
    .limit(50);

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

  return <CustomerDetailClient customer={customer} orders={orderList} lineHistory={lineHistory} />;
}
