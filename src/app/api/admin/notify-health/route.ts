import { NextRequest, NextResponse } from 'next/server';
import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notificationLogs, farmers } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      farmer_id: notificationLogs.farmer_id,
      status: notificationLogs.status,
      cnt: count(),
    })
    .from(notificationLogs)
    .where(gte(notificationLogs.created_at, since))
    .groupBy(notificationLogs.farmer_id, notificationLogs.status);

  const farmerIds = [...new Set(rows.map((r) => r.farmer_id))];
  const farmerNames =
    farmerIds.length > 0
      ? await db
          .select({ id: farmers.id, farm_name: farmers.farm_name, name: farmers.name })
          .from(farmers)
          .where(eq(farmers.id, farmerIds[0])) // fallback single query; fine for small scale
      : [];

  const nameMap = new Map(farmerNames.map((f) => [f.id, f.farm_name ?? f.name]));

  type Stats = { sent: number; failed: number; skipped: number };
  const byFarmer = new Map<string, Stats>();

  for (const row of rows) {
    const entry = byFarmer.get(row.farmer_id) ?? { sent: 0, failed: 0, skipped: 0 };
    const status = row.status as keyof Stats;
    if (status in entry) entry[status] = Number(row.cnt);
    byFarmer.set(row.farmer_id, entry);
  }

  // Aggregate totals across all farmers
  let totalSent = 0, totalFailed = 0, totalSkipped = 0;
  const perFarmer = Array.from(byFarmer.entries()).map(([id, stats]) => {
    totalSent += stats.sent;
    totalFailed += stats.failed;
    totalSkipped += stats.skipped;
    return { farmerId: id, farmerName: nameMap.get(id) ?? id, ...stats };
  });

  return NextResponse.json({
    since: since.toISOString(),
    totals: { sent: totalSent, failed: totalFailed, skipped: totalSkipped },
    perFarmer,
  });
}
