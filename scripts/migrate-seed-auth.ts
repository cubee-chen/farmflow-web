// Node.js 20 lacks native WebSocket; stub it so Supabase client can init.
// This script only uses Auth admin APIs — Realtime is never connected.
if (!('WebSocket' in globalThis)) {
  Object.assign(globalThis, { WebSocket: class {} });
}

import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { farmers } from '../src/lib/db/schema';

const SEED_ACCOUNTS = [
  { farmerName: '陳惠茹', email: 'chenhuiru@farmflow.local',  password: 'TempPass-Chen-2026' },
  { farmerName: '徐方',   email: 'xufang@farmflow.local',     password: 'TempPass-Xu-2026' },
  { farmerName: '陳奕宏', email: 'chenyihong@farmflow.local', password: 'TempPass-Chen2-2026' },
  { farmerName: '官庭安', email: 'guantingan@farmflow.local', password: 'TempPass-Guan-2026' },
];

// db import above triggers .env.local loading in db/index.ts
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function resolveAuthUser(email: string, password: string): Promise<string | null> {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error) return created.user.id;

  // Email already registered — look up existing user
  const isEmailExists =
    error.code === 'email_exists' ||
    error.message.toLowerCase().includes('already been registered') ||
    error.message.toLowerCase().includes('already exists');

  if (isEmailExists) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email === email);
    if (existing) {
      console.log(`    ℹ️  Auth user 已存在，重用 ${existing.id}`);
      return existing.id;
    }
    console.error(`    ❌ 無法找到 email=${email} 的既有 user`);
    return null;
  }

  console.error(`    ❌ createUser 失敗：${error.message}`);
  return null;
}

async function main() {
  console.log('🔐 FarmFlow 種子農友 Auth 遷移\n');

  for (const { farmerName, email, password } of SEED_ACCOUNTS) {
    // a. 找 farmer 記錄
    const [farmer] = await db
      .select()
      .from(farmers)
      .where(eq(farmers.name, farmerName))
      .limit(1);

    if (!farmer) {
      console.warn(`⚠️  ${farmerName} 在 farmers 表不存在，跳過`);
      continue;
    }

    if (farmer.authUserId) {
      console.log(`⏭  ${farmerName} 已遷移過 (auth_user_id: ${farmer.authUserId})`);
      continue;
    }

    // b. 建立（或找到）auth user
    const userId = await resolveAuthUser(email, password);
    if (!userId) continue;

    // c. 寫回 farmers.auth_user_id
    await db.update(farmers).set({ authUserId: userId }).where(eq(farmers.id, farmer.id));

    console.log(`✅ ${farmerName} → ${email}`);
  }

  // 交付資訊表格
  const LINE = '─'.repeat(70);
  console.log(`\n${LINE}`);
  console.log('請把以下帳密透過私訊管道交付農友');
  console.log(LINE);
  console.log('農友名稱   電子郵件                           密碼');
  console.log(LINE);
  for (const { farmerName, email, password } of SEED_ACCOUNTS) {
    console.log(`${farmerName.padEnd(10)} ${email.padEnd(36)} ${password}`);
  }
  console.log(LINE);
  console.log('⚠️  建議首次登入後協助農友改密碼（P0.5 後做改密碼 UI）');
  console.log(LINE + '\n');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
