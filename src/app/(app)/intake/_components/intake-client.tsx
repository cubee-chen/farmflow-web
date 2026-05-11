'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OrderDraftEditor } from '@/components/shared/order-draft-editor';
import { ImageIntakePanel } from '@/components/shared/image-intake-panel';
import type { ParsedOrderDraft } from '@/lib/llm/types';
import type { Product } from '@/lib/db/schema';

interface IntakeClientProps {
  products: Product[];
}

export function IntakeClient({ products }: IntakeClientProps) {
  const router = useRouter();
  const [rawText, setRawText] = useState('');
  const [draft, setDraft] = useState<ParsedOrderDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rawCollapsed, setRawCollapsed] = useState(false);

  async function handleParse() {
    const text = rawText.trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ParsedOrderDraft & { parsed_at: string } = await res.json();
      setDraft(data);
      setRawCollapsed(true);
    } catch (err) {
      console.error('[parse]', err);
      toast.error('解析失敗，請稍後重試或手動建立訂單', {
        action: {
          label: '手動建立',
          onClick: () => router.push('/orders/new'),
        },
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setRawText('');
    setDraft(null);
    setRawCollapsed(false);
  }

  function handleSaved(orderId: string) {
    router.push(`/orders/${orderId}`);
  }

  return (
    <Tabs defaultValue="text" className="space-y-4">
      <TabsList className="w-full">
        <TabsTrigger value="text" className="flex-1">貼上文字</TabsTrigger>
        <TabsTrigger value="image" className="flex-1">上傳截圖</TabsTrigger>
      </TabsList>

      {/* ── 文字輸入 Tab ──────────────────────────────── */}
      <TabsContent value="text">
        <div className="space-y-4 pb-24">
          {/* Instruction card */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-600">把 LINE 訊息貼進來，AI 會自動解析訂單</p>
            </CardContent>
          </Card>

          {/* Raw text — collapsed after parse */}
          {rawCollapsed ? (
            <button
              type="button"
              onClick={() => setRawCollapsed(false)}
              className="text-sm text-zinc-500 underline underline-offset-2"
            >
              原始訊息（點擊展開）
            </button>
          ) : (
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="貼上 LINE 訊息或語音輸入文字..."
              className="min-h-40 resize-none"
              inputMode="text"
              autoCapitalize="sentences"
            />
          )}

          {/* Low-confidence warning */}
          {draft && draft.confidence < 0.5 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              解析信心較低，請仔細核對
            </div>
          )}

          {/* Draft editor (has its own sticky bar) */}
          {draft && (
            <OrderDraftEditor
              draft={draft}
              rawText={rawText}
              products={products}
              onSaved={handleSaved}
              onCancel={handleClear}
            />
          )}

          {/* Manual order link */}
          {!draft && (
            <p className="text-center text-sm text-zinc-500">
              沒有 LINE 訊息？{' '}
              <Link href="/intake/manual" className="underline underline-offset-2 hover:text-zinc-700">
                手動建立訂單
              </Link>
            </p>
          )}

          {/* Sticky bottom action bar — only when no draft */}
          {!draft && (
            <div className="sticky bottom-0 -mx-4 border-t bg-white px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleClear}>
                  清空
                </Button>
                <Button onClick={handleParse} disabled={isLoading || !rawText.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      AI 解析中...（約 5 秒）
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" />
                      解析訂單
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ── 圖片上傳 Tab ──────────────────────────────── */}
      <TabsContent value="image">
        <ImageIntakePanel products={products} onSaved={handleSaved} />
      </TabsContent>
    </Tabs>
  );
}
