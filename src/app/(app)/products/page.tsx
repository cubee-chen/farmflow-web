import { asc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/shared/product-card';

export default async function ProductsPage() {
  const farmer = await getCurrentFarmer();

  const productList = await db
    .select()
    .from(products)
    .where(eq(products.farmer_id, farmer.id))
    .orderBy(asc(products.sort_order), asc(products.display_name));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <Button asChild className="min-h-[44px]">
          <Link href="/products/new">新增商品</Link>
        </Button>
      </div>

      {productList.length === 0 ? (
        <div className="py-16 text-center text-zinc-500">
          還沒有商品，點右上方新增商品開始
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productList.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
