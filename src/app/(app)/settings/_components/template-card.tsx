'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { renderTemplate } from '@/lib/notification/render';
import { updateNotificationTemplate } from '../actions';

const TEMPLATE_TITLES: Record<string, string> = {
  confirmed: '訂單已確認時的通知文案',
  paid: '收到付款時的通知文案',
  shipped: '已出貨時的通知文案',
};

const PREVIEW_VARS: Record<string, string> = {
  recipient_name: '王小明',
  items_summary: '小箱 × 2、中箱 × 1',
  recipient_address: '台北市大安區復興南路一段100號',
  total_amount: 'NT$2,100',
  tracking_number: '123456789',
  order_number: 'ORD-0001',
  ship_date: '2026-05-10',
  desired_arrival_date: '2026-05-11',
  shipping_provider: '黑貓',
};

interface Props {
  triggerEvent: string;
  initialText: string;
}

export function TemplateCard({ triggerEvent, initialText }: Props) {
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDirty = text !== savedText;

  function handleSave() {
    startTransition(async () => {
      const result = await updateNotificationTemplate(triggerEvent, text);
      if ('error' in result) {
        toast.error(result.error);
      } else {
        setSavedText(text);
        toast.success('已儲存');
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">
            {TEMPLATE_TITLES[triggerEvent] ?? triggerEvent}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="font-mono text-sm resize-y"
            placeholder="輸入通知文案…"
          />
          <p className="text-xs text-zinc-400">
            可用變數：
            <code className="bg-zinc-100 px-1 rounded">{'{recipient_name}'}</code>、
            <code className="bg-zinc-100 px-1 rounded">{'{items_summary}'}</code>、
            <code className="bg-zinc-100 px-1 rounded">{'{recipient_address}'}</code>、
            <code className="bg-zinc-100 px-1 rounded">{'{total_amount}'}</code>、
            <code className="bg-zinc-100 px-1 rounded">{'{tracking_number}'}</code>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isPending}
            >
              {isPending ? '儲存中…' : '儲存'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              預覽
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>通知預覽</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap font-mono text-sm bg-zinc-50 rounded-lg p-4 leading-relaxed text-zinc-800 max-h-80 overflow-auto">
            {text ? renderTemplate(text, PREVIEW_VARS) : '（尚無文案）'}
          </pre>
          <p className="text-xs text-zinc-400">以上為填入示例值後的樣貌</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
