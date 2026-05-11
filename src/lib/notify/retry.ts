import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notificationLogs } from '@/lib/db/schema';
import { dispatchNotification } from './dispatch';

export interface RetryResult {
  total: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function retryFailedNotifications(
  farmerId: string,
  lookbackHours: number = 24
): Promise<RetryResult> {
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const failedLogs = await db
    .select({
      id: notificationLogs.id,
      order_id: notificationLogs.order_id,
      trigger_event: notificationLogs.trigger_event,
    })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.farmer_id, farmerId),
        eq(notificationLogs.status, 'failed'),
        isNotNull(notificationLogs.order_id),
        gte(notificationLogs.created_at, cutoff)
      )
    );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const log of failedLogs) {
    if (!log.order_id) continue;
    const triggerEvent = log.trigger_event as 'confirmed' | 'paid' | 'shipped';
    if (!['confirmed', 'paid', 'shipped'].includes(triggerEvent)) continue;

    try {
      const result = await dispatchNotification({ orderId: log.order_id, triggerEvent });
      if (result.status === 'sent') sent++;
      else if (result.status === 'skipped') skipped++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return { total: failedLogs.length, sent, skipped, failed };
}
