'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { FulfillmentOrder } from '@/lib/queries/fulfillment';

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '已付款',
  unpaid: '未付款',
  partial: '部分付款',
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 hover:bg-green-100',
  unpaid: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  partial: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
};

function itemSummary(items: { display_name: string; quantity: number }[]) {
  if (items.length === 0) return '—';
  return items.map((i) => `${i.display_name} × ${i.quantity}`).join('、');
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const STAGE_CHIPS = [
  { label: '待備貨', value: 'todo', desc: '已確認且已付款，尚未下載 Excel' },
  { label: '已備貨', value: 'packing', desc: '已下載 Excel，等待出貨' },
];

const FILTER_CHIPS = [
  { label: '只看已付款', value: 'paid_only' },
  { label: '含未付款', value: 'all' },
];

type Stage = 'todo' | 'packing' | 'all';

interface Props {
  orders: FulfillmentOrder[];
  activeStage: Stage;
  activeFilter: string;
}

export function FulfillmentClient({ orders, activeStage, activeFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shipDate, setShipDate] = useState(getTomorrow);
  const [isDownloading, setIsDownloading] = useState(false);
  const [packingDialogOpen, setPackingDialogOpen] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [isMarking, setIsMarking] = useState(false);
  const [shippedDialogOpen, setShippedDialogOpen] = useState(false);
  const [isShipping, setIsShipping] = useState(false);

  const pushQuery = useCallback(
    (next: { stage?: Stage; filter?: string }) => {
      const params = new URLSearchParams();
      const stage = next.stage ?? activeStage;
      const filter = next.filter ?? activeFilter;
      if (stage !== 'todo') params.set('stage', stage);
      if (filter !== 'paid_only') params.set('filter', filter);
      const qs = params.toString();
      router.push(pathname + (qs ? `?${qs}` : ''));
    },
    [router, pathname, activeStage, activeFilter]
  );

  const allIds = orders.map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDownload() {
    const ids = someSelected ? [...selectedIds] : allIds;
    if (ids.length === 0) {
      toast.error('沒有可下載的訂單');
      return;
    }

    setIsDownloading(true);
    try {
      const res = await fetch('/api/shipping/tcat-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids, shipDate }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? '匯出失敗');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = shipDate.replace(/-/g, '');
      a.download = `tcat-export-${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Excel 已下載，請打開黑貓系統 → 批次匯入');
      setDownloadedIds(ids);
      setPackingDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下載失敗');
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleMarkPacking() {
    setIsMarking(true);
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: downloadedIds, status: 'packing' }),
      });
      if (!res.ok) throw new Error('更新失敗');
      toast.success(`已將 ${downloadedIds.length} 筆訂單標記為「備貨中」`);
      setPackingDialogOpen(false);
      setSelectedIds(new Set());
      // Stay on /fulfillment but switch to the packing stage so the farmer
      // sees where the orders moved to (instead of an empty "待備貨" list).
      pushQuery({ stage: 'packing' });
    } catch {
      toast.error('標記失敗，請稍後重試');
    } finally {
      setIsMarking(false);
    }
  }

  async function handleBulkShipped() {
    const ids = someSelected ? [...selectedIds] : allIds;
    if (ids.length === 0) {
      toast.error('沒有可標記的訂單');
      return;
    }

    setIsShipping(true);
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids, status: 'shipped', dispatch: true }),
      });
      if (!res.ok) throw new Error('更新失敗');
      const data = (await res.json()) as { updated: number; dispatched?: number };
      const dispatchedNote =
        typeof data.dispatched === 'number' ? `，已推播 ${data.dispatched} 則 LINE 通知` : '';
      toast.success(`已將 ${data.updated} 筆訂單標記為「已出貨」${dispatchedNote}`);
      setShippedDialogOpen(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      toast.error('標記失敗，請稍後重試');
    } finally {
      setIsShipping(false);
    }
  }

  const exportCount = someSelected ? selectedIds.size : allIds.length;
  const showPackingActions = activeStage === 'packing';

  return (
    <>
      {/* Stage chips */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STAGE_CHIPS.map((chip) => {
            const active = activeStage === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => pushQuery({ stage: chip.value as Stage })}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Date picker + paid filter (only meaningful in "todo" stage) */}
        {activeStage === 'todo' && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-zinc-700 shrink-0">選擇出貨日</label>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="h-9 rounded-md border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {FILTER_CHIPS.map((chip) => {
                const active = activeFilter === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => pushQuery({ filter: chip.value })}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Select all row */}
      {orders.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            id="select-all"
          />
          <label htmlFor="select-all" className="text-sm text-zinc-600 cursor-pointer select-none">
            全選（共 {orders.length} 筆）
            {someSelected && !allSelected && `，已選 ${selectedIds.size} 筆`}
          </label>
        </div>
      )}

      {/* Order list */}
      {orders.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          <p>{showPackingActions ? '目前沒有備貨中的訂單' : '目前沒有待出貨訂單'}</p>
          <p className="text-sm mt-1">
            {showPackingActions
              ? '下載黑貓 Excel 並標記為「備貨中」後會出現在這裡'
              : '已確認且已付款的訂單會出現在這裡'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => toggleOne(order.id)}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                selectedIds.has(order.id)
                  ? 'border-zinc-900 bg-zinc-50'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(order.id)}
                  onCheckedChange={() => toggleOne(order.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-zinc-700 truncate">
                      {order.order_number ?? '（草稿）'}
                    </span>
                    <Badge
                      className={
                        PAYMENT_STATUS_CLASS[order.payment_status ?? ''] ?? 'bg-zinc-100 text-zinc-600'
                      }
                    >
                      {PAYMENT_STATUS_LABEL[order.payment_status ?? ''] ?? order.payment_status}
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-800 font-medium">
                    {order.recipient_name}
                    {order.recipient_phone && (
                      <span className="text-zinc-500 font-normal"> | {order.recipient_phone}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                    {itemSummary(order.items)}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-sm font-bold">
                      NT${Number(order.total_amount).toLocaleString()}
                    </span>
                    {order.ship_date && (
                      <span className="text-xs text-zinc-400">出貨：{order.ship_date}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky bottom bar — main action depends on stage */}
      <div className="fixed bottom-16 left-0 right-0 lg:left-56 bg-white border-t shadow-lg px-4 py-3 flex gap-3 z-10">
        {showPackingActions ? (
          <Button
            onClick={() => setShippedDialogOpen(true)}
            disabled={isShipping || orders.length === 0}
            className="flex-1"
          >
            標記已出貨{exportCount > 0 ? `（${exportCount} 筆）` : ''}
          </Button>
        ) : (
          <Button
            onClick={handleDownload}
            disabled={isDownloading || orders.length === 0}
            className="flex-1"
          >
            {isDownloading
              ? '產生中…'
              : `下載黑貓批次 Excel${exportCount > 0 ? `（${exportCount} 筆）` : ''}`}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => router.push(`/fulfillment/summary?date=${shipDate}`)}
          className="shrink-0"
        >
          出貨彙總表
        </Button>
      </div>

      {/* Mark as packing dialog */}
      <Dialog open={packingDialogOpen} onOpenChange={setPackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新訂單狀態</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            將這 <span className="font-semibold">{downloadedIds.length}</span> 筆訂單標記為「備貨中」？
            <br />
            標記後會切到「已備貨」頁籤，可在那裡批次標記已出貨。
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPackingDialogOpen(false)} disabled={isMarking}>
              略過
            </Button>
            <Button onClick={handleMarkPacking} disabled={isMarking}>
              {isMarking ? '更新中…' : '確認備貨中'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as shipped dialog */}
      <Dialog open={shippedDialogOpen} onOpenChange={setShippedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批次標記為「已出貨」</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            將這 <span className="font-semibold">{exportCount}</span> 筆訂單標記為「已出貨」？
            <br />
            系統會自動推播 LINE 出貨通知給已綁定的客戶。
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShippedDialogOpen(false)} disabled={isShipping}>
              取消
            </Button>
            <Button onClick={handleBulkShipped} disabled={isShipping}>
              {isShipping ? '處理中…' : '確認已出貨'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
