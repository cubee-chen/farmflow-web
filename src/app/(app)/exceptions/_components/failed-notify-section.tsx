'use client';

import { useState, useTransition } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { manualDispatchNotification } from '@/app/(app)/orders/actions';
import type { FailedNotifyLog } from '@/lib/queries/exceptions';

const TRIGGER_LABEL: Record<string, string> = {
  confirmed: '已確認',
  paid: '已收款',
  shipped: '已出貨',
};

interface Props {
  logs: FailedNotifyLog[];
}

export function FailedNotifySection({ logs: initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isBulkRetrying, startBulkRetry] = useTransition();

  async function handleRetry(log: FailedNotifyLog) {
    setRetryingId(log.id);
    try {
      const result = await manualDispatchNotification(
        log.orderId,
        log.triggerEvent as 'confirmed' | 'paid' | 'shipped'
      );
      if ('error' in result) {
        toast.error(result.error);
      } else if (result.status === 'sent') {
        toast.success('推播成功！');
        setLogs((prev) => prev.filter((l) => l.id !== log.id));
      } else {
        toast.info(`未推播：${result.reason ?? '跳過'}`);
      }
    } finally {
      setRetryingId(null);
    }
  }

  function handleBulkRetry() {
    startBulkRetry(async () => {
      try {
        const res = await fetch('/api/notify/retry-failed', { method: 'POST' });
        const data = await res.json() as { sent: number; skipped: number; failed: number; total: number };
        toast.success(`重試完成：${data.sent} 成功、${data.skipped} 跳過、${data.failed} 失敗`);
        if (data.sent > 0) {
          // Refresh: remove optimistically — full refresh via router not needed since SSR data will stale
          // User can reload page for updated list
          toast.info('重新整理頁面以看到最新狀態');
        }
      } catch {
        toast.error('全部重試請求失敗');
      }
    });
  }

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            推播失敗
            {logs.length > 0 && (
              <Badge className="bg-red-100 text-red-700 text-xs">{logs.length}</Badge>
            )}
          </CardTitle>
          {logs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRetry}
              disabled={isBulkRetrying}
              className="text-xs"
            >
              <RefreshCw className="size-3 mr-1" />
              {isBulkRetrying ? '重試中…' : '全部重試'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-400">無推播失敗記錄</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-3 rounded-md border border-red-100 bg-red-50 px-3 py-2.5"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-zinc-700">
                      訂單 {log.orderId.slice(0, 8)}…
                    </span>
                    <Badge className="text-[10px] bg-zinc-200 text-zinc-600 px-1.5">
                      {TRIGGER_LABEL[log.triggerEvent] ?? log.triggerEvent}
                    </Badge>
                  </div>
                  <p className="text-xs text-red-700 truncate">
                    {log.errorMessage ?? '未知錯誤'}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {log.createdAt
                      ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: zhTW })
                      : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs"
                  onClick={() => handleRetry(log)}
                  disabled={retryingId === log.id}
                >
                  {retryingId === log.id ? '重試中…' : '重試'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
