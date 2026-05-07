import { z } from 'zod';

export const parsedOrderItemSchema = z.object({
  product_id: z.string(),
  product_display_name: z.string(),
  quantity: z.number().int().positive(),
});

export const parsedOrderDraftSchema = z.object({
  items: z.array(parsedOrderItemSchema),
  recipient_name: z.string().nullable(),
  recipient_phone: z.string().nullable(),
  recipient_address: z.string().nullable(),
  delivery_zip: z.string().nullable(),
  delivery_preference: z.string().nullable(),
  desired_arrival_date: z.string().nullable(),
  bank_last_5: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()),
});

export type ParsedOrderDraftInput = z.input<typeof parsedOrderDraftSchema>;
