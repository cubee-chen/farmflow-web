import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bankReconciliationBatches } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { AuthError } from '@/lib/auth/get-current-farmer';

export async function GET() {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const batches = await db
    .select()
    .from(bankReconciliationBatches)
    .where(eq(bankReconciliationBatches.farmer_id, farmer.id))
    .orderBy(desc(bankReconciliationBatches.created_at));

  return NextResponse.json(
    batches.map((b) => ({
      id: b.id,
      source: b.source,
      uploadedFilename: b.uploaded_filename,
      rowCount: b.row_count,
      matchedCount: b.matched_count,
      unmatchedCount: b.unmatched_count,
      ambiguousCount: b.ambiguous_count,
      status: b.status,
      createdAt: b.created_at,
    }))
  );
}
