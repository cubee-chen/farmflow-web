'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OrderDraftEditor, type ExistingOrderForEdit } from '@/components/shared/order-draft-editor';
import { StatusActions } from './status-actions';
import { NotificationSection } from './notification-section';
import { deleteOrder } from '@/app/(app)/orders/actions';
import type { Order, OrderEvent, Product } from '@/lib/db/schema';

const STATUS_LABEL: Record<string, string> = {
  draft: '待確認',
  confirmed: '已確認',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-200',
  confirmed: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  shipped: 'bg-green-100 text-green-700 hover:bg-green-100',
  completed: 'bg-zinc-900 text-white hover:bg-zinc-900',
  cancelled: 'bg-red-100 text-red-700 hover:bg-red-100',
};

const EVENT_ICON: Record<string, string> = {
  created: '📝',
  confirmed: '✅',
  updated: '✏️',
  paid: '💰',
  shipped: '📦',
  completed: '🎉',
  cancelled: '❌',
  payment_reply_received: '💬',
};

const EVENT_LABEL: Record<string, string> = {
  created: '訂單建立',
  confirmed: '確認訂單',
  updated: '訂單更新',
  paid: '確認收款',
  shipped: '標記已出貨',
  completed: '訂單完成',
  cancelled: '取消訂單',
  payment_reply_received: '客戶回覆付款',
};

const DELIVERY_PREF_LABEL: Record<string, string> = {
  any: '都可以',
  weekday: '只能平日',
  date: '指定日期',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transfer: '銀行轉帳',
  cod: '貨到付款',
};

const INTAKE_MODE_LABEL: Record<string, string> = {
  paste: '貼上文字',
  image: '圖片上傳',
  manual: '手動建立',
  webhook: 'LINE Webhook',
  line_webhook: '來自 LINE',
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-start gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="col-span-2">{children}</span>
    </div>
  );
}

