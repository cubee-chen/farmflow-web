'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchStatus =
  | 'matched'
  | 'amount_mismatch'
  | 'multi_candidate'
  | 'unmatched'
  | 'manual_override';

interface MatchRow {
  id: string;
  matchStatus: MatchStatus;
  confidence: string | null;
  candidates: string[] | null;
  orderId: string | null;
  resolvedBy: string | null;
  tx: {
    id: string;
    txDate: string;
    amount: string;
    accountLast5: string | null;
    memo: string | null;
  };
  order: {
    orderNumber: string | null;
    recipientName: string;
    totalAmount: string;
  } | null;
}

interface CandidateOrder {
  id: string;
  orderNumber: string | null;
  recipientName: string;
  totalAmount: string;
}

interface BatchDetail {
  batch: {
    id: string;
    source: string;
    uploadedFilename: string | null;
    rowCount: number;
    matchedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    status: string;
    createdAt: string;
  };
  matches: MatchRow[];
  candidateOrders: CandidateOrder[];
}

interface EligibleOrder {
  id: string;
  orderNumber: string | null;
  recipientName: string;
  recipientPhone: string;
  totalAmount: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: string | null | undefined) {
  if (!amount) return '—';
  return `NT$${Number(amount).toLocaleString()}`;
}

function confidenceDot(conf: string | null) {
  const v = parseFloat(conf ?? '0');
  if (v >= 0.9) return 'bg-green-500';
  if (v >= 0.8) return 'bg-green-300';
  if (v >= 0.5) return 'bg-yellow-400';
  return 'bg-zinc-300';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BatchDetailClient({ batchId }: { batchId: string }) {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading, error } = useQuery<BatchDetail>({
    queryKey: ['reconciliation', 'batch', batchId],
    queryFn: () => fetch(`/api/reconciliation/${batchId}`).then((r) => r.json()),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ matchId, orderId }: { matchId: string; orderId: string | null }) =>
      fetch(`/api/reconciliation/${batchId}/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation', 'batch', batchId] });
      qc.invalidateQueries({ queryKey: ['reconciliation', 'batches'] });
      toast.success('已更新');
    },
    onError: () => toast.error('操作失敗'),
  });

  const rerunMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/reconciliation/${batchId}/run-match`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation', 'batch', batchId] });
      toast.success('重新配對完成');
    },
    onError: () => toast.error('重新配對失敗'),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reconciliation/${batchId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '確認失敗');
      return data as { confirmedCount: number; orderIds: string[] };
    },
    onSuccess: (data) => {
      toast.success(`已確認 ${data.confirmedCount} 筆訂單為已付款`);
      qc.invalidateQueries({ queryKey: ['reconciliation', 'batch', batchId] });
      qc.invalidateQueries({ queryKey: ['reconciliation', 'batches'] });
      router.push(`/reconciliation/${batchId}/confirmed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Local UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<string | null>(null); // matchId
  const [rerunOpen, setRerunOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) return <p className="text-zinc-500 text-sm">載入失敗，請重新整理</p>;

  const { batch, matches, candidateOrders } = data;
  const candidateMap = Object.fromEntries(candidateOrders.map((o) => [o.id, o]));

  const matchedRows = matches.filter(
    (m) => (m.matchStatus === 'matched' || m.matchStatus === 'manual_override') && m.orderId
  );
  const pendingRows = matches.filter(
    (m) => m.matchStatus === 'multi_candidate' || m.matchStatus === 'amount_mismatch'
  );
  const unmatchedRows = matches.filter(
    (m) =>
      m.matchStatus === 'unmatched' ||
      (m.matchStatus === 'manual_override' && !m.orderId)
  );

  function handleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setSelectedCandidate(null);
  }

  function handleOverride(matchId: string, orderId: string | null) {
    overrideMutation.mutate({ matchId, orderId });
    setExpandedId(null);
    setAssignTarget(null);
    setSelectedCandidate(null);
  }

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="上傳總筆數" value={batch.rowCount} />
        <StatCard label="已配對" value={matchedRows.length} color="text-green-700" />
        <StatCard label="待處理" value={pendingRows.length} color="text-yellow-700" />
        <StatCard label="未配對" value={unmatchedRows.length} color="text-red-600" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="matched">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="matched">已配對（{matchedRows.length}）</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            待處理
            {pendingRows.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                {pendingRows.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unmatched">未配對（{unmatchedRows.length}）</TabsTrigger>
        </TabsList>

        {/* ── Matched tab ── */}
        <TabsContent value="matched" className="mt-3 space-y-2">
          {matchedRows.length === 0 && <EmptyState text="尚無已配對項目" />}
          {/* Desktop header */}
          {matchedRows.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-[90px_90px_1fr_1fr_70px_80px] gap-3 px-3 py-1 text-xs font-medium text-zinc-400 uppercase">
              <span>日期</span><span>金額</span><span>訂單</span>
              <span>收件人</span><span>信心</span><span />
            </div>
          )}
          {matchedRows.map((m) => {
            const conf = parseFloat(m.confidence ?? '0');
            const rowBg = conf >= 0.9 ? 'bg-green-50' : conf >= 0.8 ? 'bg-emerald-50/60' : '';
            return (
              <div
                key={m.id}
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  rowBg
                )}
              >
                {/* Mobile stacked */}
                <div className="sm:hidden space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{m.tx.txDate}</span>
                    <span className="font-semibold">{fmt(m.tx.amount)}</span>
                  </div>
                  <p className="text-zinc-700">{m.order?.recipientName}</p>
                  <p className="text-xs text-zinc-400 font-mono">{m.order?.orderNumber ?? '—'}</p>
                  <div className="flex items-center justify-between mt-1">
                    <ConfidenceDot value={m.confidence} />
                    <UnlinkButton
                      loading={overrideMutation.isPending}
                      onClick={() => handleOverride(m.id, null)}
                    />
                  </div>
                </div>
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[90px_90px_1fr_1fr_70px_80px] gap-3 items-center text-sm">
                  <span className="text-zinc-500">{m.tx.txDate}</span>
                  <span className="font-semibold">{fmt(m.tx.amount)}</span>
                  <span className="font-mono text-xs text-zinc-600 truncate">
                    {m.order?.orderNumber ?? '—'}
                  </span>
                  <span className="text-zinc-700 truncate">{m.order?.recipientName}</span>
                  <ConfidenceDot value={m.confidence} />
                  <div className="flex justify-end">
                    <UnlinkButton
                      loading={overrideMutation.isPending}
                      onClick={() => handleOverride(m.id, null)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* ── Pending tab ── */}
        <TabsContent value="pending" className="mt-3 space-y-2">
          {pendingRows.length === 0 && <EmptyState text="無待處理項目" />}
          {pendingRows.map((m) => {
            const isExpanded = expandedId === m.id;
            const rowCandidates = (m.candidates ?? []).map((id) => candidateMap[id]).filter(Boolean) as CandidateOrder[];
            const statusLabel = m.matchStatus === 'amount_mismatch' ? '金額不符' : '多個候選';
            return (
              <div key={m.id} className="rounded-lg border overflow-hidden">
                {/* Row header */}
                <button
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-zinc-50 text-sm text-left"
                  onClick={() => handleExpand(m.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-zinc-500 shrink-0">{m.tx.txDate}</span>
                    <span className="font-semibold shrink-0">{fmt(m.tx.amount)}</span>
                    {m.tx.memo && (
                      <span className="text-zinc-400 text-xs truncate">{m.tx.memo}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                      {statusLabel}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {/* Expanded candidates */}
                {isExpanded && (
                  <div className="border-t bg-zinc-50 px-3 py-3 space-y-3">
                    <p className="text-xs font-medium text-zinc-500">選擇對應訂單：</p>
                    {rowCandidates.length === 0 && (
                      <p className="text-xs text-zinc-400">無候選訂單資料</p>
                    )}
                    <div className="space-y-2">
                      {rowCandidates.map((o) => (
                        <label
                          key={o.id}
                          className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 cursor-pointer hover:bg-zinc-50 text-sm"
                        >
                          <input
                            type="radio"
                            name={`candidate-${m.id}`}
                            value={o.id}
                            checked={selectedCandidate === o.id}
                            onChange={() => setSelectedCandidate(o.id)}
                            className="accent-emerald-600"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-mono text-xs text-zinc-500 mr-2">
                              {o.orderNumber ?? '—'}
                            </span>
                            {o.recipientName}
                          </span>
                          <span className="text-zinc-500 shrink-0">{fmt(o.totalAmount)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOverride(m.id, null)}
                        disabled={overrideMutation.isPending}
                      >
                        都不是
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedCandidate) handleOverride(m.id, selectedCandidate);
                        }}
                        disabled={!selectedCandidate || overrideMutation.isPending}
                      >
                        手動配對
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* ── Unmatched tab ── */}
        <TabsContent value="unmatched" className="mt-3 space-y-2">
          {unmatchedRows.length === 0 && <EmptyState text="無未配對項目" />}
          {unmatchedRows.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-[90px_90px_80px_1fr_100px] gap-3 px-3 py-1 text-xs font-medium text-zinc-400 uppercase">
              <span>日期</span><span>金額</span><span>末五碼</span><span>備註</span><span />
            </div>
          )}
          {unmatchedRows.map((m) => (
            <div key={m.id} className="rounded-lg border px-3 py-2.5 text-sm">
              {/* Mobile */}
              <div className="sm:hidden space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">{m.tx.txDate}</span>
                  <span className="font-semibold">{fmt(m.tx.amount)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  {m.tx.accountLast5 && <span>末五碼：{m.tx.accountLast5}</span>}
                  {m.tx.memo && <span className="truncate">{m.tx.memo}</span>}
                </div>
                <div className="flex justify-end mt-1">
                  <AssignButton onClick={() => setAssignTarget(m.id)} />
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden sm:grid sm:grid-cols-[90px_90px_80px_1fr_100px] gap-3 items-center">
                <span className="text-zinc-500">{m.tx.txDate}</span>
                <span className="font-semibold">{fmt(m.tx.amount)}</span>
                <span className="font-mono text-xs text-zinc-500">
                  {m.tx.accountLast5 ?? '—'}
                </span>
                <span className="text-zinc-500 truncate text-xs">{m.tx.memo ?? '—'}</span>
                <div className="flex justify-end">
                  <AssignButton onClick={() => setAssignTarget(m.id)} />
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-10 bg-white border-t px-4 py-3 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRerunOpen(true)}
          disabled={rerunMutation.isPending || batch.status === 'confirmed'}
        >
          {rerunMutation.isPending ? '配對中…' : '重新跑匹配'}
        </Button>
        <Button
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={batch.status === 'confirmed' || confirmMutation.isPending}
        >
          {batch.status === 'confirmed' ? '已確認' : '確認對帳'}
        </Button>
      </div>

      {/* Re-run dialog */}
      <AlertDialog open={rerunOpen} onOpenChange={setRerunOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新跑匹配？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將清除所有手動調整紀錄，重新自動配對所有交易。確定繼續？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRerunOpen(false);
                rerunMutation.mutate();
              }}
            >
              確定重跑
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認對帳</AlertDialogTitle>
            <AlertDialogDescription>
              將更新 <strong>{matchedRows.length}</strong>{' '}
              筆訂單的付款狀態為「已付款」，此操作無法復原。確定繼續？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                confirmMutation.mutate();
              }}
            >
              確定確認
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign order dialog */}
      <AssignOrderDialog
        open={!!assignTarget}
        batchId={batchId}
        onClose={() => setAssignTarget(null)}
        onAssign={(orderId) => {
          if (assignTarget) handleOverride(assignTarget, orderId);
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = 'text-zinc-800',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={cn('text-2xl font-bold', color)}>{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function ConfidenceDot({ value }: { value: string | null }) {
  const pct = Math.round(parseFloat(value ?? '0') * 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('inline-block rounded-full w-2 h-2', confidenceDot(value))} />
      <span className="text-xs text-zinc-500">{pct}%</span>
    </div>
  );
}

function UnlinkButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-xs text-zinc-400 hover:text-red-600 h-7"
      onClick={onClick}
      disabled={loading}
    >
      取消配對
    </Button>
  );
}

function AssignButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="text-xs h-7"
      onClick={onClick}
    >
      手動指定訂單
    </Button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-zinc-400 text-center py-8">{text}</p>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-zinc-100" />
        ))}
      </div>
      <div className="h-8 w-64 rounded bg-zinc-100" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

function AssignOrderDialog({
  open,
  onClose,
  onAssign,
}: {
  open: boolean;
  batchId: string;
  onClose: () => void;
  onAssign: (orderId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const { data: orders = [] } = useQuery<EligibleOrder[]>({
    queryKey: ['reconciliation', 'eligible-orders', q],
    queryFn: () =>
      fetch(`/api/reconciliation/eligible-orders?q=${encodeURIComponent(q)}`).then((r) =>
        r.json()
      ),
    enabled: open,
    staleTime: 30_000,
  });

  function handleConfirm() {
    if (selected) {
      onAssign(selected);
      setSelected(null);
      setQ('');
    }
  }

  function handleClose() {
    setSelected(null);
    setQ('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>手動指定訂單</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="搜尋收件人姓名或電話…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3"
        />

        <div className="max-h-72 overflow-y-auto space-y-1">
          {orders.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-6">無符合的未付款訂單</p>
          )}
          {orders.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-zinc-50 text-sm"
            >
              <input
                type="radio"
                name="assign-order"
                value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
                className="accent-emerald-600"
              />
              <span className="flex-1 min-w-0">
                <span className="font-mono text-xs text-zinc-400 mr-2">
                  {o.orderNumber ?? '草稿'}
                </span>
                {o.recipientName}
                {o.recipientPhone && (
                  <span className="text-zinc-400 ml-1">{o.recipientPhone}</span>
                )}
              </span>
              <span className="text-zinc-500 shrink-0">{fmt(o.totalAmount)}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            確認配對
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
