'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
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
