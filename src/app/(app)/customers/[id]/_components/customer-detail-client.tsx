'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { MessageCircle, MessageCircleOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { linkLine, unlinkLineUser } from '../../actions';
import type { Customer, Order } from '@/lib/db/schema';

const STATUS_LABEL: Record<string, string> = {
  draft: '待確認',
  confirmed: '已確認',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-zinc-200 text-zinc-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-green-100 text-green-700',
  completed: 'bg-zinc-900 text-white',
  cancelled: 'bg-red-100 text-red-700',
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-start gap-1 text-sm py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="col-span-2">{children}</span>
    </div>
  );
}

interface LineHistoryItem {
  id: string;
  raw_payload: unknown;
  created_at: Date | string | null;
}

interface Props {
  customer: Customer;
  orders: Pick<
    Order,
    'id' | 'order_number' | 'status' | 'total_amount' | 'created_at' | 'bank_last_5'
  >[];
  lineHistory: LineHistoryItem[];
  bankLast5History: string[];
}

function previewLineMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '（無法解析）';
  const p = payload as Record<string, unknown>;
  const msg = p.message as Record<string, unknown> | undefined;
  if (!msg) return `（事件：${String(p.type ?? 'unknown')}）`;
  const type = msg.type as string | undefined;
  if (type === 'text') return String(msg.text ?? '');
  if (type === 'image') return '[圖片]';
  if (type === 'sticker') return '[貼圖]';
  if (type === 'video') return '[影片]';
  if (type === 'audio') return '[語音]';
  if (type === 'location') return '[位置]';
  return `[${type ?? 'unknown'}]`;
}

export function CustomerDetailClient({ customer, orders, lineHistory, bankLast5History }: Props) {
  const router = useRouter();
  const [linkOpen, setLinkOpen] = useState(false);
  const [inputUserId, setInputUserId] = useState('');
  const [isLinking, startLink] = useTransition();
  const [isUnlinking, startUnlink] = useTransition();

  function handleLink() {
    startLink(async () => {
      const result = await linkLine(customer.id, inputUserId);
      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success('已綁定 LINE');
        setLinkOpen(false);
        router.refresh();
      }
    });
  }

  function handleUnlink() {
    startUnlink(async () => {
      const result = await unlinkLineUser(customer.id);
      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success('已解除綁定');
        router.refresh();
      }
    });
  }

  const displayName = customer.default_name ?? customer.line_display_name ?? '（未命名）';

  return (
    <div className="p-4 space-y-4 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">{displayName}</h1>
        {customer.line_display_name && customer.line_display_name !== customer.default_name && (
          <p className="text-sm text-zinc-400">LINE 名稱：{customer.line_display_name}</p>
        )}
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">基本資料</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1">
          <InfoRow label="電話">
            {customer.primary_phone
              ? <a href={`tel:${customer.primary_phone}`} className="text-blue-600 hover:underline">{customer.primary_phone}</a>
              : '—'
            }
          </InfoRow>
          <InfoRow label="預設地址">{customer.default_address ?? '—'}</InfoRow>
          <InfoRow label="備註">{customer.notes ?? '—'}</InfoRow>
          <InfoRow label="累計訂單">{customer.total_orders ?? 0} 筆</InfoRow>
          <InfoRow label="累計金額">NT${Number(customer.total_amount ?? 0).toLocaleString()}</InfoRow>
          {bankLast5History.length > 0 && (
            <InfoRow label="曾用末5碼">
              <span className="flex flex-wrap gap-1">
                {bankLast5History.map((code) => (
                  <span
                    key={code}
                    className="font-mono text-xs bg-zinc-100 text-zinc-700 rounded px-1.5 py-0.5"
                  >
                    {code}
                  </span>
                ))}
              </span>
            </InfoRow>
          )}
        </CardContent>
      </Card>

      {/* LINE binding */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {customer.line_user_id
              ? <MessageCircle className="size-4 text-green-500" />
              : <MessageCircleOff className="size-4 text-zinc-300" />
            }
            LINE 綁定
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {customer.line_user_id ? (
            <>
              <div className="space-y-1">
                <InfoRow label="LINE 名稱">{customer.line_display_name ?? '—'}</InfoRow>
                <InfoRow label="userId">
                  <span className="font-mono text-xs break-all">{customer.line_user_id}</span>
                </InfoRow>
                {customer.line_linked_at && (
                  <InfoRow label="綁定時間">
                    {new Date(customer.line_linked_at).toLocaleDateString('zh-TW')}
                  </InfoRow>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                  更換綁定
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                >
                  解除綁定
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500">此客戶尚未綁定 LINE，通知需手動複製發送。</p>
              <Button size="sm" onClick={() => setLinkOpen(true)}>
                手動綁定 LINE
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* LINE conversation history */}
      {customer.line_user_id && lineHistory.length > 0 && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">LINE 對話紀錄（最近 {lineHistory.length} 筆）</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {lineHistory.map((ev) => (
              <div key={ev.id} className="text-sm border-l-2 border-zinc-200 pl-2">
                <p className="text-xs text-zinc-400">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString('zh-TW') : ''}
                </p>
                <p className="text-zinc-700 line-clamp-2">
                  {previewLineMessage(ev.raw_payload)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Order history */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">歷史訂單</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {orders.length === 0 ? (
            <p className="text-sm text-zinc-400">尚無訂單</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between text-sm py-1.5 hover:bg-zinc-50 rounded px-1 -mx-1 transition-colors"
                >
                  <span className="font-mono text-zinc-700">
                    {o.order_number ?? '（草稿）'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">
                      NT${Number(o.total_amount).toLocaleString()}
                    </span>
                    <Badge className={`text-xs ${STATUS_CLASS[o.status] ?? ''}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced actions */}
      <div className="pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/customers/${customer.id}/merge`}>合併到其他客戶…</Link>
        </Button>
      </div>

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手動綁定 LINE userId</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="line-user-id">LINE userId</Label>
              <Input
                id="line-user-id"
                value={inputUserId}
                onChange={(e) => setInputUserId(e.target.value)}
                placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-zinc-400">
                如何取得 userId？請參考{' '}
                <a href="/docs/p1-line-setup.md" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  LINE 設定教學
                </a>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={isLinking}>
              取消
            </Button>
            <Button onClick={handleLink} disabled={isLinking || !inputUserId.trim()}>
              {isLinking ? '綁定中…' : '確認綁定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
