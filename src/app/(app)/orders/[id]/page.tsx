import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  orderEvents,
  products,
  notificationTemplates,
  customers,
  notificationLogs,
} from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { renderTemplate } from '@/lib/notification/render';
import { OrderDetailClient } from './_components/order-detail-client';

const STATUS_TO_TRIGGER: Record<string, string> = {
  confirmed: 'confirmed',
  shipped: 'shipped',
  completed: 'completed',
};

function buildDefaultText(
  order: { recipient_name: string; order_number: string | null; total_amount: string },
  items: { display_name: string | null; quantity: number; subtotal: string }[],
): string {
  const lines = items
    .map((i) => `• ${i.display_name ?? '商品'} × ${i.quantity}  NT$${Number(i.subtotal).toLocaleString()}`)
    .join('\n');
  return `親愛的 ${order.recipient_name} 您好，\n\n您的訂單 ${order.order_number ?? ''} 已確認！\n\n${lines}\n\n合計：NT$${Number(order.total_amount).toLocaleString()}\n\n感謝您的惠顧！`;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const farmer = await getCurrentFarmer();

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.farmer_id, farmer.id)))
    .limit(1);

  if (!order) notFound();

  const triggerEvent = STATUS_TO_TRIGGER[order.status] as 'confirmed' | 'paid' | 'shipped' | undefined;

  const [itemRows, eventRows, templateRows, productList, customerRow, latestLogRow] = await Promise.all([
    db
      .select({
        product_id: orderItems.product_id,
        display_name: products.display_name,
        quantity: orderItems.quantity,
        unit_price: orderItems.unit_price,
        subtotal: orderItems.subtotal,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.product_id))
      .where(eq(orderItems.order_id, id)),

    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.order_id, id))
      .orderBy(desc(orderEvents.created_at)),

    db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.farmer_id, farmer.id), eq(notificationTemplates.is_active, true))),

    db
      .select()
      .from(products)
      .where(eq(products.farmer_id, farmer.id)),

    order.customer_id
      ? db
          .select({
            line_user_id: customers.line_user_id,
            line_display_name: customers.line_display_name,
          })
          .from(customers)
          .where(eq(customers.id, order.customer_id))
          .limit(1)
      : Promise.resolve([]),

    triggerEvent
      ? db
          .select({
            status: notificationLogs.status,
            trigger_event: notificationLogs.trigger_event,
            error_message: notificationLogs.error_message,
            sent_at: notificationLogs.sent_at,
            created_at: notificationLogs.created_at,
          })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.order_id, id),
              eq(notificationLogs.trigger_event, triggerEvent)
            )
          )
          .orderBy(desc(notificationLogs.created_at))
          .limit(1)
      : Promise.resolve([]),
  ]);

  type CustomerRow = { line_user_id: string | null; line_display_name: string | null };
  const customer = (customerRow as CustomerRow[])[0] ?? null;
  const customerLineUserId = customer?.line_user_id ?? null;
  const customerDisplayName = customer?.line_display_name ?? null;

  type RawLog = {
    status: string;
    trigger_event: string;
    error_message: string | null;
    sent_at: Date | null;
    created_at: Date | null;
  };
  const rawLog = (latestLogRow as RawLog[])[0] ?? null;
  const latestLog = rawLog
    ? {
        status: rawLog.status,
        trigger_event: rawLog.trigger_event,
        error_message: rawLog.error_message,
        sent_at: rawLog.sent_at?.toISOString() ?? null,
        created_at: rawLog.created_at?.toISOString() ?? null,
      }
    : null;

  const matchedTemplate = templateRows.find((t) => t.trigger_event === triggerEvent)
    ?? templateRows[0]
    ?? null;

  const itemsSummary = itemRows
    .map((i) => `${i.display_name ?? '商品'} × ${i.quantity}`)
    .join('、');

  const notificationText = matchedTemplate
    ? renderTemplate(matchedTemplate.template_text, {
        recipient_name: order.recipient_name,
        order_number: order.order_number ?? '',
        total_amount: `NT$${Number(order.total_amount).toLocaleString()}`,
        ship_date: order.ship_date ?? '',
        tracking_number: order.tracking_number ?? '',
        items_summary: itemsSummary,
        recipient_address: order.recipient_address ?? '',
        desired_arrival_date: order.desired_arrival_date ?? '',
        shipping_provider: order.shipping_provider ?? '',
      })
    : buildDefaultText(order, itemRows);

  return (
    <OrderDetailClient
      order={order}
      items={itemRows}
      events={eventRows}
      products={productList}
      notificationText={notificationText}
      triggerEvent={triggerEvent ?? 'confirmed'}
      customerLineUserId={customerLineUserId}
      customerDisplayName={customerDisplayName}
      latestLog={latestLog}
    />
  );
}
