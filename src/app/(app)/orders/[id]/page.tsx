import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, orderEvents, products, notificationTemplates, customers } from '@/lib/db/schema';
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

  const [itemRows, eventRows, templateRows, productList, customerRow] = await Promise.all([
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
          .select({ line_user_id: customers.line_user_id })
          .from(customers)
          .where(eq(customers.id, order.customer_id))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const customerLineUserId = (customerRow as { line_user_id: string | null }[])[0]?.line_user_id ?? null;
  const triggerEvent = STATUS_TO_TRIGGER[order.status] as 'confirmed' | 'paid' | 'shipped' | undefined;
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
    />
  );
}
