'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmerId } from '@/lib/auth/farmer-context';

export async function toggleProductActive(productId: string) {
  const farmerId = await getCurrentFarmerId();
  if (!farmerId) throw new Error('No active farmer');

  const [product] = await db
    .select({ id: products.id, is_active: products.is_active })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.farmer_id, farmerId)))
    .limit(1);

  if (!product) throw new Error('Product not found or access denied');

  await db
    .update(products)
    .set({ is_active: !product.is_active })
    .where(and(eq(products.id, productId), eq(products.farmer_id, farmerId)));

  revalidatePath('/products');
}
