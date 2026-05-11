'use server';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderItems, orderEvents, products, customers } from '@/lib/db/schema';
import { getCurrentFarmer, AuthError } from '@/lib/auth/get-current-farmer';
import { orderDraftFormSchema, type OrderDraftFormData } from '@/lib/validation/order-draft';

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

export async function saveOrderDraft(
  formData: OrderDraftFormData,
  meta: {
    rawText: string;
    confidence: number;
    ambiguities: string[];
    status: 'draft' | 'confirmed';
    imageStoragePaths?: string[];
  },
): Promise<{ orderId: string } | { error: string }> {
  let farmer;
  try {
    farmer = await getCurrentFarmer();
  } catch (err) {
    if (err instanceof AuthError) return { error: '請先登入' };
    return { error: '儲存失敗，請稍後重試' };
  }
  const farmerId = farmer.id;

  const parsed = orderDraftFormSchema.safeParse(formData);
  if (!parsed.success) return { error: '表單資料格式錯誤' };

  const data = parsed.data;

  // Re-fetch product prices from DB (authoritative source)
  const dbProducts = await db
    .select({ id: products.id, price: products.price })
    .from(products)
    .where(and(eq(products.farmer_id, farmerId)));

  const priceMap = new Map(dbProducts.map((p) => [p.id, Number(p.price)]));

  for (const item of data.items) {
    if (!priceMap.has(item.product_id)) {
      return { error: `商品不存在或不屬於此農友` };
    }
  }

  const totalAmount = data.items.reduce((sum, item) => {
    const price = priceMap.get(item.product_id) ?? 0;
    return sum + item.quantity * price;
  }, 0);

  const phone = normalizePhone(data.recipient_phone);
  const deliveryPref = data.delivery_preference === 'any' ? null : data.delivery_preference;
  const arrivalDate =
    data.delivery_preference === 'date' && data.desired_arrival_date
      ? data.desired_arrival_date
      : null;

  try {
    const result = await db.transaction(async (tx) => {
      // --- Generate order number (ORD-YYYYMMDD-NNN) ---
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart.getTime() + 86400000);

      const [{ dayCount }] = await tx
        .select({ dayCount: sql<number>`cast(count(*) as integer)` })
        .from(orders)
        .where(
          and(
            eq(orders.farmer_id, farmerId),
            gte(orders.created_at, todayStart),
            lt(orders.created_at, tomorrowStart),
          ),
        );

      const dateStr = todayStart.toISOString().split('T')[0].replace(/-/g, '');
      const seq = String((dayCount ?? 0) + 1).padStart(3, '0');
      const orderNumber = `ORD-${dateStr}-${seq}`;

      // --- Upsert customer ---
      const [existing] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.farmer_id, farmerId), eq(customers.primary_phone, phone)))
        .limit(1);

      let customerId: string;

      if (existing) {
        await tx
          .update(customers)
          .set({
            total_orders: sql`${customers.total_orders} + 1`,
            total_amount: sql`${customers.total_amount} + ${String(totalAmount)}::numeric`,
            last_ordered_at: new Date(),
            ...(data.recipient_name ? { default_name: data.recipient_name } : {}),
            ...(data.recipient_address ? { default_address: data.recipient_address } : {}),
          })
          .where(eq(customers.id, existing.id));
        customerId = existing.id;
      } else {
        const [newCustomer] = await tx
          .insert(customers)
          .values({
            farmer_id: farmerId,
            primary_phone: phone,
            default_name: data.recipient_name || null,
            default_address: data.recipient_address || null,
            total_orders: 1,
            total_amount: String(totalAmount),
            last_ordered_at: new Date(),
          })
          .returning({ id: customers.id });
        customerId = newCustomer.id;
      }

      // --- Insert order ---
      const [newOrder] = await tx
        .insert(orders)
        .values({
          farmer_id: farmerId,
          customer_id: customerId,
          order_number: orderNumber,
          intake_mode: meta.imageStoragePaths?.length ? 'image' : meta.rawText ? 'paste' : 'manual',
          raw_text: meta.rawText || null,
          raw_image_urls: meta.imageStoragePaths?.length ? meta.imageStoragePaths : undefined,
          parse_confidence: meta.rawText ? String(meta.confidence) : null,
          parse_ambiguities: meta.ambiguities.length ? meta.ambiguities : null,
          recipient_name: data.recipient_name,
          recipient_phone: phone,
          recipient_address: data.recipient_address || null,
          delivery_zip: data.delivery_zip || null,
          delivery_preference: deliveryPref,
          desired_arrival_date: arrivalDate,
          payment_method: data.payment_method,
          bank_last_5: data.bank_last_5 || null,
          notes: data.notes || null,
          status: meta.status,
          total_amount: String(totalAmount),
        })
        .returning({ id: orders.id });

      // --- Insert order items ---
      await tx.insert(orderItems).values(
        data.items.map((item) => {
          const unitPrice = priceMap.get(item.product_id) ?? 0;
          return {
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: String(unitPrice),
            subtotal: String(item.quantity * unitPrice),
          };
        }),
      );

      // --- Insert order_events 'created' ---
      await tx.insert(orderEvents).values({
        order_id: newOrder.id,
        event_type: 'created',
        payload: { source: 'paste', confidence: meta.confidence },
        created_by: 'farmer',
      });

      // --- If confirmed, add 'confirmed' event ---
      if (meta.status === 'confirmed') {
        await tx.insert(orderEvents).values({
          order_id: newOrder.id,
          event_type: 'confirmed',
          payload: null,
          created_by: 'farmer',
        });
      }

      return { orderId: newOrder.id };
    });

    return result;
  } catch (err) {
    console.error('[saveOrderDraft]', err);
    return { error: '儲存失敗，請稍後重試' };
  }
}
