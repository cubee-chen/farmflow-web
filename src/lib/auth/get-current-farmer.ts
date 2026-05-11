import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { farmers } from '@/lib/db/schema';
import type { Farmer } from '@/lib/db/schema';
import { createServerSupabase } from '@/lib/supabase/server';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const getCurrentFarmer = cache(async (): Promise<Farmer> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError('Not authenticated');

  const [farmer] = await db
    .select()
    .from(farmers)
    .where(eq(farmers.authUserId, user.id))
    .limit(1);
  if (!farmer) throw new AuthError('Farmer record missing');

  return farmer;
});

export const getCurrentFarmerOrNull = cache(async (): Promise<Farmer | null> => {
  try {
    return await getCurrentFarmer();
  } catch {
    return null;
  }
});
