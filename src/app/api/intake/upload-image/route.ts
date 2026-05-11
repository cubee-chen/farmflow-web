import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { createServerSupabase } from '@/lib/supabase/server';

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(req: NextRequest) {
  const farmer = await getCurrentFarmer();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const path = `${farmer.id}/${yyyymm}/${randomUUID()}.${extFromMime(file.type)}`;

  const supabase = await createServerSupabase();
  const { error } = await supabase.storage
    .from('intake-images')
    .upload(path, file, { contentType: file.type });

  if (error) {
    console.error('[upload-image]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ storagePath: path });
}
