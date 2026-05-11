'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MatchRow {
  id: string;
  matchStatus: string;
  orderId: string | null;
  order: {
    orderNumber: string | null;
    recipientName: string;
    totalAmount: string;
  } | null;
  tx: { amount: string; txDate: string };
}

interface BatchDetail {
  batch: { id: string; status: string; uploadedFilename: string | null };
  matches: MatchRow[];
}

function fmt(amount: string) {
  return `NT$${Number(amount).toLocaleString()}`;
}

export function ConfirmedSummaryClient({ batchId }: { batchId: string }) {
  const { data, isLoading } = useQuery<BatchDetail>({
    queryKey: ['reconciliation', 'batch', batchId],
    queryFn: () => fetch(`/api/reconciliation/${batchId}`).then((r) => r.json()),
  });

  if (isLoading) return <p className="text-sm text-zinc-400">載入中…</p>;
  if (!data) return <p className="text-sm text-zinc-400">載入失敗，請重新整理</p>;

  const confirmedRows = data.matches.filter(
    (m) => (m.matchStatus === 'matched' || m.matchStatus === 'manual_override') && m.orderId
  );

  return (
    <div className="space-y-6 max-w-lg">
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-4">
        <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">
            已將 {confirmedRows.length} 筆訂單標為已付款
          </p>
          <p className="text-sm text-green-700 mt-0.5">記得通知客戶付款已收到</p>
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {confirmedRows.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800">{m.order?.recipientName}</p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {m.order?.orderNumber ?? '—'} · {m.tx.txDate}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-zinc-700">
                  {fmt(m.tx.amount)}
                </span>
                {m.orderId && (
                  <Link href={`/orders/${m.orderId}`}>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      查看訂單
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/reconciliation">
          <Button variant="outline">返回對帳列表</Button>
        </Link>
        <Link href="/orders">
          <Button>前往訂單管理</Button>
        </Link>
      </div>
    </div>
  );
}
