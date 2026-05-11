import { NextRequest, NextResponse } from 'next/server';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { getSignedImageUrl } from '@/lib/storage/signed-url';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).paths)) {
    return NextResponse.json({ error: 'Missing paths array' }, { status: 400 });
  }

  const paths = (body as { paths: unknown[] }).paths;
  if (!paths.every((p) => typeof p === 'string')) {
    return NextResponse.json({ error: 'Invalid paths' }, { status: 400 });
  }

  await getCurrentFarmer(); // auth guard

  const signedUrls: string[] = [];
  for (const path of paths as string[]) {
    try {
      const url = await getSignedImageUrl(path);
      signedUrls.push(url);
    } catch {
      signedUrls.push(''); // skip failed paths
    }
  }

  return NextResponse.json({ signedUrls });
}
