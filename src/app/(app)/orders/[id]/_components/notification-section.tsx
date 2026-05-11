'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MessageCircleOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { dispatchNotification } from '@/lib/notify/dispatch';

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  // iOS Safari fallback
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

interface Props {
  initialText: string;
  recipientName: string;
  orderId: string;
  triggerEvent: 'confirmed' | 'paid' | 'shipped';
  customerLineUserId: string | null;
}

export function NotificationSection({
  initialText,
  recipientName,
  orderId,
  triggerEvent,
  customerLineUserId,
}: Props) {
  const [text, setText] = useState(initialText);
  const [isPushing, startPush] = useTransition();

  async function handleCopy() {
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success('已複製！');
    } else {
      toast.error('複製失敗，請手動選取文字');
    }
  }

  function handlePush() {
    startPush(async () => {
      await dispatchNotification({ orderId, triggerEvent });
      toast.success('已加入推播佇列（P1-N3 實作中）');
    });
  }

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm">通知文案</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {!customerLineUserId && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <MessageCircleOff className="size-3.5 shrink-0" />
            <span>客戶未綁定 LINE，請複製文案手動發送</span>
          </div>
        )}
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
              : `複製後到 LINE 貼給 ${recipientName}`
            }
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              複製
            </Button>
            {customerLineUserId && (
              <Button size="sm" onClick={handlePush} disabled={isPushing}>
                {isPushing ? '推播中…' : '立即推播'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
