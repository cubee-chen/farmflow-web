import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Farmer, Product } from '@/lib/db/schema';
import { nullableTrimmedString, type ParsedOrderDraft } from './types';
import { buildSystemPromptForImage } from './prompts-image';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const llmItemSchema = z.object({
  product_display_name: z.string(),
  quantity: z.number().int().positive(),
});

// image_quality drives confidence downscaling; if LLM omits / returns unknown
// value, fall back to "unreadable" so confidence collapses and UX shows error.
const imageQualitySchema = z.preprocess(
  (v) => {
    const allowed = ['clear', 'blurry', 'partial', 'unreadable'];
    return typeof v === 'string' && allowed.includes(v) ? v : 'unreadable';
  },
  z.enum(['clear', 'blurry', 'partial', 'unreadable']),
);

const llmOutputSchema = z.object({
  items: z.array(llmItemSchema),
  recipient_name: nullableTrimmedString,
  recipient_phone: nullableTrimmedString,
  recipient_address: nullableTrimmedString,
  delivery_zip: nullableTrimmedString,
  delivery_preference: nullableTrimmedString,
  desired_arrival_date: nullableTrimmedString,
  bank_last_5: nullableTrimmedString,
  notes: nullableTrimmedString,
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()),
  image_quality: imageQualitySchema,
  ocr_text: nullableTrimmedString,
});

const IMAGE_QUALITY_FACTOR: Record<string, number> = {
  clear: 1.0,
  blurry: 0.6,
  partial: 0.4,
  unreadable: 0,
};

function emptyDraft(): ParsedOrderDraft {
  return {
    items: [],
    recipient_name: null,
    recipient_phone: null,
    recipient_address: null,
    delivery_zip: null,
    delivery_preference: null,
    desired_arrival_date: null,
    bank_last_5: null,
    notes: null,
    confidence: 0,
    ambiguities: ['圖片解析失敗'],
    image_quality: null,
    ocr_text: null,
  };
}

export async function parseOrderFromImages(
  images: { mimeType: string; base64: string }[],
  farmer: Farmer,
  products: Product[],
): Promise<ParsedOrderDraft> {
  const systemPrompt = buildSystemPromptForImage(farmer, products);

  console.time('vision-parse');
  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: img.base64,
              },
            })),
            { type: 'text' as const, text: '請辨識上述截圖並輸出訂單 JSON。' },
          ],
        },
      ],
    });
  } catch (err) {
    console.timeEnd('vision-parse');
    console.error('[vision-parse] API call failed:', err);
    return emptyDraft();
  }
  console.timeEnd('vision-parse');

  const usage = response.usage;
  console.log(
    `[vision-parse] tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}`,
  );

  const rawContent = response.content[0];
  if (rawContent?.type !== 'text') {
    console.error('[vision-parse] unexpected content type:', rawContent?.type);
    return emptyDraft();
  }

  let json: unknown;
  try {
    // Extract JSON: prefer code-fence content, fall back to first { ... last }
    const raw = rawContent.text;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let text: string;
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    } else {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      text = start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim();
    }
    json = JSON.parse(text);
  } catch (err) {
    console.error('[vision-parse] JSON.parse failed:', rawContent.text, err);
    return emptyDraft();
  }

  const parsed = llmOutputSchema.safeParse(json);
  if (!parsed.success) {
    console.error('[vision-parse] Zod validation failed:', parsed.error.issues);
    return emptyDraft();
  }

  const llm = parsed.data;
  const qualityFactor = IMAGE_QUALITY_FACTOR[llm.image_quality] ?? 0;
  const overallConfidence = Math.min(llm.confidence, qualityFactor);

  const enrichedItems = llm.items.map((item) => {
    const product = products.find((p) => p.display_name === item.product_display_name);
    return {
      product_id: product?.id ?? '',
      product_display_name: item.product_display_name,
      quantity: item.quantity,
    };
  });

  const unknownProducts = enrichedItems
    .filter((i) => !i.product_id)
    .map((i) => `無法識別商品：「${i.product_display_name}」`);

  return {
    ...llm,
    items: enrichedItems,
    confidence: overallConfidence,
    ambiguities: [...llm.ambiguities, ...unknownProducts],
  };
}
