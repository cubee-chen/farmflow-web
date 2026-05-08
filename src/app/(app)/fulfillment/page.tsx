import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { listFulfillmentOrders } from '@/lib/queries/fulfillment';
import { FulfillmentClient } from './_components/fulfillment-client';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

export default async function FulfillmentPage({ searchParams }: Props) {
  const farmer = await getCurrentFarmer();
  const { filter = 'paid_only' } = await searchParams;

  const orders = await listFulfillmentOrders({
    farmerId: farmer.id,
    includeUnpaid: filter === 'all',
  });

  return (
    <div className="pb-28">
      <h1 className="text-2xl font-bold mb-4">出貨管理</h1>
      <FulfillmentClient orders={orders} activeFilter={filter} />
    </div>
  );
}
