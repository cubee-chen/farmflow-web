'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2, Plus, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { orderDraftFormSchema, type OrderDraftFormData } from '@/lib/validation/order-draft';
import { saveOrderDraft } from '@/app/(app)/intake/actions';
import { updateOrder } from '@/app/(app)/orders/actions';
import type { ParsedOrderDraft } from '@/lib/llm/types';
import type { Product } from '@/lib/db/schema';

export type ExistingOrderForEdit = {
  id: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string | null;
  delivery_zip: string | null;
  delivery_preference: string | null;
  desired_arrival_date: string | null;
  payment_method: string | null;
  bank_last_5: string | null;
  notes: string | null;
};

interface OrderDraftEditorProps {
  draft?: ParsedOrderDraft;
  rawText?: string;
  imageStoragePaths?: string[];
  imageQuality?: string;
  existingOrder?: ExistingOrderForEdit;
  products: Product[];
  onSaved: (orderId: string) => void;
  onCancel: () => void;
}

// Returns true if this field is called out as ambiguous by the LLM
function isAmbiguous(keywords: string[], ambiguities: string[]): boolean {
  return ambiguities.some((a) => keywords.some((kw) => a.includes(kw)));
}

// Thin amber ring applied to a FormItem when the field is ambiguous
const AMBIGUOUS_CLASS = 'ring-1 ring-amber-400 rounded-md px-2 pb-2';

const QUALITY_LABEL: Record<string, string> = {
  clear: '清晰',
  blurry: '模糊',
  partial: '不完整',
  unreadable: '無法辨識',
};

// ── Confidence progress bar ────────────────────────────────────────────────
function ConfidenceBar({ confidence, imageQuality }: { confidence: number; imageQuality?: string }) {
  const pct = Math.round(confidence * 100);
  const barColor =
    confidence < 0.5
      ? 'bg-red-400'
      : confidence < 0.8
        ? 'bg-amber-400'
        : 'bg-emerald-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>解析確信度</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {imageQuality && (
        <p className="text-xs text-zinc-400">
          圖片品質：{QUALITY_LABEL[imageQuality] ?? imageQuality}
        </p>
      )}
    </div>
  );
}

