'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
}

export function NotificationSection({ initialText, recipientName }: Props) {
  const [text, setText] = useState(initialText);

  async function handleCopy() {
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success('已複製！');
    } else {
      toast.error('複製失敗，請手動選取文字');
    }
  }

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm">通知文案</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="font-mono text-sm resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">複製後到 LINE 貼給 {recipientName}</p>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            複製
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
