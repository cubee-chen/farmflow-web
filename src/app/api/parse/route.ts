import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { parseOrderText } from '@/lib/llm/parse';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).rawText !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing rawText field' }, { status: 400 });
  }

  const rawText = ((body as Record<string, unknown>).rawText as string).trim();
  if (!rawText) {
    return NextResponse.json({ error: 'rawText is empty' }, { status: 400 });
  }

  const farmer = await getCurrentFarmer();
  const productList = await db
    .select()
    .from(products)
    .where(eq(products.farmer_id, farmer.id))
    .orderBy(asc(products.sort_order), asc(products.display_name));

  const draft = await parseOrderText(rawText, farmer, productList);

  return NextResponse.json({
    ...draft,
    parsed_at: new Date().toISOString(),
  });
}
