import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { ManualIntakeClient } from './_components/manual-intake-client';

export default async function ManualIntakePage() {
  const farmer = await getCurrentFarmer();

  const productList = await db
    .select()
    .from(products)
    .where(eq(products.farmer_id, farmer.id))
    .orderBy(asc(products.sort_order), asc(products.display_name));

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">手動建立訂單</h1>
      <ManualIntakeClient products={productList} />
    </div>
  );
}
