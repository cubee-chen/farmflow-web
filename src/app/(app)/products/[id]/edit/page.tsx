import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/shared/product-form';
import { updateProduct } from '../../actions';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const farmer = await getCurrentFarmer();

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.farmer_id, farmer.id)))
    .limit(1);

  if (!product) notFound();

  const action = updateProduct.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">編輯商品</h1>
        <Button asChild variant="ghost">
          <Link href="/products">返回列表</Link>
        </Button>
      </div>
      <ProductForm
        action={action}
        initialValues={{
          display_name: product.display_name,
          price: Number(product.price),
          weight_g: product.weight_g ?? 0,
          description: product.description ?? '',
          short_aliases: product.short_aliases ?? [],
          sort_order: product.sort_order ?? 0,
          is_active: product.is_active ?? true,
          photo_url: product.photo_url ?? '',
        }}
      />
    </div>
  );
}
