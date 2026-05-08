import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { IntakeClient } from './_components/intake-client';

export default async function IntakePage() {
  const farmer = await getCurrentFarmer();

  const productList = await db
    .select()
    .from(products)
    .where(eq(products.farmer_id, farmer.id))
    .orderBy(asc(products.sort_order), asc(products.display_name));

  return <IntakeClient products={productList} />;
}
