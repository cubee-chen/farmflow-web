'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  date: string;
}

export function SummaryControls({ date }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function handleDateChange(value: string) {
    if (!value) return;
    router.push(`${pathname}?date=${value}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap no-print">
      <label className="text-sm font-medium text-zinc-700 shrink-0">出貨日</label>
      <input
        type="date"
        defaultValue={date}
        onChange={(e) => handleDateChange(e.target.value)}
        className="h-9 rounded-md border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />
      <div className="flex gap-2 ml-auto">
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="no-print"
        >
          列印此頁
        </Button>
        <Button variant="outline" disabled className="no-print">
          下載 PDF（即將推出）
        </Button>
      </div>
    </div>
  );
}
