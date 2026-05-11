'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { Input } from '@/components/ui/input';

const STATUS_CHIPS = [
  { label: '全部', value: '' },
  { label: '待確認', value: 'draft' },
  { label: '已確認', value: 'confirmed' },
  { label: '待出貨', value: 'ready_to_ship' },
  { label: '已出貨', value: 'shipped' },
  { label: '已完成', value: 'completed' },
];

const INTAKE_CHIPS = [
  { label: '全部來源', value: '' },
  { label: 'LINE 接單', value: 'line_webhook' },
];

interface Props {
  status: string;
  q: string;
  intake: string;
}

export function OrdersFilters({ status, q, intake }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(
    (newStatus: string, newQ: string, newIntake: string) => {
      const params = new URLSearchParams();
      if (newStatus) params.set('status', newStatus);
      if (newQ) params.set('q', newQ);
      if (newIntake) params.set('intake', newIntake);
      const qs = params.toString();
      startTransition(() => router.push(pathname + (qs ? `?${qs}` : '')));
    },
    [router, pathname],
  );

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(status, value, intake), 300);
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_CHIPS.map((chip) => {
          const active = status === chip.value && !intake;
          return (
            <button
              key={chip.value}
              onClick={() => push(chip.value, q, '')}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {INTAKE_CHIPS.map((chip) => {
          const active = intake === chip.value && chip.value !== '';
          const isAll = chip.value === '';
          const allActive = isAll && !intake;
          return (
            <button
              key={chip.value}
              onClick={() => push(status, q, chip.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active || allActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <Input
        type="search"
        placeholder="搜尋收件人姓名或電話…"
        defaultValue={q}
        onChange={(e) => handleSearch(e.target.value)}
        className="h-10"
      />
    </div>
  );
}
