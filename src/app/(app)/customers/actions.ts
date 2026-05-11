'use server';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, orders } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { linkLineUserToCustomer } from '@/lib/notify/link-customer';

export async function linkLine(
  customerId: string,
  lineUserId: string
): Promise<{ success: true } | { error: string }> {
  if (!lineUserId.trim()) return { error: '請輸入 LINE userId' };

  const farmer = await getCurrentFarmer();

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.farmer_id, farmer.id)))
    .limit(1);

  if (!customer) return { error: '找不到客戶' };

  await db
    .update(customers)
    .set({ line_user_id: lineUserId.trim(), line_linked_at: new Date() })
    .where(eq(customers.id, customerId));

  return { success: true };
}

export async function unlinkLineUser(
  customerId: string
): Promise<{ success: true } | { error: string }> {
  const farmer = await getCurrentFarmer();

  const result = await db
    .update(customers)
    .set({ line_user_id: null, line_linked_at: null })
    .where(and(eq(customers.id, customerId), eq(customers.farmer_id, farmer.id)));

  return { success: true };
}

export async function linkLineByPhone(params: {
  farmerId: string;
  lineUserId: string;
  phone?: string;
  displayName?: string;
}): Promise<{ customerId: string; matched: boolean } | { error: string }> {
  const farmer = await getCurrentFarmer();
  if (farmer.id !== params.farmerId) return { error: 'Unauthorized' };

  return linkLineUserToCustomer(params);
}

export async function mergeCustomers(
  sourceId: string,
  targetId: string
): Promise<{ success: true; targetId: string } | { error: string }> {
  if (sourceId === targetId) return { error: '來源與目標相同' };

  const farmer = await getCurrentFarmer();

  // Both customers must belong to the current farmer (cross-farmer isolation)
  const both = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.farmer_id, farmer.id),
        inArray(customers.id, [sourceId, targetId])
      )
    );

  if (both.length !== 2) return { error: '找不到客戶（或不屬於你）' };

  await db.transaction(async (tx) => {
    // Move every order from source to target (farmer scope enforced again as defence)
    await tx
      .update(orders)
      .set({ customer_id: targetId })
      .where(and(eq(orders.customer_id, sourceId), eq(orders.farmer_id, farmer.id)));

    // Recompute target aggregates from orders so denormalised totals stay correct
    const [agg] = await tx
      .select({
        count: sql<number>`cast(count(*) as integer)`,
        sum: sql<string>`coalesce(sum(${orders.total_amount}), '0')`,
        last: sql<Date | null>`max(${orders.created_at})`,
      })
      .from(orders)
      .where(eq(orders.customer_id, targetId));

    await tx
      .update(customers)
      .set({
        total_orders: agg.count,
        total_amount: agg.sum,
        last_ordered_at: agg.last,
      })
      .where(eq(customers.id, targetId));

    await tx.delete(customers).where(eq(customers.id, sourceId));
  });

  return { success: true, targetId };
}
