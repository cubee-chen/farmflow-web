import { z } from 'zod';

export const productSchema = z.object({
  display_name: z.string().min(1, '必填').max(50, '最多 50 字'),
  price: z.number({ message: '請輸入有效數字' }).positive('必須大於 0'),
  weight_g: z.number({ message: '請輸入有效數字' }).int('請輸入整數').positive('必須大於 0'),
  description: z.string().max(200, '最多 200 字').optional(),
  short_aliases: z.array(z.string().min(1)).min(1, '至少需要 1 個別名'),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  photo_url: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;
