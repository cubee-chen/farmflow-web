'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { farmers } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { sendLinePushMessage } from '@/lib/notify/line-client';

export async function saveLineCredentials(
  channelSecret: string,
  channelAccessToken: string
): Promise<{ success: true } | { error: string }> {
  const farmer = await getCurrentFarmer();

  await db
    .update(farmers)
    .set({
      line_channel_secret: channelSecret || null,
      line_channel_access_token: channelAccessToken || null,
    })
    .where(eq(farmers.id, farmer.id));

  return { success: true };
}

export async function testLinePush(
  testUserId: string
): Promise<{ success: true; messageId: string } | { error: string }> {
  const farmer = await getCurrentFarmer();

  if (!farmer.line_channel_access_token) {
    return { error: '尚未設定 Channel Access Token' };
  }

  if (!testUserId.trim()) {
    return { error: '請輸入測試用的 LINE userId' };
  }

  try {
    const result = await sendLinePushMessage({
      channelAccessToken: farmer.line_channel_access_token,
      toUserId: testUserId.trim(),
      text: 'FarmFlow 測試訊息 ✅ 推播設定成功！',
    });
    return { success: true, messageId: result.messageId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '推播失敗' };
  }
}
