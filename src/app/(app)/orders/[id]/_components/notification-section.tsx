'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, MessageCircleOff, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { manualDispatchNotification } from '@/app/(app)/orders/actions';
import type { LatestLogData } from './order-detail-client';

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(el);
  return ok;
}

const SKIP_REASON_LABEL: Record<string, string> = {
  'no template': '尚未設定通知模板',
  'farmer not configured': '尚未設定 LINE Channel Token',
  'customer not linked': '客戶未綁定 LINE',
  'already_sent': '已推播過（防重複）',
};

interface Props {
  initialText: string;
  recipientName: string;
  orderId: string;
  triggerEvent: 'confirmed' | 'paid' | 'shipped';
  customerLineUserId: string | null;
  customerDisplayName: string | null;
  latestLog: LatestLogData | null;
}

export function NotificationSection({
  initialText,
  recipientName,
  orderId,
  triggerEvent,
  customerLineUserId,
  customerDisplayName,
  latestLog,
}: Props) {
  const [text, setText] = useState(initialText);
  const [isPending, startTransition] = useTransition();

  async function handleCopy() {
    const ok = await copyToClipboard(text);
    toast[ok ? 'success' : 'error'](ok ? '已複製！' : '複製失敗，請手動選取文字');
  }

  function handleDispatch() {
    startTransition(async () => {
      const result = await manualDispatchNotification(orderId, triggerEvent);
      if ('error' in result) {
        toast.error(result.error);
      } else if (result.status === 'sent') {
        toast.success('推播成功！');
      } else if (result.status === 'skipped') {
        const label = SKIP_REASON_LABEL[result.reason ?? ''] ?? result.reason ?? '跳過';
        toast.info(`未推播：${label}`);
      } else {
        toast.error(`推播失敗：${result.reason ?? '未知錯誤'}`);
      }
    });
  }

  // ── Status banner ──────────────────────────────────────────────────────────

  let statusBanner: React.ReactNode = null;

  if (latestLog?.status === 'sent') {
    const timeAgo = latestLog.sent_at
      ? formatDistanceToNow(new Date(latestLog.sent_at), { addSuffix: true, locale: zhTW })
      : '';
    statusBanner = (
      <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
        <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
        <span>
          已自動推播給 <strong>{customerDisplayName ?? recipientName}</strong>
          {timeAgo && ` · ${timeAgo}`}
        </span>
      </div>
    );
  } else if (latestLog?.status === 'failed') {
    statusBanner = (
      <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
        <XCircle className="size-3.5 shrink-0 mt-0.5" />
        <span>推播失敗：{latestLog.error_message ?? '未知錯誤'}</span>
      </div>
    );
  } else if (latestLog?.status === 'skipped') {
    const label = SKIP_REASON_LABEL[latestLog.error_message ?? ''] ?? latestLog.error_message ?? '跳過';
    statusBanner = (
      <div className="flex items-start gap-2 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
        <Clock className="size-3.5 shrink-0 mt-0.5" />
        <span>未推播：{label}</span>
      </div>
    );
  } else if (!customerLineUserId) {
    statusBanner = (
      <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
        <MessageCircleOff className="size-3.5 shrink-0" />
        <span>客戶未綁定 LINE，請複製文案手動發送</span>
      </div>
    );
  }

  // ── Action buttons ─────────────────────────────────────────────────────────

  const showDispatch =
    customerLineUserId &&
    latestLog?.status !== 'sent'; // sent 後不再顯示推播按鈕

  const dispatchLabel =
    latestLog?.status === 'failed' ? '重試推播' : '立即推播';

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm">通知文案</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {statusBanner}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="font-mono text-sm resize-none"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-zinc-500">
            {customerLineUserId
              ? `可直接推播給 ${recipientName}`
              : `複製後到 LINE 貼給 ${recipientName}`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              複製
            </Button>
            {showDispatch && (
              <Button size="sm" onClick={handleDispatch} disabled={isPending}>
                {isPending ? '推播中…' : dispatchLabel}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
