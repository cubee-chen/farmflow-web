'use client';
import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { OrderCard } from './order-card';
import type { OrderWithItems, SortDirection } from '@/lib/queries/orders';

interface Props {
  initialOrders: OrderWithItems[];
  initialHasMore: boolean;
  status: string;
  q: string;
  intake: string;
  sort: SortDirection;
}

async function fetchPage(
  status: string,
  q: string,
  intake: string,
  sort: SortDirection,
  page: number,
) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (intake) params.set('intake', intake);
  if (sort !== 'desc') params.set('sort', sort);
  const res = await fetch(`/api/orders/list?${params}`);
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json() as Promise<{ orders: OrderWithItems[]; hasMore: boolean }>;
}

export function OrdersInfiniteList({
  initialOrders,
  initialHasMore,
  status,
  q,
  intake,
  sort,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['orders', status, q, intake, sort],
    queryFn: ({ pageParam }) => fetchPage(status, q, intake, sort, pageParam as number),
    initialPageParam: 2,
    getNextPageParam: (lastPage, _, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + 1 : undefined,
    enabled: initialHasMore,
  });

  const moreOrders = data?.pages.flatMap((p) => p.orders) ?? [];
  const allOrders = [...initialOrders, ...moreOrders];
  const canLoadMore = hasNextPage ?? initialHasMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !canLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoadMore, isFetchingNextPage, fetchNextPage]);

  if (allOrders.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">暫無訂單</div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {allOrders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>

      <div ref={sentinelRef} className="py-4 text-center text-sm text-zinc-400">
        {isFetchingNextPage ? '載入中…' : canLoadMore ? '' : allOrders.length > 0 ? '已顯示全部' : ''}
      </div>
    </div>
  );
}
