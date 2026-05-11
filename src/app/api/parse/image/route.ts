import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { createServerSupabase } from '@/lib/supabase/server';
import { parseOrderFromImages } from '@/lib/llm/parse-image';

function mimeTypeFromPath(path: string): string {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as Record<string, unknown>).imageStoragePaths)
  ) {
    return NextResponse.json({ error: 'Missing imageStoragePaths array' }, { status: 400 });
  }

  const paths = (body as Record<string, unknown>).imageStoragePaths as unknown[];
  if (paths.length === 0 || !paths.every((p) => typeof p === 'string')) {
    return NextResponse.json(
      { error: 'imageStoragePaths must be a non-empty array of strings' },
      { status: 400 },
    );
  }

  const farmer = await getCurrentFarmer();
  const supabase = await createServerSupabase();

  // Download each image via user client — enforces RLS (farmer can only access own paths)
  const imageBuffers: { mimeType: string; base64: string }[] = [];
  for (const storagePath of paths as string[]) {
    const { data, error } = await supabase.storage
      .from('intake-images')
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: `Cannot access image: ${storagePath}` },
        { status: 403 },
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    imageBuffers.push({ mimeType: mimeTypeFromPath(storagePath), base64: buffer.toString('base64') });
  }

  const productList = await db
    .select()
    .from(products)
    .where(eq(products.farmer_id, farmer.id))
    .orderBy(asc(products.sort_order), asc(products.display_name));

  const draft = await parseOrderFromImages(imageBuffers, farmer, productList);

  return NextResponse.json({ ...draft, parsed_at: new Date().toISOString() });
}
