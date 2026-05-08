import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OrderWithItems } from '@/lib/queries/orders';

const STATUS_LABEL: Record<string, string> = {
  draft: '待確認',
  confirmed: '已確認',
  shipped: '已出貨',
  completed: '已完成',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-200',
  confirmed: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  shipped: 'bg-green-100 text-green-700 hover:bg-green-100',
  completed: 'bg-zinc-900 text-white hover:bg-zinc-900',
};

function itemSummary(items: { quantity: number; display_name: string }[]) {
  if (items.length === 0) return '—';
  return items.map((i) => `${i.display_name} × ${i.quantity}`).join('、');
}

export function OrderCard({ order }: { order: OrderWithItems }) {
  return (
    <Link href={`/orders/${order.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-700">
              {order.order_number ?? '（草稿）'}
            </span>
            <Badge className={STATUS_CLASS[order.status] ?? ''}>
              {STATUS_LABEL[order.status] ?? order.status}
            </Badge>
          </div>

          <div className="text-sm text-zinc-700">
            {order.recipient_name}
            {order.recipient_phone && (
              <>
                {' ｜ '}
                <a
                  href={`tel:${order.recipient_phone}`}
                  className="text-blue-600 underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {order.recipient_phone}
                </a>
              </>
            )}
          </div>

          <div className="text-xs text-zinc-500 line-clamp-1">{itemSummary(order.items)}</div>

          <div className="flex items-center justify-between mt-1">
            <span className="font-bold text-sm">
              NT${Number(order.total_amount).toLocaleString()}
            </span>
            {order.ship_date && (
              <span className="text-xs text-zinc-500">出貨：{order.ship_date}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
