/**
 * Local webhook smoke test.
 *
 * Usage:
 *   FARMER_ID=<uuid> CHANNEL_SECRET=<secret> tsx scripts/test-webhook.ts
 *
 * Or fetch values from DB automatically (reads .env.local):
 *   FARMER_NAME=官庭安 tsx scripts/test-webhook.ts
 */
import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { farmers, lineWebhookEvents } from '../src/lib/db/schema';

const BASE_URL = process.env.WEBHOOK_BASE_URL ?? 'http://localhost:3000';

async function getFarmer() {
  if (process.env.FARMER_ID && process.env.CHANNEL_SECRET) {
    return { id: process.env.FARMER_ID, line_channel_secret: process.env.CHANNEL_SECRET };
  }
  const farmerName = process.env.FARMER_NAME;
  if (!farmerName) {
    throw new Error('Provide FARMER_ID + CHANNEL_SECRET, or FARMER_NAME env var');
  }
  const [f] = await db
    .select({ id: farmers.id, line_channel_secret: farmers.line_channel_secret })
    .from(farmers)
    .where(eq(farmers.name, farmerName))
    .limit(1);
  if (!f) throw new Error(`Farmer not found: ${farmerName}`);
  if (!f.line_channel_secret) throw new Error(`Farmer ${farmerName} has no channel_secret`);
  return f as { id: string; line_channel_secret: string };
}

function buildMockPayload(sourceUserId = 'U_test_user_id_mock') {
  return {
    destination: 'MOCK_DESTINATION',
    events: [
      {
        type: 'message',
        message: { id: 'mock_msg_001', type: 'text', text: '我要訂兩箱大的' },
        source: { type: 'user', userId: sourceUserId },
        timestamp: Date.now(),
        mode: 'active',
        webhookEventId: 'mock_evt_001',
        replyToken: 'mock_reply_token',
      },
    ],
  };
}

async function run() {
  const farmer = await getFarmer();
  const payload = buildMockPayload();
  const body = JSON.stringify(payload);

  const signature = createHmac('sha256', farmer.line_channel_secret)
    .update(body)
    .digest('base64');

  const url = `${BASE_URL}/api/line-webhook/${farmer.id}`;
  console.log(`POST ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': signature,
    },
    body,
  });

  console.log('Status:', res.status, res.statusText);
  const json = await res.json();
  console.log('Response:', JSON.stringify(json));

  if (res.status !== 200 || !json.ok) {
    console.error('FAIL: expected 200 { ok: true }');
    process.exit(1);
  }

  // Verify a row was inserted
  await new Promise((r) => setTimeout(r, 300));
  const [inserted] = await db
    .select({ id: lineWebhookEvents.id, event_type: lineWebhookEvents.event_type })
    .from(lineWebhookEvents)
    .where(eq(lineWebhookEvents.farmer_id, farmer.id))
    .orderBy(lineWebhookEvents.created_at)
    .limit(1);

  if (!inserted) {
    console.error('FAIL: no row inserted in line_webhook_events');
    process.exit(1);
  }
  console.log('PASS: inserted row', inserted.id, '| event_type:', inserted.event_type);

  // Test: invalid signature should NOT insert
  const before = await db
    .select({ id: lineWebhookEvents.id })
    .from(lineWebhookEvents)
    .where(eq(lineWebhookEvents.farmer_id, farmer.id));

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': 'INVALID_SIGNATURE',
    },
    body,
  });

  await new Promise((r) => setTimeout(r, 300));
  const after = await db
    .select({ id: lineWebhookEvents.id })
    .from(lineWebhookEvents)
    .where(eq(lineWebhookEvents.farmer_id, farmer.id));

  if (after.length !== before.length) {
    console.error('FAIL: bad signature still inserted a row');
    process.exit(1);
  }
  console.log('PASS: invalid signature did not insert');

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
