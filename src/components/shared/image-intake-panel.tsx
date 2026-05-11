'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ImageIcon, X, Camera, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { OrderDraftEditor } from '@/components/shared/order-draft-editor';
import type { ParsedOrderDraft } from '@/lib/llm/types';
import type { Product } from '@/lib/db/schema';

const MAX_FILES = 5;

interface FileItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImageIntakePanelProps {
  products: Product[];
  onSaved: (orderId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function resizeToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 2000;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > MAX) {
        const ratio = MAX / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas context')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}

async function uploadBlob(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, 'image.jpg');
  const res = await fetch('/api/intake/upload-image', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const msg = body.error ?? `HTTP ${res.status}`;
    console.error('[upload-image] server error:', msg);
    throw new Error(msg);
  }
  const data = await res.json();
  return data.storagePath as string;
}

// ── Sortable file card ────────────────────────────────────────────────────────
function SortableFileCard({ item, onRemove }: { item: FileItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="relative rounded-lg border border-zinc-200 overflow-hidden bg-white"
      {...attributes}
    >
      {/* Image acts as drag handle */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt={item.file.name}
        className="h-32 w-full object-cover cursor-grab active:cursor-grabbing"
        {...listeners}
        draggable={false}
      />
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium text-zinc-700">{item.file.name}</p>
        <p className="text-xs text-zinc-400">{formatBytes(item.file.size)}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute right-1 top-1 rounded-full bg-black/40 p-0.5 text-white hover:bg-black/60"
        aria-label="刪除"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ── Unreadable error screen ───────────────────────────────────────────────────
const QUALITY_DESC: Record<string, string> = {
  unreadable: '圖片完全無法辨識，請確認截圖清楚後重新上傳',
  blurry: '圖片模糊，無法提取足夠訂單資訊，請重拍後再試',
  partial: '圖片不完整，遺漏關鍵訂單資訊',
};

function UnreadableErrorScreen({
  quality,
  onRetry,
}: {
  quality: string | null | undefined;
  onRetry: () => void;
}) {
  const router = useRouter();
  const desc = (quality && QUALITY_DESC[quality]) ?? '圖片品質不足，無法解析訂單資訊';

  return (
    <div className="flex flex-col items-center gap-5 py-12 text-center">
      <AlertCircle className="size-12 text-red-400" />
      <div>
        <p className="font-semibold text-zinc-800">無法辨識圖片</p>
        <p className="mt-1 text-sm text-zinc-500">{desc}</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button onClick={onRetry} className="w-full">重新上傳</Button>
        <Button variant="outline" onClick={() => router.push('/intake')} className="w-full">
          改用文字模式
        </Button>
        <Button variant="ghost" asChild className="w-full">
          <Link href="/intake/manual">手動建立訂單</Link>
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ImageIntakePanel({ products, onSaved }: ImageIntakePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileItemsRef = useRef<FileItem[]>([]);

  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [storagePaths, setStoragePaths] = useState<string[]>([]);
  const [draft, setDraft] = useState<ParsedOrderDraft | null>(null);

  fileItemsRef.current = fileItems;

  useEffect(() => {
    return () => { fileItemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)); };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFileItems((prev) => {
      const available = MAX_FILES - prev.length;
      if (available <= 0) {
        toast.warning(`最多 ${MAX_FILES} 張`);
        return prev;
      }
      const arr = Array.from(incoming);
      if (arr.length > available) {
        toast.warning(`最多 ${MAX_FILES} 張，已略去多餘圖片`);
      }
      const items: FileItem[] = arr.slice(0, available).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...items];
    });
  }, []);

  function removeFileById(id: string) {
    setFileItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearAll() {
    setFileItems((prev) => { prev.forEach((i) => URL.revokeObjectURL(i.previewUrl)); return []; });
    setDraft(null);
    setStoragePaths([]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFileItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  async function handleParse() {
    if (fileItems.length === 0 || processing) return;
    setProcessing(true);
    try {
      const paths: string[] = [];
      for (const item of fileItems) {
        const blob = await resizeToJpeg(item.file);
        const path = await uploadBlob(blob);
        paths.push(path);
      }
      setStoragePaths(paths);

      const res = await fetch('/api/parse/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageStoragePaths: paths }),
      });
      if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
      const data: ParsedOrderDraft & { parsed_at: string } = await res.json();
      setDraft(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[image-intake]', msg);
      toast.error(`上傳失敗：${msg}，請改用文字貼上或手動建立`);
    } finally {
      setProcessing(false);
    }
  }

  // ── Post-parse views ────────────────────────────────────────────────────────
  if (draft) {
    if (draft.confidence < 0.3) {
      return <UnreadableErrorScreen quality={draft.image_quality} onRetry={clearAll} />;
    }
    return (
      <div className="space-y-4 pb-20">
        <OrderDraftEditor
          draft={draft}
          rawText={draft.ocr_text ?? ''}
          imageStoragePaths={storagePaths}
          imageQuality={draft.image_quality ?? undefined}
          products={products}
          onSaved={onSaved}
          onCancel={clearAll}
        />
      </div>
    );
  }

  // ── Upload UI ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">
      {/* Drop zone */}
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-100"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <ImageIcon className="size-8 text-zinc-400" />
        <div>
          <p className="text-sm font-medium text-zinc-600">點擊或拖放圖片</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            最多 {MAX_FILES} 張，支援 JPG、PNG、WebP
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Camera button (mobile) */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => cameraInputRef.current?.click()}
      >
        <Camera className="mr-2 size-4" />
        拍照上傳
      </Button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Sortable preview grid */}
      {fileItems.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fileItems.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3">
              {fileItems.map((item) => (
                <SortableFileCard
                  key={item.id}
                  item={item}
                  onRemove={() => removeFileById(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 -mx-4 border-t bg-white px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={clearAll} disabled={processing}>
            清空
          </Button>
          <Button onClick={handleParse} disabled={processing || fileItems.length === 0}>
            {processing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                AI 解析中...（約 5-10 秒）
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                AI 解析
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
