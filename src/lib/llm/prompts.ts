import 'server-only';
import type { Farmer, Product } from '@/lib/db/schema';

function buildProductCatalog(products: Product[]): string {
  return products
    .map((p) => {
      const aliases = p.short_aliases?.length ? `（別名：${p.short_aliases.join('、')}）` : '';
      const desc = p.description ? ` — ${p.description}` : '';
      return `• ${p.display_name}${aliases}，NT$${Number(p.price).toLocaleString()}${desc}`;
    })
    .join('\n');
}

function buildFewShots(products: Product[]): string {
  const p0 = products[0];
  const p1 = products[1] ?? products[0];
  const p2 = products[2] ?? products[0];

  // Alias helpers for examples
  const alias0 = p0.short_aliases?.[1] ?? p0.display_name;
  const alias2 = p2.short_aliases?.[1] ?? p2.display_name;

  return `
=== 範例 A（標準型，資訊完整）===
訊息：「我要訂兩箱${alias0}，寄給王小明，電話0912345678，台北市信義區信義路五段7號，謝謝」
輸出：{"items":[{"product_display_name":"${p0.display_name}","quantity":2}],"recipient_name":"王小明","recipient_phone":"0912345678","recipient_address":"台北市信義區信義路五段7號","delivery_zip":null,"delivery_preference":null,"desired_arrival_date":null,"bank_last_5":null,"notes":null,"confidence":0.95,"ambiguities":[]}

=== 範例 B（複合單，多項商品）===
訊息：「我要1${p1.display_name}1${p2.display_name}，收件人陳美玲 0987654321 新北市板橋區文化路100號 3/15到」
輸出：{"items":[{"product_display_name":"${p1.display_name}","quantity":1},{"product_display_name":"${p2.display_name}","quantity":1}],"recipient_name":"陳美玲","recipient_phone":"0987654321","recipient_address":"新北市板橋區文化路100號","delivery_zip":null,"delivery_preference":null,"desired_arrival_date":"2025-03-15","bank_last_5":null,"notes":null,"confidence":0.92,"ambiguities":[]}

=== 範例 C（片段型，地址缺漏）===
訊息：「3${alias0} 張大明 0911222333」
輸出：{"items":[{"product_display_name":"${p0.display_name}","quantity":3}],"recipient_name":"張大明","recipient_phone":"0911222333","recipient_address":null,"delivery_zip":null,"delivery_preference":null,"desired_arrival_date":null,"bank_last_5":null,"notes":null,"confidence":0.8,"ambiguities":["未提供收件地址"]}

=== 範例 D（老客戶，大量資訊缺漏）===
訊息：「老樣子 2${p1.display_name}謝謝」
輸出：{"items":[{"product_display_name":"${p1.display_name}","quantity":2}],"recipient_name":null,"recipient_phone":null,"recipient_address":null,"delivery_zip":null,"delivery_preference":null,"desired_arrival_date":null,"bank_last_5":null,"notes":"老樣子","confidence":0.5,"ambiguities":["收件人姓名未提供","電話未提供","地址未提供"]}

=== 範例 E（特殊備註 + 轉帳末五碼）===
訊息：「要一${alias2} 收件人劉怡婷 0955333444 台中市西屯區台灣大道三段828號 請在下午到貨 末五碼12345」
輸出：{"items":[{"product_display_name":"${p2.display_name}","quantity":1}],"recipient_name":"劉怡婷","recipient_phone":"0955333444","recipient_address":"台中市西屯區台灣大道三段828號","delivery_zip":null,"delivery_preference":"下午到貨","desired_arrival_date":null,"bank_last_5":"12345","notes":"請在下午到貨","confidence":0.93,"ambiguities":[]}`.trim();
}

export function buildSystemPrompt(farmer: Farmer, products: Product[]): string {
  const today = new Date().toISOString().split('T')[0];

  return `你是「${farmer.farm_name ?? farmer.name}」的訂單解析助理。
今天日期：${today}

你的任務：把農友收到的客戶訊息解析成結構化訂單 JSON。

## 商品清單
以下是本農友目前販售的商品，請嚴格依此清單比對：

${buildProductCatalog(products)}

## 解析規則
1. product_display_name 必須完全符合上方商品清單中的名稱，不可自創。
2. 若客戶使用別名（括號中的詞），請對應到正確的 display_name。
3. desired_arrival_date 統一輸出 YYYY-MM-DD 格式；相對日期（如「明天」）依今天日期換算。
4. bank_last_5：只取末 5 碼數字（去掉「末五碼」等文字）。
5. delivery_zip：若地址中含郵遞區號（3-6 碼數字），單獨提取；否則 null。
6. confidence：0.0-1.0，反映解析確信度（資訊完整 ≥ 0.9，有缺漏 0.5-0.89，嚴重不足 < 0.5）。
7. ambiguities：列出所有不確定或缺少的資訊，讓農友補充。
8. 無法識別的商品請加入 ambiguities，items 中略過。
9. 所有缺少的欄位填 null，不要填空字串。

## 輸出格式
只輸出一個合法的 JSON 物件，格式如下：
{"items":[{"product_display_name":"...","quantity":數字}],"recipient_name":"...或null","recipient_phone":"...或null","recipient_address":"...或null","delivery_zip":"...或null","delivery_preference":"...或null","desired_arrival_date":"YYYY-MM-DD或null","bank_last_5":"...或null","notes":"...或null","confidence":0.0到1.0,"ambiguities":["..."]}

## 範例
${buildFewShots(products)}`;
}
