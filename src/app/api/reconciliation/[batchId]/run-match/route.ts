import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bankReconciliationBatches } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { AuthError } from '@/lib/auth/get-current-farmer';
import { runMatchEngine } from '@/lib/reconciliation/match';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const { batchId } = await params;

  // Verify batch exists and belongs to this farmer
  const [batch] = await db
    .select({ id: bankReconciliationBatches.id })
    .from(bankReconciliationBatches)
    .where(
      and(
        eq(bankReconciliationBatches.id, batchId),
        eq(bankReconciliationBatches.farmer_id, farmer.id)
      )
    )
    .limit(1);

  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const summary = await runMatchEngine(batchId, farmer.id);
  return NextResponse.json(summary);
}
