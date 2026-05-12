import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  products,
  farmers,
  customers,
  notificationTemplates,
  notificationLogs,
} from '@/lib/db/schema';
import { sendLinePushMessage } from './line-client';
import { renderNotificationTemplate } from './render';
import { buildOrderNotificationVars } from './build-vars';

type TriggerEvent = 'confirmed' | 'paid' | 'shipped';
type DispatchStatus = 'sent' | 'skipped' | 'failed';

// Built-in fallback templates used when the farmer has not yet customised one
// in /settings. Same variable surface as buildOrderNotificationVars so the
// existing renderer just works.
const DEFAULT_TEMPLATES: Record<TriggerEvent, string> = {
  confirmed:
    '您好 {recipient_name}！已收到您的訂單 {order_number}，共 {total_amount}，請在出貨前完成轉帳並回傳帳號末五碼，感謝！',
  paid:
    '您好 {recipient_name}！已收到您的款項 {total_amount}（訂單 {order_number}），訂單將儘速備貨出貨，感謝！',
  shipped:
    '您好 {recipient_name}！您的訂單 {order_number} 已出貨，運送單號：{tracking_number}，預計到貨：{desired_arrival_date}。感謝您的購買！',
};

async function insertLog(params: {
  farmerId: string;
  orderId: string;
  triggerEvent: TriggerEvent;
  status: DispatchStatus;
  recipientLineUserId?: string | null;
  renderedText?: string | null;
  errorMessage?: string | null;
  sentAt?: Date | null;
}) {
  await db.insert(notificationLogs).values({
    farmer_id: params.farmerId,
    order_id: params.orderId,
    trigger_event: params.triggerEvent,
    channel: 'line',
    recipient_line_user_id: params.recipientLineUserId ?? null,
    rendered_text: params.renderedText ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null,
    sent_at: params.sentAt ?? null,
  });
}

export async function dispatchNotification(params: {
  orderId: string;
  triggerEvent: TriggerEvent;
}): Promise<{ status: DispatchStatus; reason?: string }> {
  const { orderId, triggerEvent } = params;

  // a. Fetch order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { status: 'skipped', reason: 'order not found' };

  // a. Fetch farmer
  const [farmer] = await db
    .select()
    .from(farmers)
    .where(eq(farmers.id, order.farmer_id))
    .limit(1);

  if (!farmer) return { status: 'skipped', reason: 'farmer not found' };

  // a. Fetch customer
  const customer = order.customer_id
    ? (
        await db
          .select()
          .from(customers)
          .where(eq(customers.id, order.customer_id))
          .limit(1)
      )[0] ?? null
    : null;

  // a. Fetch order items
  const itemRows = await db
    .select({ display_name: products.display_name, quantity: orderItems.quantity })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(eq(orderItems.order_id, orderId));

  // b. Get template
  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.farmer_id, order.farmer_id),
        eq(notificationTemplates.trigger_event, triggerEvent),
        eq(notificationTemplates.is_active, true)
      )
    )
    .limit(1);

  // Fall back to the built-in template if the farmer has not customised one
  // for this trigger. Avoids the previous "no template" skip path so dispatch
  // works out-of-the-box even without seeding settings.
  const templateText = template?.template_text ?? DEFAULT_TEMPLATES[triggerEvent];

  // c. Prerequisites
  if (!farmer.line_channel_access_token) {
    await insertLog({ farmerId: order.farmer_id, orderId, triggerEvent, status: 'skipped', errorMessage: 'farmer not configured' });
    return { status: 'skipped', reason: 'farmer not configured' };
  }

  if (!customer?.line_user_id) {
    await insertLog({ farmerId: order.farmer_id, orderId, triggerEvent, status: 'skipped', errorMessage: 'customer not linked' });
    return { status: 'skipped', reason: 'customer not linked' };
  }

  // e. Dedup
  const [alreadySent] = await db
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.order_id, orderId),
        eq(notificationLogs.trigger_event, triggerEvent),
        eq(notificationLogs.status, 'sent')
      )
    )
    .limit(1);

  if (alreadySent) {
    return { status: 'skipped', reason: 'already_sent' };
  }

  // d. Build text
  const vars = buildOrderNotificationVars({
    recipient_name: order.recipient_name,
    order_number: order.order_number,
    total_amount: order.total_amount,
    ship_date: order.ship_date,
    desired_arrival_date: order.desired_arrival_date,
    tracking_number: order.tracking_number,
    recipient_address: order.recipient_address,
    shipping_provider: order.shipping_provider,
    items: itemRows.map((i) => ({ display_name: i.display_name, quantity: i.quantity })),
  });
  const text = renderNotificationTemplate(templateText, vars);

  // f. Send
  try {
    await sendLinePushMessage({
      channelAccessToken: farmer.line_channel_access_token,
      toUserId: customer.line_user_id,
      text,
    });

    const now = new Date();
    await insertLog({
      farmerId: order.farmer_id,
      orderId,
      triggerEvent,
      status: 'sent',
      recipientLineUserId: customer.line_user_id,
      renderedText: text,
      sentAt: now,
    });
    await db
      .update(orders)
      .set({ notified_customer_at: now, updated_at: now })
      .where(eq(orders.id, orderId));

    return { status: 'sent' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '未知錯誤';
    await insertLog({
      farmerId: order.farmer_id,
      orderId,
      triggerEvent,
      status: 'failed',
      recipientLineUserId: customer.line_user_id,
      renderedText: text,
      errorMessage,
    });
    return { status: 'failed', reason: errorMessage };
  }
}
