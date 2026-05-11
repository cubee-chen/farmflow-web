import { notFound } from 'next/navigation';
import { and, eq, ne, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { MergeClient } from './_components/merge-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerMergePage({ params }: Props) {
  const { id } = await params;
  const farmer = await getCurrentFarmer();

  const [source] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.farmer_id, farmer.id)))
    .limit(1);

  if (!source) notFound();

  const others = await db
    .select({
      id: customers.id,
      default_name: customers.default_name,
      line_display_name: customers.line_display_name,
      primary_phone: customers.primary_phone,
      total_orders: customers.total_orders,
      total_amount: customers.total_amount,
    })
    .from(customers)
    .where(and(eq(customers.farmer_id, farmer.id), ne(customers.id, id)))
    .orderBy(desc(customers.last_ordered_at), desc(customers.created_at));

  return <MergeClient source={source} others={others} />;
}
