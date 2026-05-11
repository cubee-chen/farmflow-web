import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { AuthError } from '@/lib/auth/get-current-farmer';

export async function GET(req: NextRequest) {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const q = req.nextUrl.searchParams.get('q') ?? '';

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.order_number,
      recipientName: orders.recipient_name,
      recipientPhone: orders.recipient_phone,
      totalAmount: orders.total_amount,
    })
    .from(orders)
    .where(
      and(
        eq(orders.farmer_id, farmer.id),
        eq(orders.payment_status, 'unpaid'),
        inArray(orders.status, ['confirmed', 'packing', 'shipped']),
        q
          ? or(
              ilike(orders.recipient_name, `%${q}%`),
              ilike(orders.recipient_phone, `%${q}%`)
            )
          : undefined
      )
    )
    .limit(100);

  return NextResponse.json(rows);
}
