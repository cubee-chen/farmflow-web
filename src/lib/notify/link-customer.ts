import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';

export async function linkLineUserToCustomer(params: {
  farmerId: string;
  lineUserId: string;
  phone?: string;
  displayName?: string;
}): Promise<{ customerId: string; matched: boolean }> {
  const { farmerId, lineUserId, phone, displayName } = params;
  const now = new Date();

  // Path a: lookup by phone first
  if (phone) {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.farmer_id, farmerId),
          eq(customers.primary_phone, phone)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(customers)
        .set({
          line_user_id: lineUserId,
          line_linked_at: now,
          ...(displayName ? { line_display_name: displayName } : {}),
        })
        .where(eq(customers.id, existing.id));

      return { customerId: existing.id, matched: true };
    }
  }

  // Path b: check if lineUserId already bound to a customer
  const [alreadyBound] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.farmer_id, farmerId),
        eq(customers.line_user_id, lineUserId)
      )
    )
    .limit(1);

  if (alreadyBound) {
    return { customerId: alreadyBound.id, matched: false };
  }

  // Path b: insert new customer
  const [created] = await db
    .insert(customers)
    .values({
      farmer_id: farmerId,
      primary_phone: '',
      line_user_id: lineUserId,
      line_linked_at: now,
      default_name: displayName ?? lineUserId,
      line_display_name: displayName ?? null,
    })
    .returning({ id: customers.id });

  return { customerId: created.id, matched: false };
}
