'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ImageIcon, X, Camera, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OrderDraftEditor } from '@/components/shared/order-draft-editor';
import type { ParsedOrderDraft } from '@/lib/llm/types';
import type { Product } from '@/lib/db/schema';

interface FileItem {
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
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.storagePath as string;
}

export function ImageIntakePanel({ products, onSaved }: ImageIntakePanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileItemsRef = useRef<FileItem[]>([]);

  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [storagePaths, setStoragePaths] = useState<string[]>([]);
  const [draft, setDraft] = useState<ParsedOrderDraft | null>(null);

  // Keep ref in sync for cleanup
  fileItemsRef.current = fileItems;

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => { fileItemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)); };
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const items: FileItem[] = Array.from(incoming).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setFileItems((prev) => [...prev, ...items]);
  }, []);

  function removeFileAt(index: number) {
    setFileItems((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearAll() {
    setFileItems((prev) => { prev.forEach((i) => URL.revokeObjectURL(i.previewUrl)); return []; });
    setDraft(null);
    setStoragePaths([]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
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
      console.error('[image-intake]', err);
      toast.error('解析失敗，請改用文字貼上或手動建立');
    } finally {
      setProcessing(false);
    }
  }

  // Showing OrderDraftEditor after parse
  if (draft) {
    return (
      <div className="space-y-4 pb-20">
        {draft.confidence < 0.5 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            解析信心較低，請仔細核對
          </div>
        )}
        <OrderDraftEditor
          draft={draft}
          rawText={draft.ocr_text ?? ''}
          imageStoragePaths={storagePaths}
          products={products}
          onSaved={onSaved}
          onCancel={clearAll}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Drop zone */}
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-100"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <ImageIcon className="size-8 text-zinc-400" />
        <div>
          <p className="text-sm font-medium text-zinc-600">點擊或拖放圖片</p>
          <p className="mt-0.5 text-xs text-zinc-400">支援 JPG、PNG、WebP，最大 8 MB</p>
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

      {/* Preview grid */}
      {fileItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {fileItems.map((item, index) => (
            <div key={item.previewUrl} className="relative rounded-lg border border-zinc-200 overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="h-32 w-full object-cover"
              />
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-medium text-zinc-700">{item.file.name}</p>
                <p className="text-xs text-zinc-400">{formatBytes(item.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFileAt(index)}
                className="absolute right-1 top-1 rounded-full bg-black/40 p-0.5 text-white hover:bg-black/60"
                aria-label="刪除"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
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
