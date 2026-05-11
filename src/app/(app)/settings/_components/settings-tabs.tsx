'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { TemplateCard } from './template-card';
import { LineNotifyTab } from './line-notify-tab';
import type { Farmer, NotificationTemplate } from '@/lib/db/schema';

const TEMPLATE_EVENTS = ['confirmed', 'paid', 'shipped'] as const;

interface Props {
  farmer: Pick<Farmer, 'name' | 'farm_name' | 'phone' | 'bank_name' | 'bank_account' | 'line_channel_secret' | 'line_channel_access_token'>;
  templates: NotificationTemplate[];
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 items-start gap-1 text-sm py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="col-span-2 text-zinc-800">{value ?? '—'}</span>
    </div>
  );
}

export function SettingsTabs({ farmer, templates }: Props) {
  const templateByEvent = templates.reduce<Record<string, string>>((acc, t) => {
    acc[t.trigger_event] = t.template_text;
    return acc;
  }, {});

  return (
    <Tabs defaultValue="templates">
      <TabsList className="mb-4">
        <TabsTrigger value="info">商家資訊</TabsTrigger>
        <TabsTrigger value="templates">通知模板</TabsTrigger>
        <TabsTrigger value="payment">收款方式</TabsTrigger>
        <TabsTrigger value="line">LINE 通知</TabsTrigger>
      </TabsList>

      <TabsContent value="info">
        <Card>
          <CardContent className="px-4 py-4 space-y-1">
            <InfoRow label="農友姓名" value={farmer.name} />
            <InfoRow label="農場名稱" value={farmer.farm_name} />
            <InfoRow label="電話" value={farmer.phone} />
            <p className="text-xs text-zinc-400 pt-2">如需修改，請聯繫管理員</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="templates">
        <div className="space-y-4">
          {TEMPLATE_EVENTS.map((event) => (
            <TemplateCard
              key={event}
              triggerEvent={event}
              initialText={templateByEvent[event] ?? ''}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="payment">
        <Card>
          <CardContent className="px-4 py-4 space-y-1">
            <InfoRow label="銀行名稱" value={farmer.bank_name} />
            <InfoRow label="銀行帳號" value={farmer.bank_account} />
            <p className="text-xs text-zinc-400 pt-2">如需修改，請聯繫管理員</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="line">
        <LineNotifyTab
          initialSecret={farmer.line_channel_secret ?? ''}
          initialToken={farmer.line_channel_access_token ?? ''}
        />
      </TabsContent>
    </Tabs>
  );
}
