import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { CustomersClient } from './_components/customers-client';

export default async function CustomersPage() {
  const farmer = await getCurrentFarmer();

  const customerList = await db
    .select()
    .from(customers)
    .where(eq(customers.farmer_id, farmer.id))
    .orderBy(desc(customers.last_ordered_at), desc(customers.created_at));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">客戶管理</h1>
      <CustomersClient customers={customerList} />
    </div>
  );
}
