import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { listFulfillmentOrders, type FulfillmentStage } from '@/lib/queries/fulfillment';
import { FulfillmentClient } from './_components/fulfillment-client';

interface Props {
  searchParams: Promise<{ stage?: string; filter?: string }>;
}

function parseStage(raw: string | undefined): FulfillmentStage {
  if (raw === 'packing' || raw === 'all') return raw;
  return 'todo';
}

export default async function FulfillmentPage({ searchParams }: Props) {
  const farmer = await getCurrentFarmer();
  const { stage: rawStage, filter = 'paid_only' } = await searchParams;
  const stage = parseStage(rawStage);

  const orders = await listFulfillmentOrders({
    farmerId: farmer.id,
    stage,
    includeUnpaid: filter === 'all',
  });

  return (
    <div className="pb-28">
      <h1 className="text-2xl font-bold mb-4">出貨管理</h1>
      <FulfillmentClient orders={orders} activeStage={stage} activeFilter={filter} />
    </div>
  );
}
