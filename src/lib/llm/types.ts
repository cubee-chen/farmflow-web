import { z } from 'zod';

// LLMs occasionally emit "" instead of null for missing fields. PostgreSQL
// rejects "" for typed columns like date; convert "" / whitespace to null.
export const nullableTrimmedString = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v === null) return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  });

export interface ParsedOrderItem {
  product_id: string;
  product_display_name: string;
  quantity: number;
}

export interface ParsedOrderDraft {
  items: ParsedOrderItem[];
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  delivery_zip: string | null;
  delivery_preference: string | null;
  desired_arrival_date: string | null; // YYYY-MM-DD
  bank_last_5: string | null;
  notes: string | null;
  confidence: number; // 0-1
  ambiguities: string[];
  image_quality?: 'clear' | 'blurry' | 'partial' | 'unreadable' | null;
  ocr_text?: string | null;
}
