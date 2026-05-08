import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';

const schema = z.object({
  orderIds: z.array(z.string().uuid()),
  status: z.enum(['draft', 'confirmed', 'packing', 'shipped', 'completed']),
});

export async function POST(req: NextRequest) {
  const farmer = await getCurrentFarmer();
  const { orderIds, status } = schema.parse(await req.json());

  if (orderIds.length === 0) return NextResponse.json({ updated: 0 });

  await db
    .update(orders)
    .set({ status, updated_at: new Date() })
    .where(and(inArray(orders.id, orderIds), eq(orders.farmer_id, farmer.id)));

  return NextResponse.json({ updated: orderIds.length });
}
