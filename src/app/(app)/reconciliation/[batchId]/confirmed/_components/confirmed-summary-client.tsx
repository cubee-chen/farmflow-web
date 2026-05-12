'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, Check, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { manualDispatchNotification } from '@/app/(app)/orders/actions';

interface ConfirmedOrder {
  matchId: string;
  orderId: string;
  orderNumber: string | null;
  recipientName: string;
  txAmount: string;
  txDate: string;
  notificationText: string;
  hasLineBinding: boolean;
  pushStatus: string | null;
  pushError: string | null;
  pushSentAt: string | null;
}

function fmt(amount: string) {
  return `NT$${Number(amount).toLocaleString()}`;
}

function StatusBadge({ order }: { order: ConfirmedOrder }) {
  if (order.pushStatus === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
        <CheckCircle2 className="h-3 w-3" /> 已自動推播
      </span>
    );
  }
  if (order.pushStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
        <AlertCircle className="h-3 w-3" /> 推播失敗
      </span>
    );
  }
  if (order.pushStatus === 'skipped' || !order.hasLineBinding) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
        {order.hasLineBinding ? '略過推播' : '未綁定 LINE'}
      </span>
    );
  }
  return null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="text-xs h-7 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 mr-1 text-green-600" />
          已複製
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 mr-1" />
          複製
        </>
      )}
    </Button>
  );
}

function PushButton({
  orderId,
  disabled,
  variant,
  label,
}: {
  orderId: string;
  disabled: boolean;
  variant?: 'default' | 'secondary';
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handlePush() {
    startTransition(async () => {
      const result = await manualDispatchNotification(orderId, 'paid');
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      if (result.status === 'sent') toast.success('已推播 LINE 收款通知');
      else if (result.status === 'skipped') toast.message(`略過：${result.reason ?? ''}`);
      else toast.error(`推播失敗：${result.reason ?? '未知'}`);
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant={variant ?? 'default'}
      className="text-xs h-7 shrink-0"
      onClick={handlePush}
      disabled={disabled || pending}
    >
      <Send className="h-3 w-3 mr-1" />
      {pending ? '推送中…' : label}
    </Button>
  );
}

export function ConfirmedSummaryClient({
  confirmedOrders,
}: {
  confirmedOrders: ConfirmedOrder[];
}) {
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();

  const retriable = confirmedOrders.filter(
    (o) => o.hasLineBinding && o.pushStatus !== 'sent'
  );

  const sentCount = confirmedOrders.filter((o) => o.pushStatus === 'sent').length;
  const totalWithLine = confirmedOrders.filter((o) => o.hasLineBinding).length;

  function handleBulkPush() {
    startBulk(async () => {
      let sent = 0;
      let skipped = 0;
      let failed = 0;
      for (const o of retriable) {
        const result = await manualDispatchNotification(o.orderId, 'paid');
        if ('error' in result) {
          failed++;
        } else if (result.status === 'sent') sent++;
        else if (result.status === 'skipped') skipped++;
        else failed++;
      }
      const parts: string[] = [];
      if (sent > 0) parts.push(`已推播 ${sent} 筆`);
      if (skipped > 0) parts.push(`略過 ${skipped} 筆`);
      if (failed > 0) parts.push(`失敗 ${failed} 筆`);
      toast.success(parts.join('，') || '無動作');
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-4">
        <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-green-800">
            已確認 {confirmedOrders.length} 筆訂單為已付款
          </p>
          <p className="text-sm text-green-700 mt-0.5">
            系統已自動推播 {sentCount}/{totalWithLine} 筆 LINE 收款通知。
            {confirmedOrders.length - totalWithLine > 0 &&
              `（${confirmedOrders.length - totalWithLine} 筆未綁定 LINE，可複製文案手動傳送）`}
          </p>
        </div>
      </div>

      {/* Bulk action */}
      {retriable.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <div className="text-sm">
            有 <span className="font-semibold">{retriable.length}</span> 筆尚未成功推播
          </div>
          <Button
            size="sm"
            onClick={handleBulkPush}
            disabled={bulkPending}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {bulkPending ? '推送中…' : `全部推播 (${retriable.length})`}
          </Button>
        </div>
      )}

      {/* Order list */}
      <div className="space-y-2">
        {confirmedOrders.map((o) => (
          <Card key={o.matchId}>
            <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-800">{o.recipientName}</p>
                  <StatusBadge order={o} />
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {o.orderNumber ?? '—'} · {o.txDate} · {fmt(o.txAmount)}
                </p>
                {o.pushError && (
                  <p className="text-[11px] text-red-600 mt-0.5 line-clamp-1">
                    {o.pushError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/orders/${o.orderId}`}>
                  <Button size="sm" variant="ghost" className="text-xs h-7">
                    訂單
                  </Button>
                </Link>
                <CopyButton text={o.notificationText} />
                {o.hasLineBinding && (
                  <PushButton
                    orderId={o.orderId}
                    disabled={false}
                    variant={o.pushStatus === 'sent' ? 'secondary' : 'default'}
                    label={o.pushStatus === 'sent' ? '重發' : '推播'}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/reconciliation">
          <Button variant="outline">回對帳列表</Button>
        </Link>
        <Link href="/fulfillment">
          <Button>前往待出貨</Button>
        </Link>
      </div>
    </div>
  );
}
