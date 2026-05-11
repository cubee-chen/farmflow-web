import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { listOrders } from '@/lib/queries/orders';

export async function GET(req: NextRequest) {
  const farmer = await getCurrentFarmer();
  const { searchParams } = req.nextUrl;

  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';
  const intake = searchParams.get('intake') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const result = await listOrders({ farmerId: farmer.id, status, q, intake, page });
  return NextResponse.json(result);
}
