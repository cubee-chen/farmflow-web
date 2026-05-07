'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { productSchema, type ProductFormData } from '@/lib/validation/product';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProductFormProps {
  initialValues?: Partial<ProductFormData>;
  action: (data: ProductFormData) => Promise<{ error: string } | void>;
}

export function ProductForm({ initialValues, action }: ProductFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [aliasInput, setAliasInput] = useState('');

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      display_name: '',
      price: 0,
      weight_g: 0,
      description: '',
      short_aliases: [],
      sort_order: 0,
      is_active: true,
      photo_url: '',
      ...initialValues,
    },
  });

  const aliases = form.watch('short_aliases') ?? [];

  function addAlias() {
    const trimmed = aliasInput.trim();
    if (!trimmed || aliases.includes(trimmed)) return;
    form.setValue('short_aliases', [...aliases, trimmed], { shouldValidate: true });
    setAliasInput('');
  }

  function removeAlias(alias: string) {
    form.setValue(
      'short_aliases',
      aliases.filter((a) => a !== alias),
      { shouldValidate: true },
    );
  }

  async function onSubmit(data: ProductFormData) {
    setFormError(undefined);
    const result = await action(data);
    if (result?.error) setFormError(result.error);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>商品名稱 *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>售價 (NT$) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight_g"
            render={({ field }) => (
              <FormItem>
                <FormLabel>重量 (g) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)}
                  />
                </FormControl>
                <p className="text-xs text-zinc-500">黑貓出貨計費用</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>商品描述</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Chip input for short_aliases */}
        <FormField
          control={form.control}
          name="short_aliases"
          render={() => (
            <FormItem>
              <FormLabel>別名 *</FormLabel>
              {aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aliases.map((alias) => (
                    <Badge key={alias} variant="secondary" className="gap-1 pr-1 text-sm">
                      {alias}
                      <button
                        type="button"
                        onClick={() => removeAlias(alias)}
                        aria-label={`移除 ${alias}`}
                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-xs hover:bg-zinc-300"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAlias();
                    }
                  }}
                  placeholder="客戶可能用的別名，例如：大箱、大的、大盒"
                />
                <Button type="button" variant="outline" onClick={addAlias}>
                  新增
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sort_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>排序</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="photo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>圖片 URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">上架販售</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '儲存中...' : '儲存'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
