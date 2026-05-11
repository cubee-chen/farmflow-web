import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { farmers } from '@/lib/db/schema';

const FARMER_COOKIE = 'current_farmer_id';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const getCurrentFarmerId = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const farmerId = cookieStore.get(FARMER_COOKIE)?.value;
  if (farmerId) return farmerId;

  const [first] = await db.select({ id: farmers.id }).from(farmers).limit(1);
  return first?.id ?? null;
});

export async function setCurrentFarmerId(farmerId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(FARMER_COOKIE, farmerId, {
    maxAge: MAX_AGE,
    httpOnly: true,
    path: '/',
  });
}
