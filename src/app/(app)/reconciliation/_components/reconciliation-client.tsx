'use client';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';

type BatchSummary = {
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

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  confirmed: '已確認',
  discarded: '已丟棄',
};
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-orange-100 text-orange-700',
  confirmed: 'bg-green-100 text-green-700',
  discarded: 'bg-zinc-100 text-zinc-500',
};

export function ReconciliationClient() {
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('postal');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: batches = [], isLoading } = useQuery<BatchSummary[]>({
    queryKey: ['reconciliation', 'batches'],
    queryFn: () => fetch('/api/reconciliation/batches').then((r) => r.json()),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source', source);
      const res = await fetch('/api/reconciliation/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '上傳失敗');
      return data as { batchId: string; rowCount: number; errors: string[] };
    },
    onSuccess: async (data) => {
      if (data.errors.length > 0) {
        toast.warning(`上傳完成，${data.errors.length} 列解析異常`);
      } else {
        toast.success(`成功解析 ${data.rowCount} 筆交易`);
      }
      const matchRes = await fetch(`/api/reconciliation/${data.batchId}/run-match`, {
        method: 'POST',
      });
      if (!matchRes.ok) toast.error('自動配對失敗，可至批次頁手動執行');
      await qc.invalidateQueries({ queryKey: ['reconciliation', 'batches'] });
      router.push(`/reconciliation/${data.batchId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleUpload() {
    if (selectedFile) uploadMutation.mutate(selectedFile);
  }

  const sevenDaysAgo = subDays(new Date(), 7);
  const pendingBatches = batches.filter(
    (b) => b.status === 'draft' && new Date(b.createdAt) >= sevenDaysAgo
  );

  return (
    <div className="space-y-6">
      {/* Draft batch banner */}
      {pendingBatches.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm">
          <p className="text-yellow-800">
            您有 <strong>{pendingBatches.length}</strong> 個未確認的對帳批次
          </p>
          <a
            href={`/reconciliation/${pendingBatches[0].id}`}
            className="shrink-0 text-yellow-700 font-medium underline underline-offset-2 hover:text-yellow-900"
          >
            前往處理
          </a>
        </div>
      )}

      {/* Upload card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="font-semibold text-sm text-zinc-700">上傳銀行對帳檔案</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="選擇銀行" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postal">中華郵政</SelectItem>
                <SelectItem value="cathay" disabled>
                  國泰世華（即將推出）
                </SelectItem>
                <SelectItem value="esun" disabled>
                  玉山銀行（即將推出）
                </SelectItem>
              </SelectContent>
            </Select>

            <label className="flex flex-1 items-center gap-2 cursor-pointer rounded-md border px-3 h-10 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors min-w-0">
              <Upload className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="truncate">
                {selectedFile ? selectedFile.name : '選擇 CSV 檔案…'}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="shrink-0"
            >
              {uploadMutation.isPending ? '處理中…' : '上傳並配對'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch list */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">歷史批次</p>
        {isLoading && <p className="text-sm text-zinc-400">載入中…</p>}
        {!isLoading && batches.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-10">尚無對帳批次</p>
        )}
        {batches.map((batch) => (
          <Card key={batch.id} className="relative hover:shadow-md transition-shadow">
            <a
              href={`/reconciliation/${batch.id}`}
              className="absolute inset-0"
              aria-label="查看批次詳情"
            />
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">
                    {batch.uploadedFilename ?? '未命名檔案'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {formatDistanceToNow(new Date(batch.createdAt), {
                      locale: zhTW,
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Badge
                  className={cn(
                    STATUS_CLASS[batch.status] ?? 'bg-zinc-100 text-zinc-500'
                  )}
                >
                  {STATUS_LABEL[batch.status] ?? batch.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                <span className="text-zinc-500">
                  共 <strong className="text-zinc-800">{batch.rowCount}</strong> 筆
                </span>
                <span className="text-green-700">
                  配對 <strong>{batch.matchedCount}</strong>
                </span>
                <span className="text-yellow-700">
                  待處理 <strong>{batch.ambiguousCount}</strong>
                </span>
                <span className="text-red-700">
                  未配對 <strong>{batch.unmatchedCount}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
