import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { getOrderStatusCounts, listOrders } from '@/lib/queries/orders';
import { OrdersFilters } from './_components/orders-filters';
import { OrdersInfiniteList } from './_components/orders-infinite-list';

interface Props {
  searchParams: Promise<{ status?: string; q?: string; intake?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const farmer = await getCurrentFarmer();
  const { status = '', q = '', intake = '' } = await searchParams;

  const [{ orders: initialOrders, hasMore }, counts] = await Promise.all([
    listOrders({ farmerId: farmer.id, status, q, intake, page: 1 }),
    getOrderStatusCounts(farmer.id),
  ]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">訂單管理</h1>
      <OrdersFilters status={status} q={q} intake={intake} counts={counts} />
      <OrdersInfiniteList
        key={`${status}__${q}__${intake}`}
        initialOrders={initialOrders}
        initialHasMore={hasMore}
        status={status}
        q={q}
        intake={intake}
      />
    </div>
  );
}
