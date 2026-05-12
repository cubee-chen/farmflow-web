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

// Estimated time of arrival for shipped notifications when the customer never
// specified one. 黑貓常態 D+1 到貨，所以 ship_date 隔天。
function estimateEtaFromShipDate(shipDate: string | null): string {
  if (!shipDate) return '';
  const d = new Date(`${shipDate}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  const iso = d.toISOString().slice(0, 10);
  return formatArrivalDate(iso);
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

  // shipped 通知的兩個常空欄位給合理 fallback，避免訊息出現「運送單號：，預計到貨日：」
  // 的破洞（farmer 在 acceptance 親眼看到的問題）。
  const trackingNumber = order.tracking_number?.trim()
    ? order.tracking_number
    : '出貨後另行通知';
  const arrival = order.desired_arrival_date
    ? formatArrivalDate(order.desired_arrival_date)
    : estimateEtaFromShipDate(order.ship_date);

  return {
    recipient_name: order.recipient_name,
    order_number: order.order_number ?? '',
    total_amount: `NT$${Number(order.total_amount).toLocaleString()}`,
    items_summary: itemsSummary,
    ship_date: order.ship_date ?? '',
    desired_arrival_date: arrival,
    tracking_number: trackingNumber,
    recipient_address: order.recipient_address ?? '',
    shipping_provider: order.shipping_provider ?? '',
  };
}
