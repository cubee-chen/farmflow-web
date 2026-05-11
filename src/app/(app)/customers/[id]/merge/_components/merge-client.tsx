'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { mergeCustomers } from '../../../actions';
import type { Customer } from '@/lib/db/schema';

type OtherCustomer = Pick<
  Customer,
  'id' | 'default_name' | 'line_display_name' | 'primary_phone' | 'total_orders' | 'total_amount'
>;

interface Props {
  source: Customer;
  others: OtherCustomer[];
}

function displayLabel(c: Pick<Customer, 'default_name' | 'line_display_name'>): string {
  return c.default_name ?? c.line_display_name ?? '（未命名）';
}

export function MergeClient({ source, others }: Props) {
  const router = useRouter();
  const [targetId, setTargetId] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const target = others.find((c) => c.id === targetId);
  const sourceTotal = Number(source.total_amount ?? 0);
  const sourceOrders = source.total_orders ?? 0;
  const targetTotal = Number(target?.total_amount ?? 0);
  const targetOrders = target?.total_orders ?? 0;

  function handleMerge() {
    if (!target) return;
    startTransition(async () => {
      const result = await mergeCustomers(source.id, target.id);
      if ('error' in result) {
        toast.error(result.error);
        setConfirmOpen(false);
      } else {
        toast.success('合併完成');
        router.push(`/customers/${result.targetId}`);
      }
    });
  }

  return (
    <div className="p-4 space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold">合併客戶</h1>
        <p className="text-sm text-zinc-500 mt-1">
          把來源客戶的所有訂單轉移到目標客戶，來源客戶將被刪除。
        </p>
      </div>

      {/* Source */}
      <Card className="border-red-200">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm text-red-600">來源（將被刪除）</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="font-medium">{displayLabel(source)}</div>
          <div className="text-sm text-zinc-500 mt-0.5">
            {source.primary_phone || '—'}
          </div>
          <div className="text-sm text-zinc-500 mt-1">
            {sourceOrders} 筆訂單 / NT${sourceTotal.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <ArrowDown className="size-5 text-zinc-400" />
      </div>

      {/* Target picker */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">目標客戶</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {others.length === 0 ? (
            <p className="text-sm text-zinc-400">沒有其他可合併的客戶。</p>
          ) : (
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">請選擇目標客戶…</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {displayLabel(c)}（{c.primary_phone || '—'}）— {c.total_orders ?? 0} 筆
                </option>
              ))}
            </select>
          )}

          {target && (
            <div className="rounded-md bg-zinc-50 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">目標目前訂單數</span>
                <span>{targetOrders} 筆</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">合併後訂單數</span>
                <span className="font-medium">{targetOrders + sourceOrders} 筆</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-1.5 mt-1.5">
                <span className="text-zinc-500">合併後累計金額</span>
                <span className="font-medium">
                  NT${(targetTotal + sourceTotal).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {target && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            來源客戶「{displayLabel(source)}」將被永久刪除，所有訂單將歸到目標客戶名下。此操作無法復原。
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" asChild>
          <Link href={`/customers/${source.id}`}>取消</Link>
        </Button>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={!target || isPending}
        >
          {isPending ? '合併中…' : '確認合併'}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認合併？</DialogTitle>
            <DialogDescription>
              將「{displayLabel(source)}」合併到「{target ? displayLabel(target) : ''}」。
              來源客戶會被永久刪除，所有訂單會轉移。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button onClick={handleMerge} disabled={isPending}>
              {isPending ? '合併中…' : '確認合併'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
