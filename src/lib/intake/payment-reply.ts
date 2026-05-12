import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderEvents } from '@/lib/db/schema';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Heuristic regex set for short LINE replies that confirm a transfer.
// Hits here trigger a second-pass LLM classify; misses go straight to the
// normal order-parsing path.
const PAYMENT_KEYWORDS = [
  /轉帳/,
  /匯款|匯了/,
  /已付款|已付/,
  /(末|尾|後)\s*[五5]?\s*碼/,
  /^(好|好的|OK|ok|收到|了解|謝謝)[!！。\s]*$/,
];

const LAST5_WITH_LABEL = /(?:末|尾|後)\s*[五5]?\s*碼?\s*[:：是為]?\s*(\d{5})\b/;
const LAST5_BARE = /(?<!\d)(\d{5})(?!\d)/;

export function looksLikePaymentReply(rawText: string): boolean {
  const text = rawText.trim();
  if (!text) return false;
  if (text.length > 60) return false; // long messages are almost always orders
  return PAYMENT_KEYWORDS.some((re) => re.test(text));
}

export function extractLast5(rawText: string): string | null {
  const labelled = rawText.match(LAST5_WITH_LABEL);
  if (labelled) return labelled[1];
  const bare = rawText.match(LAST5_BARE);
  if (bare) return bare[1];
  return null;
}

// Second-pass LLM check so a borderline message like "好，今天先這樣，0912 王小明"
// isn't misclassified by the heuristic. ≤30 output tokens — cheap.
export async function classifyAsPaymentReply(rawText: string): Promise<boolean> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      system:
        '你判斷一則 LINE 訊息是否為「客戶回覆已轉帳/付款」（包含告知末五碼、確認已匯款、純粹說「好」「收到」回應前一則收款請求）。' +
        '只回 yes 或 no，不要其他字。如果訊息包含新的訂單內容（如商品、數量、地址、收件人），一律回 no。',
      messages: [{ role: 'user', content: rawText }],
    });
    const first = response.content[0];
    if (first?.type !== 'text') return false;
    return /^\s*yes/i.test(first.text);
  } catch (err) {
    console.error('[payment-reply] classify failed:', err);
    return false;
  }
}

type ApplyResult =
  | { kind: 'updated'; orderId: string; orderNumber: string | null; last5: string | null }
  | { kind: 'no_match'; reason: string };

// Attach last5 (if found) to the customer's most recent unpaid order and log
// the LINE reply as an event. If the customer has no open order we report
// no_match so the webhook event is marked 'ignored' with a clear note.
export async function applyPaymentReply(params: {
  farmerId: string;
  customerId: string | null;
  rawText: string;
}): Promise<ApplyResult> {
  const { farmerId, customerId, rawText } = params;
  const last5 = extractLast5(rawText);

  if (!customerId) {
    return { kind: 'no_match', reason: 'no customer binding' };
  }

  const [openOrder] = await db
    .select({ id: orders.id, order_number: orders.order_number, bank_last_5: orders.bank_last_5 })
    .from(orders)
    .where(
      and(
        eq(orders.farmer_id, farmerId),
        eq(orders.customer_id, customerId),
        eq(orders.payment_status, 'unpaid'),
        ne(orders.status, 'cancelled')
      )
    )
    .orderBy(desc(orders.created_at))
    .limit(1);

  if (!openOrder) {
    return { kind: 'no_match', reason: 'no open order' };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (last5 && openOrder.bank_last_5 !== last5) {
      await tx
        .update(orders)
        .set({ bank_last_5: last5, updated_at: now })
        .where(eq(orders.id, openOrder.id));
    }

    await tx.insert(orderEvents).values({
      order_id: openOrder.id,
      event_type: 'payment_reply_received',
      payload: { raw_text: rawText, extracted_last5: last5 },
      created_by: 'system',
    });
  });

  return {
    kind: 'updated',
    orderId: openOrder.id,
    orderNumber: openOrder.order_number,
    last5,
  };
}
