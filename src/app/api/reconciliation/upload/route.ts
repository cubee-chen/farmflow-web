import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bankReconciliationBatches, bankTransactions } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { parsePostalCsv } from '@/lib/reconciliation/parsers/postal';
import { AuthError } from '@/lib/auth/get-current-farmer';

export async function POST(req: NextRequest) {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw e;
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  const source = (formData.get('source') as string | null) ?? 'postal';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  // Only postal source supported in P1-R1; other parsers added in subsequent tasks
  if (source !== 'postal') {
    return NextResponse.json({ error: `Unsupported source: ${source}` }, { status: 400 });
  }

  const { rows, errors } = await parsePostalCsv(file);

  let batchId: string;

  await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(bankReconciliationBatches)
      .values({
        farmer_id: farmer.id,
        source,
        uploaded_filename: file.name,
        row_count: rows.length,
        status: 'draft',
      })
      .returning({ id: bankReconciliationBatches.id });

    batchId = batch.id;

    if (rows.length > 0) {
      await tx.insert(bankTransactions).values(
        rows.map((r) => ({
          batch_id: batchId,
          tx_date: r.txDate,
          amount: String(r.amount),
          direction: r.direction,
          account_last_5: r.accountLast5,
          memo: r.memo,
          raw_row: r.rawRow,
        }))
      );
    }
  });

  return NextResponse.json({
    batchId: batchId!,
    rowCount: rows.length,
    errors,
  });
}
