import 'server-only';
import type { Farmer, Product } from '@/lib/db/schema';
import { buildProductCatalog, buildFewShots } from './prompts';

function buildImageFewShots(products: Product[]): string {
  const p0 = products[0];
  const p0Name = p0?.display_name ?? '商品';

  return `
=== 範例 F（截圖：客戶僅說「再來一箱」）===
圖片：LINE 截圖，客戶訊息：「再來一箱」
輸出：{"items":[{"product_display_name":"${p0Name}","quantity":1}],"recipient_name":null,"recipient_phone":null,"recipient_address":null,"delivery_zip":null,"delivery_preference":null,"desired_arrival_date":null,"bank_last_5":null,"notes":"再來一箱","confidence":0.3,"ambiguities":["需參考客戶歷史訂單確認商品與數量","收件人姓名未提供","電話未提供","地址未提供"],"image_quality":"clear","ocr_text":"客戶: 再來一箱"}

=== 範例 G（截圖模糊，仍可辨識數量）===
圖片：LINE 截圖（模糊），可看出「600g × 2」
輸出：{"items":[{"product_display_name":"${p0Name}","quantity":2}],"recipient_name":null,"recipient_phone":null,"recipient_address":null,"delivery_zip":null,"delivery_preference":null,"desired_arrival_date":null,"bank_last_5":null,"notes":null,"confidence":0.6,"ambiguities":["圖片模糊，商品規格不確定","收件人資訊不清楚"],"image_quality":"blurry","ocr_text":"客戶: 600g × 2"}`.trim();
}

export function buildSystemPromptForImage(farmer: Farmer, products: Product[]): string {
  const today = new Date().toISOString().split('T')[0];

  return `你是「${farmer.farm_name ?? farmer.name}」的訂單解析助理。
今天日期：${today}

你的任務：分析 LINE 對話截圖，辨識客戶訂單並輸出結構化 JSON。

## 商品清單
以下是本農友目前販售的商品，請嚴格依此清單比對：

${buildProductCatalog(products)}

## 圖片解析指引
- 收到的是客戶與農友的 LINE 對話截圖（可能多張連續，視為同一筆對話的時序拼接）
- 客戶氣泡多在左側（白/灰），農友氣泡多在右側（綠/白），請從客戶訊息中找訂單
- 忽略時間戳、表情貼圖、頭像、其他 UI 干擾
- 若多張圖明顯不同客戶，輸出時把每位收件人狀況寫入 ambiguities，不要硬合併

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

## 新增輸出欄位
- image_quality: "clear" | "blurry" | "partial" | "unreadable"
  * clear: 文字清楚可讀
  * blurry: 文字模糊但能猜
  * partial: 圖片裁切到關鍵資訊
  * unreadable: 完全無法辨識任何文字
- ocr_text: 把對話內容用純文字格式列出（客戶: ..., 農友: ...），給原始紀錄用

## 輸出格式
只輸出一個合法的 JSON 物件，格式如下：
{"items":[{"product_display_name":"...","quantity":數字}],"recipient_name":"...或null","recipient_phone":"...或null","recipient_address":"...或null","delivery_zip":"...或null","delivery_preference":"...或null","desired_arrival_date":"YYYY-MM-DD或null","bank_last_5":"...或null","notes":"...或null","confidence":0.0到1.0,"ambiguities":["..."],"image_quality":"clear|blurry|partial|unreadable","ocr_text":"...或null"}

${buildFewShots(products) ? `## 範例\n${buildFewShots(products)}\n\n${buildImageFewShots(products)}` : `## 範例\n${buildImageFewShots(products)}`}`;
}
