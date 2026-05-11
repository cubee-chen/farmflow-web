import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Farmer, Product } from '@/lib/db/schema';
import type { ParsedOrderDraft } from './types';
import { buildSystemPrompt } from './prompts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Raw LLM output schema — no product_id yet (enriched after)
const llmItemSchema = z.object({
  product_display_name: z.string(),
  quantity: z.number().int().positive(),
});

const llmOutputSchema = z.object({
  items: z.array(llmItemSchema),
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

function emptyDraft(reason: string): ParsedOrderDraft {
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
    ambiguities: [reason],
  };
}

export async function parseOrderText(
  rawText: string,
  farmer: Farmer,
  products: Product[],
): Promise<ParsedOrderDraft> {
  const systemPrompt = buildSystemPrompt(farmer, products);

  console.time('LLM parse');
  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${rawText}\n\n請只輸出 JSON，不要其他文字`,
        },
      ],
    });
  } catch (err) {
    console.timeEnd('LLM parse');
    console.error('[LLM parse] API call failed:', err);
    return emptyDraft('LLM 解析失敗，請手動填寫');
  }
  console.timeEnd('LLM parse');

  const usage = response.usage;
  console.log(
    `[LLM parse] tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}`,
  );

  const rawContent = response.content[0];
  if (rawContent?.type !== 'text') {
    console.error('[LLM parse] unexpected content type:', rawContent?.type);
    return emptyDraft('LLM 回應格式異常，請手動填寫');
  }

  let json: unknown;
  try {
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
    console.error('[LLM parse] JSON.parse failed:', rawContent.text, err);
    return emptyDraft('LLM 解析失敗，請手動填寫');
  }

  const parsed = llmOutputSchema.safeParse(json);
  if (!parsed.success) {
    console.error('[LLM parse] Zod validation failed:', parsed.error.issues);
    return emptyDraft('LLM 解析失敗，請手動填寫');
  }

  const llm = parsed.data;

  // Enrich items with product_id by matching display_name
  const enrichedItems = llm.items.map((item) => {
    const product = products.find((p) => p.display_name === item.product_display_name);
    return {
      product_id: product?.id ?? '',
      product_display_name: item.product_display_name,
      quantity: item.quantity,
    };
  });

  // Flag unknown products in ambiguities
  const unknownProducts = enrichedItems
    .filter((i) => !i.product_id)
    .map((i) => `無法識別商品：「${i.product_display_name}」`);

  return {
    ...llm,
    items: enrichedItems,
    ambiguities: [...llm.ambiguities, ...unknownProducts],
  };
}
