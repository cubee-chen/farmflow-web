import { NextResponse } from 'next/server';
import { and, asc, eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { farmers, pendingImageGroups } from '@/lib/db/schema';
import { ensureLineUserLinked, processGroupIfReady } from '@/lib/intake/line-webhook-adapter';

const GROUP_TIMEOUT_MS = 30_000;
const SWEEP_LIMIT = 5; // per run, bounded to stay under maxDuration

// Manual sweep endpoint for pending_image_groups whose setTimeout flush never
// fired (function instance went away). Hobby plans block per-minute crons, so
// no automatic schedule is wired in vercel.json — operators curl this with the
// CRON_SECRET bearer header when stale rows pile up. P2 candidate: move to
// Supabase pg_cron or upgrade Vercel plan and re-enable the crons block.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${expected}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - GROUP_TIMEOUT_MS);

  const stale = await db
    .select({
      id: pendingImageGroups.id,
      source_user_id: pendingImageGroups.source_user_id,
      farmer_id: pendingImageGroups.farmer_id,
    })
    .from(pendingImageGroups)
    .where(
      and(
        eq(pendingImageGroups.status, 'pending'),
        lt(pendingImageGroups.last_received_at, cutoff),
      ),
    )
    .orderBy(asc(pendingImageGroups.first_received_at))
    .limit(SWEEP_LIMIT);

  let processed = 0;
  let failed = 0;

  for (const group of stale) {
    try {
      const [farmer] = await db
        .select()
        .from(farmers)
        .where(eq(farmers.id, group.farmer_id))
        .limit(1);

      if (!farmer) {
        failed += 1;
        continue;
      }

      const customerId = await ensureLineUserLinked(farmer, group.source_user_id);
      await processGroupIfReady(group.id, farmer, customerId);
      processed += 1;
    } catch (err) {
      console.error(`[cron] flush group ${group.id} failed:`, err);
      failed += 1;
    }
  }

  return NextResponse.json({ found: stale.length, processed, failed });
}
