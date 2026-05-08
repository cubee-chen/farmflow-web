import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notificationTemplates } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { SettingsTabs } from './_components/settings-tabs';

export default async function SettingsPage() {
  const farmer = await getCurrentFarmer();

  const templates = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.farmer_id, farmer.id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">設定</h1>
      <SettingsTabs
        farmer={{
          name: farmer.name,
          farm_name: farmer.farm_name,
          phone: farmer.phone,
          bank_name: farmer.bank_name,
          bank_account: farmer.bank_account,
        }}
        templates={templates}
      />
    </div>
  );
}
