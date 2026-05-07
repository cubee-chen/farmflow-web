'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { getCurrentFarmerId } from '@/lib/auth/farmer-context';
import { productSchema, type ProductFormData } from '@/lib/validation/product';

export async function createProduct(data: ProductFormData): Promise<{ error: string } | void> {
  const farmerId = await getCurrentFarmerId();
  if (!farmerId) return { error: '請先選擇農友' };

  const parsed = productSchema.safeParse(data);
  if (!parsed.success) return { error: '資料格式錯誤，請確認所有欄位' };

  const { display_name, price, weight_g, description, short_aliases, sort_order, is_active, photo_url } =
    parsed.data;

  await db.insert(products).values({
    farmer_id: farmerId,
    display_name,
    price: String(price),
    weight_g,
    description: description || null,
    short_aliases,
    sort_order,
    is_active,
    photo_url: photo_url || null,
  });

  revalidatePath('/products');
  redirect('/products');
}

export async function updateProduct(id: string, data: ProductFormData): Promise<{ error: string } | void> {
  const farmerId = await getCurrentFarmerId();
  if (!farmerId) return { error: '請先選擇農友' };

  const parsed = productSchema.safeParse(data);
  if (!parsed.success) return { error: '資料格式錯誤，請確認所有欄位' };

  const { display_name, price, weight_g, description, short_aliases, sort_order, is_active, photo_url } =
    parsed.data;

  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, id), eq(products.farmer_id, farmerId)))
    .limit(1);

  if (!existing) return { error: '找不到商品或無權限' };

  await db
    .update(products)
    .set({
      display_name,
      price: String(price),
      weight_g,
      description: description || null,
      short_aliases,
      sort_order,
      is_active,
      photo_url: photo_url || null,
    })
    .where(and(eq(products.id, id), eq(products.farmer_id, farmerId)));

  revalidatePath('/products');
  redirect('/products');
}

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
