'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notificationTemplates } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';

const ALLOWED_EVENTS = new Set(['confirmed', 'paid', 'shipped']);

export async function updateNotificationTemplate(
  triggerEvent: string,
  templateText: string
): Promise<{ success: true } | { error: string }> {
  if (!ALLOWED_EVENTS.has(triggerEvent)) {
    return { error: 'Invalid trigger event' };
  }

  const farmer = await getCurrentFarmer();

  const existing = await db
    .select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.farmer_id, farmer.id),
        eq(notificationTemplates.trigger_event, triggerEvent)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(notificationTemplates)
      .set({ template_text: templateText })
      .where(
        and(
          eq(notificationTemplates.farmer_id, farmer.id),
          eq(notificationTemplates.trigger_event, triggerEvent)
        )
      );
  } else {
    await db.insert(notificationTemplates).values({
      farmer_id: farmer.id,
      trigger_event: triggerEvent,
      template_text: templateText,
    });
  }

  return { success: true };
}
