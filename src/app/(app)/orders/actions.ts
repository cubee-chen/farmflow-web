'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { orders, orderItems, orderEvents, products } from '@/lib/db/schema';
import { getCurrentFarmerId } from '@/lib/auth/farmer-context';
import { orderDraftFormSchema, type OrderDraftFormData } from '@/lib/validation/order-draft';

async function verifyOrder(orderId: string, farmerId: string) {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.farmer_id, farmerId)))
    .limit(1);
  return row ?? null;
}

export async function updateOrder(
  orderId: string,
  formData: OrderDraftFormData,
): Promise<{ error: string } | void> {
  const farmerId = await getCurrentFarmerId();
  if (!farmerId) return { error: '請先選擇農友' };
  if (!(await verifyOrder(orderId, farmerId))) return { error: '訂單不存在或無權限' };

  const parsed = orderDraftFormSchema.safeParse(formData);
  if (!parsed.success) return { error: '資料格式錯誤' };
  const data = parsed.data;

  const dbProducts = await db
    .select({ id: products.id, price: products.price })
    .from(products)
    .where(eq(products.farmer_id, farmerId));
  const priceMap = new Map(dbProducts.map((p) => [p.id, Number(p.price)]));

  for (const item of data.items) {
    if (!priceMap.has(item.product_id)) return { error: '商品不存在' };
  }

  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.quantity * (priceMap.get(item.product_id) ?? 0),
    0,
  );

  const deliveryPref = data.delivery_preference === 'any' ? null : data.delivery_preference;
  const arrivalDate =
    data.delivery_preference === 'date' && data.desired_arrival_date
      ? data.desired_arrival_date
      : null;

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        recipient_name: data.recipient_name,
        recipient_phone: data.recipient_phone.replace(/[\s\-()]/g, ''),
        recipient_address: data.recipient_address || null,
        delivery_zip: data.delivery_zip || null,
        delivery_preference: deliveryPref,
        desired_arrival_date: arrivalDate,
        payment_method: data.payment_method,
        bank_last_5: data.bank_last_5 || null,
        notes: data.notes || null,
        total_amount: String(totalAmount),
        updated_at: new Date(),
      })
      .where(eq(orders.id, orderId));

    await tx.delete(orderItems).where(eq(orderItems.order_id, orderId));

    await tx.insert(orderItems).values(
      data.items.map((item) => {
        const unitPrice = priceMap.get(item.product_id) ?? 0;
        return {
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: String(unitPrice),
          subtotal: String(item.quantity * unitPrice),
        };
      }),
    );

    await tx.insert(orderEvents).values({
      order_id: orderId,
      event_type: 'updated',
      payload: null,
      created_by: 'farmer',
    });
  });

  revalidatePath(`/orders/${orderId}`);
}

export async function changeOrderStatus(
  orderId: string,
  action: 'confirm' | 'pay' | 'ship' | 'complete' | 'cancel',
): Promise<{ error: string } | void> {
  const farmerId = await getCurrentFarmerId();
  if (!farmerId) return { error: '請先選擇農友' };
  if (!(await verifyOrder(orderId, farmerId))) return { error: '訂單不存在或無權限' };

  const now = new Date();
  let update: Record<string, unknown>;
  let eventType: string;

  if (action === 'confirm') {
    update = { status: 'confirmed' };
    eventType = 'confirmed';
  } else if (action === 'pay') {
    update = { payment_status: 'paid', paid_at: now };
    eventType = 'paid';
  } else if (action === 'ship') {
    update = { status: 'shipped' };
    eventType = 'shipped';
  } else if (action === 'complete') {
    update = { status: 'completed' };
    eventType = 'completed';
  } else {
    update = { status: 'cancelled' };
    eventType = 'cancelled';
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ ...(update as any), updated_at: now })
      .where(eq(orders.id, orderId));

    await tx.insert(orderEvents).values({
      order_id: orderId,
      event_type: eventType,
      payload: null,
      created_by: 'farmer',
    });
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
}

export async function deleteOrder(orderId: string): Promise<{ error: string } | void> {
  const farmerId = await getCurrentFarmerId();
  if (!farmerId) return { error: '請先選擇農友' };
  if (!(await verifyOrder(orderId, farmerId))) return { error: '訂單不存在或無權限' };

  await db.delete(orders).where(eq(orders.id, orderId));
  redirect('/orders');
}
