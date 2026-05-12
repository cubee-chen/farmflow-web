import { headers } from 'next/headers';
import { count, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bankReconciliationBatches,
  bankTransactions,
  farmers,
  lineWebhookEvents,
  notificationLogs,
  reconciliationMatches,
} from '@/lib/db/schema';
import { getExceptionCount } from '@/lib/queries/exceptions';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

async function verify(searchParams: { token?: string }): Promise<boolean> {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  const h = await headers();
  const headerSecret = h.get('x-admin-secret');
  return headerSecret === expected || searchParams.token === expected;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminHealthPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ok = await verify(sp);

  if (!ok) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold">Forbidden</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Pass <code className="px-1 bg-zinc-100">x-admin-secret</code> header or{' '}
          <code className="px-1 bg-zinc-100">?token=</code> query, matching the
          server&apos;s ADMIN_SECRET env var.
        </p>
      </main>
    );
  }

  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  // Run aggregate queries in parallel
  const [
    webhookRows,
    notifyRows,
    reconRows,
    farmerList,
  ] = await Promise.all([
    db
      .select({ farmer_id: lineWebhookEvents.farmer_id, c: count() })
      .from(lineWebhookEvents)
      .where(gte(lineWebhookEvents.created_at, since24h))
      .groupBy(lineWebhookEvents.farmer_id),

    db
      .select({
        farmer_id: notificationLogs.farmer_id,
        status: notificationLogs.status,
        c: count(),
      })
      .from(notificationLogs)
      .where(gte(notificationLogs.created_at, since24h))
      .groupBy(notificationLogs.farmer_id, notificationLogs.status),

    db
      .select({
        farmer_id: bankReconciliationBatches.farmer_id,
        status: reconciliationMatches.match_status,
        c: count(),
      })
      .from(reconciliationMatches)
      .innerJoin(
        bankTransactions,
        eq(reconciliationMatches.bank_transaction_id, bankTransactions.id)
      )
      .innerJoin(
        bankReconciliationBatches,
        eq(bankTransactions.batch_id, bankReconciliationBatches.id)
      )
      .where(gte(bankReconciliationBatches.created_at, since7d))
      .groupBy(bankReconciliationBatches.farmer_id, reconciliationMatches.match_status),

    db
      .select({
        id: farmers.id,
        name: farmers.name,
        farm_name: farmers.farm_name,
      })
      .from(farmers),
  ]);

  const exceptionCounts = await Promise.all(
    farmerList.map((f) => getExceptionCount(f.id).then((c) => [f.id, c] as const))
  );
  const exceptionsMap = new Map(exceptionCounts);

  const webhookMap = new Map(webhookRows.map((r) => [r.farmer_id, Number(r.c)]));

  const notifyMap = new Map<string, { sent: number; failed: number; skipped: number }>();
  for (const r of notifyRows) {
    const entry = notifyMap.get(r.farmer_id) ?? { sent: 0, failed: 0, skipped: 0 };
    if (r.status === 'sent') entry.sent = Number(r.c);
    else if (r.status === 'failed') entry.failed = Number(r.c);
    else entry.skipped += Number(r.c);
    notifyMap.set(r.farmer_id, entry);
  }

  const reconMap = new Map<string, { matched: number; anomaly: number }>();
  for (const r of reconRows) {
    const entry = reconMap.get(r.farmer_id) ?? { matched: 0, anomaly: 0 };
    if (r.status === 'matched') entry.matched += Number(r.c);
    else entry.anomaly += Number(r.c);
    reconMap.set(r.farmer_id, entry);
  }

  // Totals across all farmers
  const totals = {
    webhooks24h: [...webhookMap.values()].reduce((s, n) => s + n, 0),
    notifySent: [...notifyMap.values()].reduce((s, v) => s + v.sent, 0),
    notifyFailed: [...notifyMap.values()].reduce((s, v) => s + v.failed, 0),
    reconMatched: [...reconMap.values()].reduce((s, v) => s + v.matched, 0),
    reconAnomaly: [...reconMap.values()].reduce((s, v) => s + v.anomaly, 0),
    exceptionsOpen: [...exceptionsMap.values()].reduce((s, n) => s + n, 0),
  };

  const notifyTotal = totals.notifySent + totals.notifyFailed;
  const notifySentRatio = notifyTotal === 0 ? null : totals.notifySent / notifyTotal;

  const reconTotal = totals.reconMatched + totals.reconAnomaly;
  const reconMatchedRatio = reconTotal === 0 ? null : totals.reconMatched / reconTotal;

  return (
    <main className="p-6 space-y-6 font-mono text-sm">
      <header>
        <h1 className="text-2xl font-bold mb-1">FarmFlow Admin Health</h1>
        <p className="text-xs text-zinc-500">
          Snapshot at {new Date().toISOString()} · 24h window for webhooks/notify · 7d window for reconciliation
        </p>
      </header>

      {/* Totals */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Metric label="LINE webhook events (24h)" value={totals.webhooks24h} />
        <Metric
          label="LINE push sent / total (24h)"
          value={`${totals.notifySent} / ${notifyTotal}`}
          sub={notifySentRatio !== null ? `${(notifySentRatio * 100).toFixed(1)}% success` : null}
        />
        <Metric
          label="Recon matched / total (7d)"
          value={`${totals.reconMatched} / ${reconTotal}`}
          sub={reconMatchedRatio !== null ? `${(reconMatchedRatio * 100).toFixed(1)}% match rate` : null}
        />
        <Metric
          label="Open exceptions (all farmers)"
          value={totals.exceptionsOpen}
          sub={totals.exceptionsOpen > 0 ? 'unresolved' : null}
        />
      </section>

      {/* Per-farmer table */}
      <section>
        <h2 className="text-sm font-bold mb-2">Per-farmer breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="text-left py-2 pr-4">Farmer</th>
                <th className="text-right py-2 pr-4">Webhooks 24h</th>
                <th className="text-right py-2 pr-4">Push sent</th>
                <th className="text-right py-2 pr-4">Push failed</th>
                <th className="text-right py-2 pr-4">Recon matched</th>
                <th className="text-right py-2 pr-4">Recon anomaly</th>
                <th className="text-right py-2">Exceptions open</th>
              </tr>
            </thead>
            <tbody>
              {farmerList.map((f) => {
                const notify = notifyMap.get(f.id) ?? { sent: 0, failed: 0, skipped: 0 };
                const recon = reconMap.get(f.id) ?? { matched: 0, anomaly: 0 };
                const exc = exceptionsMap.get(f.id) ?? 0;
                return (
                  <tr key={f.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">
                      {f.farm_name ?? f.name}
                      <span className="text-zinc-400"> · {f.id.slice(0, 8)}</span>
                    </td>
                    <td className="text-right pr-4">{webhookMap.get(f.id) ?? 0}</td>
                    <td className="text-right pr-4">{notify.sent}</td>
                    <td className={`text-right pr-4 ${notify.failed > 0 ? 'text-red-600 font-bold' : ''}`}>
                      {notify.failed}
                    </td>
                    <td className="text-right pr-4">{recon.matched}</td>
                    <td className={`text-right pr-4 ${recon.anomaly > 0 ? 'text-amber-600' : ''}`}>
                      {recon.anomaly}
                    </td>
                    <td className={`text-right ${exc > 0 ? 'text-red-600 font-bold' : ''}`}>
                      {exc}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string | null;
}) {
  return (
    <div className="border border-zinc-200 rounded p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}
