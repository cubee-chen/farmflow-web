'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ParsedOrderDraft } from '@/lib/llm/types';

interface OrderDraftEditorProps {
  draft: ParsedOrderDraft;
  rawText: string;
  onSaved: (orderId: string) => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const variant = confidence >= 0.85 ? 'default' : confidence >= 0.5 ? 'secondary' : 'destructive';
  return <Badge variant={variant}>{pct}% 確信</Badge>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-16 shrink-0 text-zinc-500">{label}</span>
      <span className={value ? 'text-zinc-900' : 'text-zinc-400'}>{value ?? '—'}</span>
    </div>
  );
}

export function OrderDraftEditor({ draft, onSaved: _onSaved }: OrderDraftEditorProps) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-zinc-800">解析結果</span>
        <ConfidenceBadge confidence={draft.confidence} />
      </div>

      {/* Ambiguities */}
      {draft.ambiguities.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-800">需補充資訊</p>
            {draft.ambiguities.map((a, i) => (
              <p key={i} className="text-xs text-amber-700">• {a}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">訂購商品</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {draft.items.length === 0 ? (
            <p className="text-sm text-zinc-400">未偵測到商品</p>
          ) : (
            draft.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{item.product_display_name}</span>
                <Badge variant="outline">× {item.quantity}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">收件資訊</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1.5">
          <Field label="姓名" value={draft.recipient_name} />
          <Field label="電話" value={draft.recipient_phone} />
          <Field label="地址" value={draft.recipient_address} />
          {draft.desired_arrival_date && (
            <Field label="到貨日" value={draft.desired_arrival_date} />
          )}
          {draft.delivery_preference && (
            <Field label="配送偏好" value={draft.delivery_preference} />
          )}
        </CardContent>
      </Card>

      {/* Extra info */}
      {(draft.bank_last_5 || draft.notes) && (
        <Card>
          <CardContent className="px-4 py-4 space-y-1.5">
            {draft.bank_last_5 && <Field label="帳號末5碼" value={draft.bank_last_5} />}
            {draft.notes && <Field label="備註" value={draft.notes} />}
          </CardContent>
        </Card>
      )}

      {/* Save button — full implementation in P0-E3 */}
      <Button className="w-full" disabled>
        儲存草稿（P0-E3 實作）
      </Button>
    </div>
  );
}
