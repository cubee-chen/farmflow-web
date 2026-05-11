import 'server-only';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customers,
  lineWebhookEvents,
  orderEvents,
  orderItems,
  orders,
  products,
  type Farmer,
} from '@/lib/db/schema';
import { parseOrderFromImages } from '@/lib/llm/parse-image';
import { parseOrderText } from '@/lib/llm/parse';
import type { ParsedOrderDraft } from '@/lib/llm/types';
import { createServiceSupabase } from '@/lib/supabase/server';

// ── LINE event types ────────────────────────────────────────────────────────────

interface LineSource {
  type: string;
  userId?: string;
}

// ── In-memory image group ───────────────────────────────────────────────────────
// NOTE: works when Vercel Fluid Compute reuses the same instance.
// P2 will replace with a DB-backed pending_image_groups table.

interface PendingGroup {
  storagePaths: string[];
  timer: ReturnType<typeof setTimeout>;
}

const pendingGroups = new Map<string, PendingGroup>();
const GROUP_TIMEOUT_MS = 30_000;

// ── Helpers ─────────────────────────────────────────────────────────────────────

async function downloadLineImage(messageId: string, token: string): Promise<Buffer> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`LINE Content API ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToStorage(buf: Buffer, farmerId: string, messageId: string): Promise<string> {
  const supabase = createServiceSupabase();
  const path = `${farmerId}/webhook/${messageId}.jpg`;
  const { error } = await supabase.storage
    .from('intake-images')
    .upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  return path;
}

async function generateOrderNumber(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], farmerId: string): Promise<string> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const [{ dayCount }] = await tx
    .select({ dayCount: sql<number>`cast(count(*) as integer)` })
    .from(orders)
    .where(
      and(
        eq(orders.farmer_id, farmerId),
        gte(orders.created_at, todayStart),
        lt(orders.created_at, tomorrowStart),
      ),
    );

  const dateStr = todayStart.toISOString().split('T')[0].replace(/-/g, '');
  return `ORD-${dateStr}-${String((dayCount ?? 0) + 1).padStart(3, '0')}`;
}

async function createDraftOrder(params: {
  farmerId: string;
  draft: ParsedOrderDraft;
  rawText: string | null;
  rawImageUrls: string[] | null;
  imageQuality: string | null;
  sourceUserId: string | null;
}): Promise<void> {
  const { farmerId, draft, rawText, rawImageUrls, imageQuality, sourceUserId } = params;

  const dbProducts = await db
    .select({ id: products.id, price: products.price })
    .from(products)
    .where(eq(products.farmer_id, farmerId));
  const priceMap = new Map(dbProducts.map((p) => [p.id, Number(p.price)]));

  const validItems = draft.items.filter((i) => i.product_id && priceMap.has(i.product_id));
  const totalAmount = validItems.reduce(
    (s, i) => s + i.quantity * (priceMap.get(i.product_id) ?? 0),
    0,
  );

  // Attempt to link known customer via LINE userId
  let linkedCustomerId: string | null = null;
  let recipientPhone = draft.recipient_phone ?? '';
  let recipientName = draft.recipient_name ?? '';

  if (sourceUserId) {
    const [linked] = await db
      .select({
        id: customers.id,
        primary_phone: customers.primary_phone,
        default_name: customers.default_name,
      })
      .from(customers)
      .where(and(eq(customers.farmer_id, farmerId), eq(customers.line_user_id, sourceUserId)))
      .limit(1);

    if (linked) {
      linkedCustomerId = linked.id;
      if (!recipientPhone) recipientPhone = linked.primary_phone;
      if (!recipientName) recipientName = linked.default_name ?? '';
    }
  }

  await db.transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx, farmerId);

    const [newOrder] = await tx
      .insert(orders)
      .values({
        farmer_id: farmerId,
        customer_id: linkedCustomerId ?? undefined,
        order_number: orderNumber,
        intake_mode: 'line_webhook',
        raw_text: rawText,
        raw_image_urls: rawImageUrls ?? undefined,
        image_quality: imageQuality,
        parse_confidence: String(draft.confidence),
        parse_ambiguities: draft.ambiguities.length ? draft.ambiguities : null,
        recipient_name: recipientName || '（待確認）',
        recipient_phone: recipientPhone || '（待確認）',
        recipient_address: draft.recipient_address ?? null,
        delivery_zip: draft.delivery_zip ?? null,
        delivery_preference: draft.delivery_preference ?? null,
        desired_arrival_date: draft.desired_arrival_date ?? null,
        bank_last_5: draft.bank_last_5 ?? null,
        notes: draft.notes ?? null,
        status: 'draft',
        total_amount: String(totalAmount),
      })
      .returning({ id: orders.id });

    if (validItems.length > 0) {
      await tx.insert(orderItems).values(
        validItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: String(priceMap.get(item.product_id) ?? 0),
          subtotal: String(item.quantity * (priceMap.get(item.product_id) ?? 0)),
        })),
      );
    }

    await tx.insert(orderEvents).values({
      order_id: newOrder.id,
      event_type: 'created',
      payload: { source: 'line_webhook', confidence: draft.confidence },
      created_by: 'system',
    });
  });
}

// ── Image group trigger ─────────────────────────────────────────────────────────

async function triggerImageGroupParsing(
  storagePaths: string[],
  farmer: Farmer,
  sourceUserId: string | null,
): Promise<void> {
  const supabase = createServiceSupabase();

  const images: { mimeType: string; base64: string }[] = [];
  for (const path of storagePaths) {
    const { data, error } = await supabase.storage.from('intake-images').download(path);
    if (error || !data) {
      console.error('[webhook] storage download failed:', path, error?.message);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    images.push({ mimeType: 'image/jpeg', base64: buf.toString('base64') });
  }

  if (images.length === 0) return;

  const farmerProducts = await db
    .select()
    .from(products)
    .where(eq(products.farmer_id, farmer.id));

  const draft = await parseOrderFromImages(images, farmer, farmerProducts);

  await createDraftOrder({
    farmerId: farmer.id,
    draft,
    rawText: null,
    rawImageUrls: storagePaths,
    imageQuality: draft.image_quality ?? null,
    sourceUserId,
  });
}

// ── Main export ─────────────────────────────────────────────────────────────────

export async function processLineEvent(
  eventId: string,
  rawEvent: unknown,
  farmer: Farmer,
): Promise<void> {
  const event = rawEvent as Record<string, unknown>;
  const eventType = event.type as string;
  const source = event.source as LineSource | undefined;
  const sourceUserId = source?.userId ?? null;

  if (eventType !== 'message') {
    await db
      .update(lineWebhookEvents)
      .set({ processing_status: 'ignored' })
      .where(eq(lineWebhookEvents.id, eventId));
    return;
  }

  const message = event.message as Record<string, unknown> | undefined;
  const messageType = message?.type as string | undefined;

  try {
    if (messageType === 'text') {
      const rawText = message?.text as string ?? '';
      const farmerProducts = await db
        .select()
        .from(products)
        .where(eq(products.farmer_id, farmer.id));

      const draft = await parseOrderText(rawText, farmer, farmerProducts);

      await createDraftOrder({
        farmerId: farmer.id,
        draft,
        rawText,
        rawImageUrls: null,
        imageQuality: null,
        sourceUserId,
      });

      await db
        .update(lineWebhookEvents)
        .set({ processing_status: 'processed' })
        .where(eq(lineWebhookEvents.id, eventId));

    } else if (messageType === 'image') {
      const messageId = message?.id as string | undefined;
      if (!messageId) throw new Error('missing messageId');
      if (!farmer.line_channel_access_token) throw new Error('no channel_access_token configured');

      const buf = await downloadLineImage(messageId, farmer.line_channel_access_token);
      const storagePath = await uploadToStorage(buf, farmer.id, messageId);

      const groupKey = `${farmer.id}:${sourceUserId ?? 'anon'}`;
      const existing = pendingGroups.get(groupKey);

      if (existing) {
        clearTimeout(existing.timer);
        existing.storagePaths.push(storagePath);
      }

      const storagePaths = existing ? existing.storagePaths : [storagePath];

      const timer = setTimeout(() => {
        pendingGroups.delete(groupKey);
        triggerImageGroupParsing(storagePaths, farmer, sourceUserId).catch((err) =>
          console.error('[webhook] image group parse failed:', err),
        );
      }, GROUP_TIMEOUT_MS);

      pendingGroups.set(groupKey, { storagePaths, timer });

      await db
        .update(lineWebhookEvents)
        .set({ processing_status: 'processed' })
        .where(eq(lineWebhookEvents.id, eventId));

    } else {
      // sticker, voice, video, location, etc.
      await db
        .update(lineWebhookEvents)
        .set({ processing_status: 'ignored' })
        .where(eq(lineWebhookEvents.id, eventId));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] event ${eventId} failed:`, msg);
    await db
      .update(lineWebhookEvents)
      .set({ processing_status: 'error', error_message: msg })
      .where(eq(lineWebhookEvents.id, eventId));
  }
}
