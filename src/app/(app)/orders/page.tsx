import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { listOrders } from '@/lib/queries/orders';
import { OrdersFilters } from './_components/orders-filters';
import { OrdersInfiniteList } from './_components/orders-infinite-list';

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const farmer = await getCurrentFarmer();
  const { status = '', q = '' } = await searchParams;

  const { orders: initialOrders, hasMore } = await listOrders({
    farmerId: farmer.id,
    status,
    q,
    page: 1,
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">訂單管理</h1>
      <OrdersFilters status={status} q={q} />
      <OrdersInfiniteList
        key={`${status}__${q}`}
        initialOrders={initialOrders}
        initialHasMore={hasMore}
        status={status}
        q={q}
      />
    </div>
  );
}
