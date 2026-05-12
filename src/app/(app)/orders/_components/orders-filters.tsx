'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';
import { ArrowDownNarrowWide, ArrowUpWideNarrow } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { StatusCounts, SortDirection } from '@/lib/queries/orders';

// 「待確認」 sits first because it's the chip a farmer typically needs to act
// on; 「全部」 sits last as a fall-back view. URL value 'all' (rather than the
// empty string) avoids colliding with the no-query default route.
const STATUS_CHIPS: { label: string; value: string; countKey: keyof StatusCounts }[] = [
  { label: '待確認', value: 'draft', countKey: 'draft' },
  { label: '已確認', value: 'confirmed', countKey: 'confirmed' },
  { label: '待出貨', value: 'ready_to_ship', countKey: 'ready_to_ship' },
  { label: '備貨中', value: 'packing', countKey: 'packing' },
  { label: '已出貨', value: 'shipped', countKey: 'shipped' },
  { label: '已完成', value: 'completed', countKey: 'completed' },
  { label: '全部', value: 'all', countKey: 'all' },
];

const INTAKE_CHIPS = [
  { label: '全部來源', value: '' },
  { label: 'LINE 接單', value: 'line_webhook' },
];

const DEFAULT_STATUS = 'draft';

interface Props {
  status: string;
  q: string;
  intake: string;
  sort: SortDirection;
  counts: StatusCounts;
}

export function OrdersFilters({ status, q, intake, sort, counts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(
    (newStatus: string, newQ: string, newIntake: string, newSort: SortDirection) => {
      const params = new URLSearchParams();
      if (newStatus && newStatus !== DEFAULT_STATUS) params.set('status', newStatus);
      if (newQ) params.set('q', newQ);
      if (newIntake) params.set('intake', newIntake);
      if (newSort !== 'desc') params.set('sort', newSort);
      const qs = params.toString();
      startTransition(() => router.push(pathname + (qs ? `?${qs}` : '')));
    },
    [router, pathname],
  );

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(status, value, intake, sort), 300);
  }

  function toggleSort() {
    push(status, q, intake, sort === 'desc' ? 'asc' : 'desc');
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1 min-w-0">
          {STATUS_CHIPS.map((chip) => {
            const active = status === chip.value && !intake;
            const n = counts[chip.countKey];
            return (
              <button
                key={chip.value}
                onClick={() => push(chip.value, q, '', sort)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {chip.label}
                <span className={`ml-1 text-xs ${active ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSort}
          className="shrink-0 h-8 gap-1.5 text-xs"
          aria-label={`切換排序，目前${sort === 'desc' ? '新→舊' : '舊→新'}`}
        >
          {sort === 'desc' ? (
            <ArrowDownNarrowWide className="size-3.5" />
          ) : (
            <ArrowUpWideNarrow className="size-3.5" />
          )}
          {sort === 'desc' ? '新→舊' : '舊→新'}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {INTAKE_CHIPS.map((chip) => {
          const active = intake === chip.value && chip.value !== '';
          const isAll = chip.value === '';
          const allActive = isAll && !intake;
          return (
            <button
              key={chip.value}
              onClick={() => push(status, q, chip.value, sort)}
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
