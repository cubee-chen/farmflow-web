import { z } from 'zod';

export const orderItemFormSchema = z.object({
  product_id: z.string().min(1, '請選擇商品'),
  quantity: z.number().int().positive('數量必須大於 0'),
  unit_price: z.number().positive(),
});

export const orderDraftFormSchema = z.object({
  items: z.array(orderItemFormSchema).min(1, '至少需要一項商品'),
  recipient_name: z.string().min(1, '請填寫收件人姓名'),
  recipient_phone: z.string().min(1, '請填寫電話'),
  recipient_address: z.string().min(1, '請填寫地址'),
  delivery_zip: z.string().optional(),
  delivery_preference: z.enum(['any', 'weekday', 'date']),
  desired_arrival_date: z.string().optional(),
  payment_method: z.enum(['transfer', 'cod']),
  bank_last_5: z.string().optional(),
  notes: z.string().optional(),
});

export type OrderDraftFormData = z.infer<typeof orderDraftFormSchema>;
