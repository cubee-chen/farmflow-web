import { NextRequest, NextResponse } from 'next/server';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { AuthError } from '@/lib/auth/get-current-farmer';
import { confirmReconciliationBatch } from '@/lib/reconciliation/confirm';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { batchId } = await params;

  try {
    const result = await confirmReconciliationBatch(batchId, farmer.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (e.message === 'ALREADY_CONFIRMED') return NextResponse.json({ error: 'Already confirmed' }, { status: 409 });
    }
    throw e;
  }
}
