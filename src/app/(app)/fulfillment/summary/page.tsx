import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { getShippingSummary } from '@/lib/queries/summary';
import { SummaryControls } from './_components/summary-controls';

const PRINT_STYLES = `
@media print {
  header,
  nav[aria-label="主導覽"],
  .no-print {
    display: none !important;
  }
  body, main {
    display: block !important;
    overflow: visible !important;
    height: auto !important;
    max-width: 100% !important;
  }
  .print-grid {
    grid-template-columns: repeat(3, 1fr) !important;
  }
  .print-product-qty {
    font-size: 24pt !important;
    font-weight: 700 !important;
  }
  a { color: inherit !important; text-decoration: none !important; }
}
`;

const DELIVERY_PREF_LABEL: Record<string, string> = {
  morning: '上午配達',
  afternoon: '下午配達',
  do_not_ring: '勿按鈴',
  leave_at_door: '放門口',
};

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function truncateAddress(addr: string | null) {
  if (!addr) return '—';
  return addr.length > 15 ? `${addr.slice(0, 15)}…` : addr;
}

function itemSummary(items: { display_name: string; quantity: number }[]) {
  if (items.length === 0) return '—';
  return items.map((i) => `${i.display_name} × ${i.quantity}`).join('、');
}

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function SummaryPage({ searchParams }: Props) {
  const farmer = await getCurrentFarmer();
  const { date = getTomorrow() } = await searchParams;

  const { products, orders } = await getShippingSummary(farmer.id, date);

  const totalQty = products.reduce((s, p) => s + p.total_qty, 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="pb-8">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">出貨彙總</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {date}・{orders.length} 筆訂單・共 {totalQty} 件
              </p>
            </div>
            <Link
              href="/fulfillment"
              className="no-print text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
            >
              ← 返回出貨管理
            </Link>
          </div>
          <SummaryControls date={date} />
        </div>

        {/* Block 1: Product totals */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">商品總量</h2>
          {products.length === 0 ? (
            <p className="text-zinc-500 text-sm">尚無商品</p>
          ) : (
            <div className="print-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-4 flex flex-col gap-2 ${
                    p.total_qty > 0
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-zinc-100 bg-zinc-50 opacity-50'
                  }`}
                >
                  {p.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt={p.display_name}
                      className="w-full h-16 object-cover rounded"
                    />
                  )}
                  <span className="text-sm font-medium text-zinc-700 leading-tight line-clamp-2">
                    {p.display_name}
                  </span>
                  <div>
                    <span className="print-product-qty text-3xl font-bold text-zinc-900">
                      {p.total_qty}
                    </span>
                    <span className="text-sm text-zinc-500 ml-1">件</span>
                  </div>
                  {p.total_qty > 0 && p.weight_g && (
                    <span className="text-xs text-zinc-400">
                      {(p.total_weight_kg).toFixed(2)} kg
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Block 2: Order list */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            訂單清單（依郵遞區號排序）
          </h2>
          {orders.length === 0 ? (
            <p className="text-zinc-500 text-sm">該日無待出貨訂單</p>
          ) : (
            <div className="flex flex-col gap-2">
              {orders.map((order, idx) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:shadow-sm transition-shadow no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-zinc-400 font-mono">#{idx + 1}</span>
                        {order.delivery_zip && (
                          <span className="text-xs font-mono text-zinc-500">
                            {order.delivery_zip}
                          </span>
                        )}
                        <span className="font-semibold text-sm text-zinc-800">
                          {order.recipient_name}
                        </span>
                        <span className="text-sm text-zinc-500">
                          ****{order.recipient_phone.slice(-4)}
                        </span>
                        {order.delivery_preference && (
                          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs">
                            {DELIVERY_PREF_LABEL[order.delivery_preference] ??
                              order.delivery_preference}
                          </Badge>
                        )}
                        {order.payment_status !== 'paid' && (
                          <Badge className="bg-orange-50 text-orange-600 hover:bg-orange-50 text-xs">
                            未付款
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mb-1">
                        {truncateAddress(order.recipient_address)}
                      </div>
                      <div className="text-sm text-zinc-700">
                        {itemSummary(order.items)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-zinc-900">
                        NT${Number(order.total_amount).toLocaleString()}
                      </div>
                      {order.order_number && (
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">
                          {order.order_number}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
