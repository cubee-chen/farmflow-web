const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatArrivalDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = DAY_NAMES[d.getDay()];
  return `${m}/${day} (週${weekday})`;
}

export interface OrderForVars {
  recipient_name: string;
  order_number: string | null;
  total_amount: string;
  ship_date: string | null;
  desired_arrival_date: string | null;
  tracking_number?: string | null;
  recipient_address?: string | null;
  shipping_provider?: string | null;
  items: { display_name: string | null; quantity: number }[];
}

export function buildOrderNotificationVars(
  order: OrderForVars
): Record<string, string> {
  const itemsSummary = order.items
    .map((i) => `${i.display_name ?? '商品'} × ${i.quantity}`)
    .join('、');

  return {
    recipient_name: order.recipient_name,
    order_number: order.order_number ?? '',
    total_amount: `NT$${Number(order.total_amount).toLocaleString()}`,
    items_summary: itemsSummary,
    ship_date: order.ship_date ?? '',
    desired_arrival_date: formatArrivalDate(order.desired_arrival_date),
    tracking_number: order.tracking_number ?? '',
    recipient_address: order.recipient_address ?? '',
    shipping_provider: order.shipping_provider ?? '',
  };
}
