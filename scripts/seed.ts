import { db } from '../src/lib/db';
import {
  farmers,
  products,
  customers,
  orders,
  orderItems,
  orderEvents,
  notificationTemplates,
} from '../src/lib/db/schema';

const NOTIFICATION_TEXTS: Record<string, string> = {
  confirmed:
    '我們已收到您的訂單～\n\n訂購內容：{items_summary}\n收件人：{recipient_name}\n地址：{recipient_address}\n金額：${total_amount}\n\n請在出貨前完成轉帳，麻煩告知帳號末五碼，謝謝！',
  shipped:
    '您的訂單已出貨～\n貨運：{shipping_provider}\n單號：{tracking_number}\n預計到貨：{desired_arrival_date}\n收到請麻煩通知一聲，感謝！',
};

const SEED_FARMERS = [
  {
    name: '陳惠茹',
    farm_name: '陳惠茹番茄',
    phone: '0900000001',
    bank_account: '700-1234567890123',
    bank_name: '郵局',
    default_shipping_provider: 'tcat',
    products: [
      { display_name: '小箱', short_aliases: ['小箱', '小的', '小盒'], price: '600', weight_g: 1500, description: '玉女小番茄小箱' },
      { display_name: '中箱', short_aliases: ['中箱', '中的'], price: '900', weight_g: 2500, description: '玉女小番茄中箱' },
      { display_name: '大箱', short_aliases: ['大箱', '大的', '大盒'], price: '1200', weight_g: 3500, description: '玉女小番茄大箱' },
    ],
  },
  {
    name: '徐方',
    farm_name: '喜蕃番茄',
    phone: '0900000002',
    bank_account: '700-1234567890124',
    bank_name: '郵局',
    default_shipping_provider: 'tcat',
    products: [
      { display_name: '喜蕃小小箱', short_aliases: ['小小箱', '小箱'], price: '950', weight_g: 2400, description: '4 盒玉女小番茄' },
      { display_name: '喜蕃綜合箱', short_aliases: ['綜合箱', '綜合'], price: '1100', weight_g: 2400, description: '2 盒玉女 + 2 盒糖馨' },
      { display_name: '喜蕃大禮盒', short_aliases: ['大禮盒', '大箱', '大的'], price: '1400', weight_g: 3600, description: '6 盒玉女小番茄' },
      { display_name: '喜蕃大綜合', short_aliases: ['大綜合'], price: '1550', weight_g: 3600, description: '4 盒玉女 + 2 盒糖馨' },
    ],
  },
  {
    name: '陳奕宏',
    farm_name: '陳奕宏番茄園',
    phone: '0900000003',
    bank_account: '700-1234567890125',
    bank_name: '郵局',
    default_shipping_provider: 'tcat',
    products: [
      { display_name: '玉女小番茄4入', short_aliases: ['4入', '小箱', '一箱4盒'], price: '899', weight_g: 2400, description: '一箱 4 盒，1 盒 600g' },
      { display_name: '玉女小番茄10入', short_aliases: ['10入', '大箱', '一箱10盒'], price: '1999', weight_g: 6000, description: '一箱 10 盒，1 盒 600g' },
    ],
  },
  {
    name: '官庭安',
    farm_name: '官庭安番茄',
    phone: '0900000004',
    bank_account: '700-1234567890126',
    bank_name: '郵局',
    default_shipping_provider: 'tcat',
    products: [
      { display_name: '600g', short_aliases: ['600g', '大盒', '大的'], price: '350', weight_g: 600, description: '玉女小番茄 600g' },
      { display_name: '400g', short_aliases: ['400g', '小盒', '小的'], price: '250', weight_g: 400, description: '玉女小番茄 400g（針對年輕客群）' },
    ],
  },
];

async function seed() {
  console.log('Clearing existing data...');
  // Delete in FK-safe order
  await db.delete(notificationTemplates);
  await db.delete(orderEvents);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(customers);
  await db.delete(products);
  await db.delete(farmers);

  console.log('Inserting seed data...');
  for (const farmerData of SEED_FARMERS) {
    const { products: farmerProducts, ...farmerFields } = farmerData;

    const [farmer] = await db.insert(farmers).values(farmerFields).returning({ id: farmers.id });

    for (let i = 0; i < farmerProducts.length; i++) {
      await db.insert(products).values({
        farmer_id: farmer.id,
        sort_order: i,
        ...farmerProducts[i],
      });
    }

    for (const [trigger_event, template_text] of Object.entries(NOTIFICATION_TEXTS)) {
      await db.insert(notificationTemplates).values({
        farmer_id: farmer.id,
        trigger_event,
        template_text,
      });
    }

    console.log(`  ✓ ${farmerData.name} — ${farmerProducts.length} products, 2 templates`);
  }

  console.log('\nSeed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
