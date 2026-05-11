import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { farmers, lineWebhookEvents } from '@/lib/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifySignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  return expected === signature;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ farmerId: string }> }
) {
  const { farmerId } = await params;

  // Must read body before any await that might consume it
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  if (!UUID_RE.test(farmerId)) {
    console.warn(`[LINE webhook] Invalid farmerId format: ${farmerId}`);
    return NextResponse.json({ ok: true });
  }

  const [farmer] = await db
    .select({ id: farmers.id, line_channel_secret: farmers.line_channel_secret })
    .from(farmers)
    .where(eq(farmers.id, farmerId))
    .limit(1);

  if (!farmer) {
    console.warn(`[LINE webhook] Unknown farmerId: ${farmerId}`);
    return NextResponse.json({ ok: true });
  }

  if (!farmer.line_channel_secret) {
    console.warn(`[LINE webhook] farmer ${farmerId} has no channel_secret configured`);
    return NextResponse.json({ ok: true });
  }

  if (!verifySignature(farmer.line_channel_secret, rawBody, signature)) {
    console.warn(`[LINE webhook] Invalid signature for farmer ${farmerId}`);
    return NextResponse.json({ ok: true });
  }

  let payload: { events?: unknown[] };
  try {
    payload = JSON.parse(rawBody) as { events?: unknown[] };
  } catch {
    console.warn(`[LINE webhook] Failed to parse JSON body for farmer ${farmerId}`);
    return NextResponse.json({ ok: true });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  if (events.length > 0) {
    const rows = events.map((event) => {
      const e = event as Record<string, unknown>;
      const source = e.source as Record<string, unknown> | undefined;
      return {
        farmer_id: farmerId,
        event_type: (e.type as string) ?? 'unknown',
        source_user_id: (source?.userId as string) ?? null,
        raw_payload: event as object,
        processing_status: 'received' as const,
      };
    });

    await db.insert(lineWebhookEvents).values(rows);
  }

  return NextResponse.json({ ok: true });
}