function ImageGallery({ paths }: { paths: string[] }) {
  const [open, setOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  async function loadUrls() {
    if (signedUrls.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/storage/signed-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) throw new Error('Failed');
      const data: { signedUrls: string[] } = await res.json();
      setSignedUrls(data.signedUrls);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => { const next = !open; setOpen(next); if (next) loadUrls(); }}
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-700"
        >
          <span>上傳的截圖（{paths.length} 張）</span>
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {loading && <p className="col-span-3 text-xs text-zinc-400">載入中...</p>}
            {signedUrls.filter(Boolean).map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setModalUrl(url)}
                className="overflow-hidden rounded-md border border-zinc-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`截圖 ${i + 1}`} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <Dialog open={!!modalUrl} onOpenChange={() => setModalUrl(null)}>
          <DialogContent className="max-w-screen-md p-2">
            {modalUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={modalUrl} alt="截圖大圖" className="w-full rounded-md" />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export interface OrderItemRow {
  product_id: string;
  display_name: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface LatestLogData {
  status: string;
  trigger_event: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
}

interface Props {
  order: Order;
  items: OrderItemRow[];
  events: OrderEvent[];
  products: Product[];
  notificationText: string;
  triggerEvent: 'confirmed' | 'paid' | 'shipped';
  customerLineUserId: string | null;
  customerDisplayName: string | null;
  latestLog: LatestLogData | null;
}

export function OrderDetailClient({ order, items, events, products, notificationText, triggerEvent, customerLineUserId, customerDisplayName, latestLog }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const existingOrder: ExistingOrderForEdit = {
    id: order.id,
    items: items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
    })),
    recipient_name: order.recipient_name,
    recipient_phone: order.recipient_phone,
    recipient_address: order.recipient_address,
    delivery_zip: order.delivery_zip,
    delivery_preference: order.delivery_preference,
    desired_arrival_date: order.desired_arrival_date,
    payment_method: order.payment_method,
    bank_last_5: order.bank_last_5,
    notes: order.notes,
  };

  function handleSaved() {
    setIsEditing(false);
    router.refresh();
  }

  function handleDeleteConfirm() {
    startDelete(async () => {
      const result = await deleteOrder(order.id);
      if (result && 'error' in result) {
        toast.error(result.error);
        setShowDelete(false);
      }
      // On success, deleteOrder redirects — no need to handle here
    });
  }

  const relativeTime = order.created_at
    ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: zhTW })
    : '';

  if (isEditing) {
    return (
      <div className="p-4">
        <OrderDraftEditor
          existingOrder={existingOrder}
          products={products}
          onSaved={handleSaved}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-10">
      {/* Section 1: Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-lg">
            {order.order_number ?? '（草稿）'}
          </span>
          <Badge className={STATUS_CLASS[order.status] ?? ''}>
            {STATUS_LABEL[order.status] ?? order.status}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500">
          {relativeTime}
          {order.intake_mode && (
            <span className="ml-2">· {INTAKE_MODE_LABEL[order.intake_mode] ?? order.intake_mode}</span>
          )}
          {order.intake_mode === 'line_webhook' && customerDisplayName && (
            <span className="ml-1 text-zinc-700">· {customerDisplayName}</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setIsEditing(true)}>
            編輯
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setShowDelete(true)}>
            刪除
          </Button>
        </div>
      </div>

      {/* Section 2: Details */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">商品明細</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.display_name ?? '（已刪除商品）'} × {item.quantity}
              </span>
              <span className="font-medium">NT${Number(item.subtotal).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
            <span>合計</span>
            <span>NT${Number(order.total_amount).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">收件資訊</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <InfoRow label="收件人">{order.recipient_name}</InfoRow>
          <InfoRow label="電話">
            <a href={`tel:${order.recipient_phone}`} className="text-blue-600 hover:underline">
              {order.recipient_phone}
            </a>
          </InfoRow>
          {order.recipient_address && <InfoRow label="地址">{order.recipient_address}</InfoRow>}
          {order.delivery_zip && <InfoRow label="郵遞區號">{order.delivery_zip}</InfoRow>}
          {order.delivery_preference && (
            <InfoRow label="配送偏好">
              {DELIVERY_PREF_LABEL[order.delivery_preference] ?? order.delivery_preference}
              {order.desired_arrival_date ? `（${order.desired_arrival_date}）` : ''}
            </InfoRow>
          )}
          {order.ship_date && <InfoRow label="出貨日">{order.ship_date}</InfoRow>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">付款資訊</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <InfoRow label="付款方式">
            {PAYMENT_METHOD_LABEL[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
          </InfoRow>
          <InfoRow label="付款狀態">
            <span className={order.payment_status === 'paid' ? 'text-green-600 font-medium' : ''}>
              {order.payment_status === 'paid' ? '已收款' : '未收款'}
            </span>
            {order.paid_at && (
              <span className="ml-2 text-xs text-zinc-500">
                · {new Date(order.paid_at).toLocaleDateString('zh-TW')}
              </span>
            )}
          </InfoRow>
          {order.bank_last_5 && <InfoRow label="帳號末5碼">{order.bank_last_5}</InfoRow>}
          {order.shipping_provider && (
            <InfoRow label="物流">{order.shipping_provider}</InfoRow>
          )}
          {order.tracking_number && (
            <InfoRow label="追蹤號碼">{order.tracking_number}</InfoRow>
          )}
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">備註</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Image gallery for image-intake or LINE webhook orders carrying images */}
      {(order.intake_mode === 'image' || order.intake_mode === 'line_webhook') &&
        order.raw_image_urls && order.raw_image_urls.length > 0 && (
          <ImageGallery paths={order.raw_image_urls} />
        )}

      {/* Section 3: Status actions */}
      <StatusActions
        orderId={order.id}
        status={order.status}
        paymentStatus={order.payment_status ?? 'unpaid'}
      />

      {/* Section 4: Notification text */}
      <NotificationSection
        initialText={notificationText}
        recipientName={order.recipient_name}
        orderId={order.id}
        triggerEvent={triggerEvent}
        customerLineUserId={customerLineUserId}
        customerDisplayName={customerDisplayName}
        latestLog={latestLog}
      />

      {/* Section 5: Timeline */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">訂單事件</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400">暫無事件記錄</p>
          ) : (
            <ol className="space-y-3">
              {events.map((ev) => {
                const payload = ev.payload as Record<string, unknown> | null;
                const sourceNote =
                  ev.event_type === 'created' && payload?.source
                    ? `（透過 ${payload.source}）`
                    : '';
                const relTime = ev.created_at
                  ? formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: zhTW })
                  : '';

                return (
                  <li key={ev.id} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0">{EVENT_ICON[ev.event_type] ?? '·'}</span>
                    <span>
                      {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                      {sourceNote}
                      <span className="ml-2 text-zinc-400">{relTime}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Raw message (collapsible) */}
      {order.raw_text && (
        <details className="rounded-lg border border-zinc-200">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-600 select-none">
            {order.intake_mode === 'image' ? 'OCR 辨識文字' : '原始訊息'}
          </summary>
          <div className="px-4 pb-4 pt-2">
            <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-600 leading-relaxed">
              {order.raw_text}
            </pre>
          </div>
        </details>
      )}

      {/* Delete dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除訂單</DialogTitle>
            <DialogDescription>
              確定刪除這筆訂單？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} disabled={deletePending}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deletePending}>
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