// ── Image preview section ──────────────────────────────────────────────────
function ImagePreviewSection({ paths }: { paths: string[] }) {
  const [open, setOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  async function loadUrls() {
    if (signedUrls.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/storage/signed-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) throw new Error('Failed');
      const data: { signedUrls: string[] } = await res.json();
      setSignedUrls(data.signedUrls);
    } catch {
      // silently ignore — thumbnails are non-critical
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => { const next = !open; setOpen(next); if (next) loadUrls(); }}
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-700"
        >
          <span>上傳的截圖（{paths.length} 張）</span>
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {loading && (
              <p className="col-span-3 text-xs text-zinc-400">載入中...</p>
            )}
            {signedUrls.filter(Boolean).map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setModalUrl(url)}
                className="overflow-hidden rounded-md border border-zinc-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`截圖 ${i + 1}`} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <Dialog open={!!modalUrl} onOpenChange={() => setModalUrl(null)}>
          <DialogContent className="max-w-screen-md p-2">
            {modalUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={modalUrl} alt="截圖大圖" className="w-full rounded-md" />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function OrderDraftEditor({
  draft,
  rawText,
  imageStoragePaths,
  imageQuality,
  existingOrder,
  products,
  onSaved,
  onCancel,
}: OrderDraftEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!existingOrder;
  const activeProducts = products.filter((p) => p.is_active);

  const form = useForm<OrderDraftFormData>({
    resolver: zodResolver(orderDraftFormSchema),
    defaultValues: isEditMode
      ? {
          items: existingOrder!.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          recipient_name: existingOrder!.recipient_name,
          recipient_phone: existingOrder!.recipient_phone,
          recipient_address: existingOrder!.recipient_address ?? '',
          delivery_zip: existingOrder!.delivery_zip ?? '',
          delivery_preference:
            (existingOrder!.delivery_preference as 'any' | 'weekday' | 'date') ?? 'any',
          desired_arrival_date: existingOrder!.desired_arrival_date ?? '',
          payment_method:
            (existingOrder!.payment_method as 'transfer' | 'cod') ?? 'transfer',
          bank_last_5: existingOrder!.bank_last_5 ?? '',
          notes: existingOrder!.notes ?? '',
        }
      : {
          items: draft!.items
            .filter((i) => i.product_id)
            .map((i) => ({
              product_id: i.product_id!,
              quantity: i.quantity,
              unit_price: Number(products.find((p) => p.id === i.product_id)?.price ?? 0),
            })),
          recipient_name: draft!.recipient_name ?? '',
          recipient_phone: draft!.recipient_phone ?? '',
          recipient_address: draft!.recipient_address ?? '',
          delivery_zip: draft!.delivery_zip ?? '',
          delivery_preference: 'any',
          desired_arrival_date: draft!.desired_arrival_date ?? '',
          payment_method: 'transfer',
          bank_last_5: draft!.bank_last_5 ?? '',
          notes: draft!.notes ?? '',
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items') ?? [];
  const deliveryPref = form.watch('delivery_preference');
  const paymentMethod = form.watch('payment_method');

  const totalAmount = watchedItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
    0,
  );

  async function submit(status?: 'draft' | 'confirmed') {
    const valid = await form.trigger();
    if (!valid) return;

    const data = form.getValues();
    setIsSaving(true);
    try {
      if (isEditMode) {
        const result = await updateOrder(existingOrder!.id, data);
        if (result && 'error' in result) {
          toast.error(result.error);
        } else {
          toast.success('訂單已更新');
          onSaved(existingOrder!.id);
        }
      } else {
        const result = await saveOrderDraft(data, {
          rawText: rawText ?? '',
          confidence: draft!.confidence,
          ambiguities: draft!.ambiguities,
          status: status!,
          imageStoragePaths,
        });
        if ('error' in result) {
          toast.error(result.error);
        } else {
          toast.success(status === 'confirmed' ? '訂單已確認' : '草稿已儲存');
          onSaved(result.orderId);
        }
      }
    } catch {
      toast.error('儲存失敗，請稍後重試');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <div className="space-y-4 pb-20">
        {/* ── 區塊 1：解析摘要（僅 create 模式） ──────────── */}
        {!isEditMode && draft && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <ConfidenceBar confidence={draft.confidence} imageQuality={imageQuality} />

              {/* Confidence banner — image mode only */}
              {imageQuality && draft.confidence >= 0.3 && draft.confidence < 0.5 && (
                <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <span>圖片可能模糊，建議重拍或改用文字輸入</span>
                  <button
                    type="button"
                    onClick={() => router.push('/intake')}
                    className="ml-3 shrink-0 text-xs text-red-700 underline"
                  >
                    改用文字模式
                  </button>
                </div>
              )}
              {imageQuality && draft.confidence >= 0.5 && draft.confidence < 0.8 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  解析信心較低，請仔細核對每個欄位
                </div>
              )}

              {draft.ambiguities.length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3">
                  {draft.ambiguities.map((a, i) => (
                    <p key={i} className="text-xs text-amber-800">
                      ⚠️ {a}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── 截圖預覽（圖片模式） ───────────────────────────── */}
        {!isEditMode && imageStoragePaths && imageStoragePaths.length > 0 && (
          <ImagePreviewSection paths={imageStoragePaths} />
        )}

        {/* ── 區塊 2：商品明細 ──────────────────────────────── */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">商品明細</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {fields.map((field, index) => {
              const pid = form.watch(`items.${index}.product_id`);
              const unitPrice = form.watch(`items.${index}.unit_price`) ?? 0;
              const qty = form.watch(`items.${index}.quantity`) ?? 0;

              return (
                <div
                  key={field.id}
                  className="relative rounded-md border border-zinc-200 p-3 space-y-2"
                >
                  {/* Product select */}
                  <FormField
                    control={form.control}
                    name={`items.${index}.product_id`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="text-xs">商品</FormLabel>
                        <Select
                          value={f.value}
                          onValueChange={(v) => {
                            f.onChange(v);
                            const p = activeProducts.find((p) => p.id === v);
                            if (p) form.setValue(`items.${index}.unit_price`, Number(p.price));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="選擇商品" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.display_name}（NT${Number(p.price).toLocaleString()}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-2 items-end">
                    {/* Quantity */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">數量</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              value={f.value || ''}
                              onChange={(e) =>
                                f.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Unit price (read-only) */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium leading-none text-zinc-500">單價</p>
                      <p className="flex h-9 items-center rounded-md bg-zinc-50 px-3 text-sm text-zinc-500">
                        {pid ? `NT$${unitPrice.toLocaleString()}` : '—'}
                      </p>
                    </div>

                    {/* Subtotal */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium leading-none text-zinc-500">小計</p>
                      <p className="flex h-9 items-center rounded-md bg-zinc-50 px-3 text-sm font-medium">
                        {pid ? `NT$${(qty * unitPrice).toLocaleString()}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Delete button */}
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute right-2 top-2 rounded p-1 text-zinc-400 hover:text-red-500"
                      aria-label="刪除此商品"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => append({ product_id: '', quantity: 1, unit_price: 0 })}
            >
              <Plus className="mr-1 size-4" />
              新增商品
            </Button>

            {/* Total */}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>合計</span>
              <span>NT${totalAmount.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* ── 區塊 3：收件人 ────────────────────────────────── */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">收件資訊</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <FormField
              control={form.control}
              name="recipient_name"
              render={({ field }) => (
                <FormItem
                  className={
                    isAmbiguous(['姓名', '收件人'], draft?.ambiguities ?? []) ? AMBIGUOUS_CLASS : ''
                  }
                >
                  <FormLabel>收件人姓名 *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recipient_phone"
              render={({ field }) => (
                <FormItem
                  className={isAmbiguous(['電話'], draft?.ambiguities ?? []) ? AMBIGUOUS_CLASS : ''}
                >
                  <FormLabel>電話 *</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" inputMode="tel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recipient_address"
              render={({ field }) => (
                <FormItem
                  className={isAmbiguous(['地址'], draft?.ambiguities ?? []) ? AMBIGUOUS_CLASS : ''}
                >
                  <FormLabel>收件地址 *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>郵遞區號</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" maxLength={6} className="w-28" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_preference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>配送偏好</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="any">都可以</SelectItem>
                      <SelectItem value="weekday">只能平日</SelectItem>
                      <SelectItem value="date">指定日期</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {deliveryPref === 'date' && (
              <FormField
                control={form.control}
                name="desired_arrival_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>指定到貨日</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* ── 區塊 4：付款 + 備註 ───────────────────────────── */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">付款與備註</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>付款方式</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="transfer">銀行轉帳</SelectItem>
                      <SelectItem value="cod">貨到付款</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {paymentMethod === 'transfer' && (
              <FormField
                control={form.control}
                name="bank_last_5"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>帳號末5碼</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" maxLength={5} className="w-28" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── 區塊 5：sticky bottom bar ─────────────────────── */}
      <div className="sticky bottom-0 -mx-4 border-t bg-white px-4 py-3">
        <div className={`grid gap-2 ${isEditMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            取消
          </Button>
          {isEditMode ? (
            <Button type="button" onClick={() => submit()} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : '儲存'}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => submit('draft')}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : '存草稿'}
              </Button>
              <Button type="button" onClick={() => submit('confirmed')} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : '確認存檔'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Form>
  );
}
