import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { farmers } from '@/lib/db/schema';
import type { Farmer } from '@/lib/db/schema';
import { getCurrentFarmerId } from './farmer-context';

export const getCurrentFarmer = cache(async (): Promise<Farmer> => {
  const farmerId = await getCurrentFarmerId();

  if (farmerId) {
    const [farmer] = await db
      .select()
      .from(farmers)
      .where(eq(farmers.id, farmerId))
      .limit(1);
    if (farmer) return farmer;
  }

  // Fallback: first farmer in DB
  const [first] = await db.select().from(farmers).limit(1);
  if (!first) throw new Error('No farmers in database. Run pnpm db:seed first.');
  return first;
});
