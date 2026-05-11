import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export async function getSignedImageUrl(
  storagePath: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage
    .from('intake-images')
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create signed URL');
  }

  return data.signedUrl;
}
