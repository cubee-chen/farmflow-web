import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import {
  getOrderStatusCounts,
  listOrders,
  type SortDirection,
} from '@/lib/queries/orders';
import { OrdersFilters } from './_components/orders-filters';
import { OrdersInfiniteList } from './_components/orders-infinite-list';

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    intake?: string;
    sort?: string;
  }>;
}

// Visiting /orders with no query lands on 「待確認」 — the chip farmers need
// to act on first. 「全部」 is the explicit 'all' value, sitting last in the
// chip list.
const DEFAULT_STATUS = 'draft';

export default async function OrdersPage({ searchParams }: Props) {
  const farmer = await getCurrentFarmer();
  const {
    status: rawStatus,
    q = '',
    intake = '',
    sort: rawSort,
  } = await searchParams;
  const status = rawStatus ?? DEFAULT_STATUS;
  const sort: SortDirection = rawSort === 'asc' ? 'asc' : 'desc';

  const [{ orders: initialOrders, hasMore }, counts] = await Promise.all([
    listOrders({ farmerId: farmer.id, status, q, intake, page: 1, sort }),
    getOrderStatusCounts(farmer.id),
  ]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">訂單管理</h1>
      <OrdersFilters status={status} q={q} intake={intake} sort={sort} counts={counts} />
      <OrdersInfiniteList
        key={`${status}__${q}__${intake}__${sort}`}
        initialOrders={initialOrders}
        initialHasMore={hasMore}
        status={status}
        q={q}
        intake={intake}
        sort={sort}
      />
    </div>
  );
}
