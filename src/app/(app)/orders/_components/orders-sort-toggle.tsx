'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ArrowDownNarrowWide, ArrowUpWideNarrow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SortDirection } from '@/lib/queries/orders';

interface Props {
  sort: SortDirection;
}

// Sort lives next to the page title rather than inside the filter bar so that
// on mobile the horizontally-scrolling chip row doesn't overlap the toggle.
export function OrdersSortToggle({ sort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: SortDirection = sort === 'desc' ? 'asc' : 'desc';
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'desc') params.delete('sort');
    else params.set('sort', 'asc');
    const qs = params.toString();
    startTransition(() => router.push(pathname + (qs ? `?${qs}` : '')));
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={pending}
      className="h-8 gap-1.5 text-xs shrink-0"
      aria-label={`切換排序，目前${sort === 'desc' ? '新→舊' : '舊→新'}`}
    >
      {sort === 'desc' ? (
        <ArrowDownNarrowWide className="size-3.5" />
      ) : (
        <ArrowUpWideNarrow className="size-3.5" />
      )}
      {sort === 'desc' ? '新→舊' : '舊→新'}
    </Button>
  );
}
