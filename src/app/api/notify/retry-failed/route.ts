import { NextResponse } from 'next/server';
import { getCurrentFarmer, AuthError } from '@/lib/auth/get-current-farmer';
import { retryFailedNotifications } from '@/lib/notify/retry';

export async function POST() {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const result = await retryFailedNotifications(farmer.id);
  return NextResponse.json(result);
}
