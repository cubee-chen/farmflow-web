import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { farmers } from '@/lib/db/schema';

export async function GET() {
  const list = await db
    .select({ id: farmers.id, name: farmers.name, farm_name: farmers.farm_name })
    .from(farmers);
  return NextResponse.json(list);
}
