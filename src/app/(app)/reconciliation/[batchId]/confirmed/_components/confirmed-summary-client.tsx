'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfirmedOrder {
  matchId: string;
  orderId: string;
  orderNumber: string | null;
  recipientName: string;
  txAmount: string;
  txDate: string;
  notificationText: string;
}

function fmt(amount: string) {
  return `NT$${Number(amount).toLocaleString()}`;
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
          複製收款通知
        </>
      )}
    </Button>
  );
}

export function ConfirmedSummaryClient({
  confirmedOrders,
}: {
  confirmedOrders: ConfirmedOrder[];
}) {
  return (
    <div className="space-y-6 max-w-lg">
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-4">
        <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">
            已確認 {confirmedOrders.length} 筆訂單為已付款
          </p>
          <p className="text-sm text-green-700 mt-0.5">可複製下方通知文案，透過 LINE 傳送給客戶</p>
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {confirmedOrders.map((o) => (
          <Card key={o.matchId}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800">{o.recipientName}</p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {o.orderNumber ?? '—'} · {o.txDate} · {fmt(o.txAmount)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/orders/${o.orderId}`}>
                  <Button size="sm" variant="ghost" className="text-xs h-7">
                    訂單
                  </Button>
                </Link>
                <CopyButton text={o.notificationText} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/reconciliation">
          <Button variant="outline">回對帳列表</Button>
        </Link>
        <Link href="/orders">
          <Button>前往訂單管理</Button>
        </Link>
      </div>
    </div>
  );
}
