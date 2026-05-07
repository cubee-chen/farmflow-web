# Claude Code Prompts｜P0 開發任務切分

> **使用方式**：每一節是一個獨立的 prompt，可直接整段貼到 Claude Code 視窗執行。  
> **執行順序**：依 Phase A → H 順序執行；同 Phase 內也建議照順序。  
> **粒度**：每個 prompt 預期 30–60 分鐘可完成（含驗證）。  
> **依據文件**：請參考同目錄的 `PRD.md`，以下任務是 P0 In Scope 的具體實作。

> **Git 規則**：每個 task 驗收通過後，Claude Code 執行以下 commit 流程：
> 1. `git add -A`
> 2. `git commit -m "feat(<scope>): <task-id> <簡述>"`
>    - scope 對照：schema/auth/intake/orders/products/fulfillment/pwa/deploy
>    - 範例：`feat(intake): P0-E1 LLM parser with structured JSON output`
> 3. **不要自動 push**，等我確認後再 push
> 4. P0 全部任務完成（H3 驗收通過）後執行：
>    `git tag -a v0.1.0 -m "P0 MVP complete: LINE to 黑貓出貨單"`
---

## 📌 環境前提（執行 P0-A1 前必須準備）

請先準備以下項目，並把值記在隨手筆記中——多個 prompt 會用到：

1. **Supabase 專案**：到 supabase.com 建專案，記下 `Project URL`、`anon key`、`service_role key`、`Database password`
2. **Anthropic API Key**：從 console.anthropic.com 拿，記為 `ANTHROPIC_API_KEY`
3. **Zeabur 專案**：建好但先不部署（最後 H2 才部署）
4. **本機環境**：Node.js 20+、pnpm 或 npm、git

---

# Phase A · 專案初始化

## P0-A1｜建立 Next.js 14 專案骨架

### 任務說明
建立 Next.js 14 (App Router) + TypeScript + Tailwind 專案，整合 shadcn/ui。這是所有後續工作的基礎。

### 指令

```
請建立一個新的 Next.js 14 專案，名為 farmflow-web，用以下技術棧：

- Next.js 14+ App Router、TypeScript strict mode、Tailwind CSS、ESLint + Prettier
- 套件管理用 pnpm
- 整合 shadcn/ui（new-york style，預設 zinc 色），先安裝以下元件：
  button、input、textarea、card、badge、dialog、dropdown-menu、tabs、table、select、toast、form、label、checkbox、scroll-area
- 安裝以下其他相依：
  drizzle-orm、postgres（或 @supabase/supabase-js + drizzle 連 Supabase）、@anthropic-ai/sdk、exceljs、date-fns、zod、react-hook-form、@hookform/resolvers、@tanstack/react-query、lucide-react、clsx、tailwind-merge
- 開發相依：
  drizzle-kit、tsx、@types/node
- 建立資料夾骨架：
  /src/app
  /src/components/ui （shadcn）
  /src/components/shared
  /src/lib/db
  /src/lib/llm
  /src/lib/utils
  /src/types
  /scripts
- 把 tsconfig.json paths 設定為 "@/*": ["src/*"]
- 建立 .env.example 含以下變數（值留空）：
  DATABASE_URL=
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ANTHROPIC_API_KEY=
  NODE_ENV=development
- 在 README.md 寫上：專案名稱、使用技術、本機啟動步驟（pnpm install、複製 .env.example 為 .env.local、pnpm dev）
- 確認 pnpm dev 可啟動，首頁顯示 "FarmFlow MVP — P0"
```

### 驗收標準
- [ ] `pnpm dev` 啟動無錯誤、首頁可訪問
- [ ] `pnpm typecheck` 無錯誤（先在 package.json 加上 typecheck 指令）
- [ ] shadcn 元件可正常 import
- [ ] `.env.example` 包含上述變數

---

## P0-A2｜Supabase 連線設定 + Drizzle 初始化

### 任務說明
把 Supabase 連線串好，並設定 Drizzle ORM。這個 task 不建立任何 schema，只是把工具鏈跑通。

### 前置
完成 P0-A1，並把 Supabase 的 `DATABASE_URL` 等值填到 `.env.local`。

### 指令

```
我已建立 Supabase 專案，請完成以下：

1. 在 /src/lib/db/index.ts 建立 Drizzle client：
   - 使用 postgres 套件（postgres-js driver）連 DATABASE_URL
   - 匯出 db client 與 sql client（後者給原生 SQL 用）
   - 在 server side 使用，client side 不能 import

2. 在 /drizzle.config.ts 建立 Drizzle Kit 設定：
   - schema 路徑：./src/lib/db/schema.ts
   - migration 輸出：./drizzle
   - dialect: postgresql

3. 在 /src/lib/supabase/server.ts 與 /src/lib/supabase/client.ts 建立 Supabase clients：
   - server 用 service role key（給 RLS bypass 的場景）
   - browser 用 anon key

4. 在 package.json 加入以下 scripts：
   - "db:generate": "drizzle-kit generate"
   - "db:migrate": "drizzle-kit migrate"
   - "db:push": "drizzle-kit push"
   - "db:studio": "drizzle-kit studio"

5. 暫時建立空 schema：/src/lib/db/schema.ts 匯出空物件，讓 Drizzle 可跑通

6. 寫一個簡單的健康檢查 API：/src/app/api/health/route.ts
   - GET 回傳 { ok: true, db: "connected" }
   - 在裡面跑 sql`SELECT 1` 驗證 DB 連線
```

### 驗收標準
- [ ] `curl http://localhost:3000/api/health` 回傳 `{"ok":true,"db":"connected"}`
- [ ] `pnpm db:studio` 可開啟 Drizzle Studio（即使 schema 是空的）
- [ ] `git commit -m "feat(<scope>): P0-XX <任務簡述>"` 已執行，`git log --oneline -1` 確認

---

# Phase B · 資料庫 Schema

## P0-B1｜撰寫完整 Drizzle Schema

### 任務說明
根據 PRD 第 6 節 ER Diagram，建立完整的 schema 檔案。這是 P0 最關鍵的單一檔案，後續所有業務邏輯都依賴這份 schema。

### 指令

```
請在 /src/lib/db/schema.ts 建立以下 7 張表的 Drizzle schema，全部使用 pgTable，所有 PK 都用 uuid（gen_random_uuid()），所有 timestamp 都帶時區（timestamp with time zone），預設 now()。

【表 1】farmers
- id: uuid PK
- name: text not null
- farm_name: text
- phone: text
- line_official_id: text  -- P1 用
- bank_account: text
- bank_name: text
- default_shipping_provider: text default 'tcat'
- notification_lead_time_hours: integer default 24
- created_at: timestamptz default now()

【表 2】products
- id: uuid PK
- farmer_id: uuid not null references farmers(id) on delete cascade
- display_name: text not null
- short_aliases: text[] -- 給 LLM 用
- sku: text
- description: text
- price: numeric(10,2) not null
- weight_g: integer
- is_active: boolean default true
- sort_order: integer default 0
- photo_url: text
- created_at: timestamptz default now()
- index on (farmer_id, is_active)

【表 3】customers
- id: uuid PK
- farmer_id: uuid not null references farmers(id) on delete cascade
- primary_phone: text not null  -- 業務上的 PK
- default_name: text
- default_address: text
- line_display_name: text
- notes: text
- total_orders: integer default 0
- total_amount: numeric(10,2) default 0
- last_ordered_at: timestamptz
- created_at: timestamptz default now()
- unique constraint on (farmer_id, primary_phone)

【表 4】orders
- id: uuid PK
- farmer_id: uuid not null references farmers(id)
- customer_id: uuid references customers(id)
- order_number: text unique
- intake_mode: text not null  -- 'paste' | 'line_webhook' | 'manual'
- raw_text: text
- parse_confidence: numeric(3,2)
- parse_ambiguities: jsonb
- recipient_name: text not null
- recipient_phone: text not null
- recipient_address: text
- delivery_zip: text
- delivery_preference: text
- desired_arrival_date: date
- ship_date: date
- shipping_provider: text
- tracking_number: text
- payment_method: text default 'transfer'
- payment_status: text default 'unpaid'
- bank_last_5: text
- paid_at: timestamptz
- status: text not null default 'draft' 
  -- 'draft' | 'confirmed' | 'packing' | 'shipped' | 'completed' | 'cancelled'
- total_amount: numeric(10,2) not null
- notes: text
- notified_customer_at: timestamptz
- created_at: timestamptz default now()
- updated_at: timestamptz default now()
- indexes on (farmer_id, status), (farmer_id, ship_date), (farmer_id, created_at)

【表 5】order_items
- id: uuid PK
- order_id: uuid not null references orders(id) on delete cascade
- product_id: uuid not null references products(id)
- quantity: integer not null
- unit_price: numeric(10,2) not null  -- 快照
- subtotal: numeric(10,2) not null

【表 6】order_events
- id: uuid PK
- order_id: uuid not null references orders(id) on delete cascade
- event_type: text not null  -- 'created' | 'confirmed' | 'paid' | 'shipped' | 'cancelled' | 'edited'
- payload: jsonb
- created_by: text  -- 'farmer' | 'system' | 'parser'
- created_at: timestamptz default now()
- index on (order_id, created_at desc)

【表 7】notification_templates
- id: uuid PK
- farmer_id: uuid not null references farmers(id) on delete cascade
- trigger_event: text not null  -- 'confirmed' | 'paid' | 'shipped'
- template_text: text not null  -- 含 {recipient_name} {total_amount} 變數
- is_active: boolean default true
- created_at: timestamptz default now()
- unique constraint on (farmer_id, trigger_event)

要求：
1. 所有 enum 值用 text 而非 pgEnum（讓 schema 演進容易）
2. 為每張表匯出兩個型別：`Farmer` (select) 與 `NewFarmer` (insert)，依此類推
3. 在檔案頂部加 import：import { pgTable, uuid, text, integer, numeric, timestamp, boolean, jsonb, date, index, uniqueIndex } from "drizzle-orm/pg-core"

完成後跑 `pnpm db:generate`，確認產生 SQL migration 檔在 /drizzle 資料夾。
```

### 驗收標準
- [ ] `/src/lib/db/schema.ts` 完整且通過 typecheck
- [ ] `pnpm db:generate` 成功，產生 0000_xxx.sql migration 檔
- [ ] 匯出 14 個型別（7 表 × 2）：`Farmer`/`NewFarmer`、`Product`/`NewProduct`...

---

## P0-B2｜套用 Migration 與 RLS Policy

### 任務說明
把 schema 推到 Supabase，並啟用 Row-Level Security 確保多農友資料隔離。

### 指令

```
請執行以下：

1. 跑 `pnpm db:migrate` 把 migration 套用到 Supabase
2. 跑 `pnpm db:studio` 確認 7 張表都建立成功

3. 在 /scripts/rls-policies.sql 寫入以下 RLS policies，並請我手動到 Supabase SQL Editor 執行：
   
   -- 啟用 RLS
   ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
   ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
   ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
   ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
   
   -- MVP 階段：service_role 可全表讀寫；anon/authenticated 暫無權限
   -- （之後 P4 做 Auth 時再開細粒度 policy）
   -- 由於 MVP 全部走後端 API + service role，先用簡化策略：
   
   CREATE POLICY "service_role_all" ON farmers FOR ALL TO service_role USING (true);
   CREATE POLICY "service_role_all" ON products FOR ALL TO service_role USING (true);
   CREATE POLICY "service_role_all" ON customers FOR ALL TO service_role USING (true);
   CREATE POLICY "service_role_all" ON orders FOR ALL TO service_role USING (true);
   CREATE POLICY "service_role_all" ON order_items FOR ALL TO service_role USING (true);
   CREATE POLICY "service_role_all" ON order_events FOR ALL TO service_role USING (true);
   CREATE POLICY "service_role_all" ON notification_templates FOR ALL TO service_role USING (true);
   
   -- 註：MVP 由後端 API 用 service_role 操作，並在程式碼層面強制
   --     所有 SELECT/UPDATE/DELETE 都帶 WHERE farmer_id = $current_farmer_id
   --     P1 接 Supabase Auth 後改為 RLS USING (farmer_id = auth.jwt() ->> 'farmer_id')

4. 驗證：用 Supabase SQL Editor 執行 SELECT * FROM farmers;，應回傳空集合且無錯誤
```

### 驗收標準
- [ ] 7 張表都在 Supabase 中可見
- [ ] RLS 已啟用（每張表的「Authentication」標示為 enabled）
- [ ] `/scripts/rls-policies.sql` 已存檔以利未來重建環境

---

## P0-B3｜種子資料腳本（4 位農友 + 商品）

### 任務說明
把四位種子農友與其商品寫入 DB。MVP 不做 Register Page，所以這個腳本是農友資料的唯一來源。

### 指令

```
請建立 /scripts/seed.ts：

依據以下資料把四位種子農友與商品寫入 DB（用 Drizzle）。
所有 phone、bank_account 用假資料（如 0900000001、郵局700-1234567890123）。
請先 DELETE FROM 各表清空，再 INSERT，讓腳本可重複執行。

==================== 農友 1：陳惠茹 ====================
farmer:
  name: 陳惠茹
  farm_name: 陳惠茹番茄
  default_shipping_provider: tcat

products:
  - display_name: 小箱
    short_aliases: ['小箱', '小的', '小盒']
    price: 600
    weight_g: 1500
    description: 玉女小番茄小箱
  - display_name: 中箱
    short_aliases: ['中箱', '中的']
    price: 900
    weight_g: 2500
    description: 玉女小番茄中箱
  - display_name: 大箱
    short_aliases: ['大箱', '大的', '大盒']
    price: 1200
    weight_g: 3500
    description: 玉女小番茄大箱

==================== 農友 2：徐方 ====================
farmer:
  name: 徐方
  farm_name: 喜蕃番茄

products:
  - display_name: 喜蕃小小箱
    short_aliases: ['小小箱', '小箱']
    price: 950
    weight_g: 2400
    description: 4 盒玉女小番茄
  - display_name: 喜蕃綜合箱
    short_aliases: ['綜合箱', '綜合']
    price: 1100
    weight_g: 2400
    description: 2 盒玉女 + 2 盒糖馨
  - display_name: 喜蕃大禮盒
    short_aliases: ['大禮盒', '大箱', '大的']
    price: 1400
    weight_g: 3600
    description: 6 盒玉女小番茄
  - display_name: 喜蕃大綜合
    short_aliases: ['大綜合']
    price: 1550
    weight_g: 3600
    description: 4 盒玉女 + 2 盒糖馨

==================== 農友 3：陳奕宏 ====================
farmer:
  name: 陳奕宏
  farm_name: 陳奕宏番茄園

products:
  - display_name: 玉女小番茄4入
    short_aliases: ['4入', '小箱', '一箱4盒']
    price: 899
    weight_g: 2400
    description: 一箱 4 盒，1 盒 600g
  - display_name: 玉女小番茄10入
    short_aliases: ['10入', '大箱', '一箱10盒']
    price: 1999
    weight_g: 6000
    description: 一箱 10 盒，1 盒 600g

==================== 農友 4：官庭安 ====================
farmer:
  name: 官庭安
  farm_name: 官庭安番茄

products:
  - display_name: 600g
    short_aliases: ['600g', '大盒', '大的']
    price: 350
    weight_g: 600
    description: 玉女小番茄 600g
  - display_name: 400g
    short_aliases: ['400g', '小盒', '小的']
    price: 250
    weight_g: 400
    description: 玉女小番茄 400g（針對年輕客群）

==================== 通知模板（每位農友共用） ====================
trigger_event=confirmed:
  我們已收到您的訂單～\n\n訂購內容：{items_summary}\n收件人：{recipient_name}\n地址：{recipient_address}\n金額：${total_amount}\n\n請在出貨前完成轉帳，麻煩告知帳號末五碼，謝謝！

trigger_event=shipped:
  您的訂單已出貨～\n貨運：{shipping_provider}\n單號：{tracking_number}\n預計到貨：{desired_arrival_date}\n收到請麻煩通知一聲，感謝！

請在 package.json 加入 "db:seed": "tsx scripts/seed.ts" 並執行驗證。
```

### 驗收標準
- [ ] `pnpm db:seed` 執行成功
- [ ] Drizzle Studio 中 farmers 表 4 筆、products 表 12 筆、notification_templates 表 8 筆
- [ ] 重複執行 `pnpm db:seed` 不會 duplicate（清空再寫）

---

# Phase C · 認證與 App Shell

## P0-C1｜簡化版農友切換器（dev-only）

### 任務說明
MVP 不做正規 Auth。我們用 cookie 帶 farmer_id 模擬登入態，並提供切換器讓開發/測試時可在四位農友間切換。

### 指令

```
請建立以下：

1. /src/lib/auth/farmer-context.ts
   - getCurrentFarmerId(): 從 cookies 讀 'current_farmer_id'，預設第一位農友（DB 查詢）
   - setCurrentFarmerId(farmerId): 設定 cookie，max-age 30 天
   - 全部走 next/headers 的 cookies()，server-only

2. /src/lib/auth/require-farmer.ts
   - getCurrentFarmer(): server-side helper，回傳完整 Farmer 物件（含 id、name、farm_name）
   - 若 cookie 無效或農友不存在，自動 fallback 到第一位農友

3. /src/components/shared/farmer-switcher.tsx
   - shadcn Select 元件，列出所有農友（farm_name + name）
   - 切換後 router.refresh()
   - 'use client' + server action setCurrentFarmerIdAction

4. /src/app/api/farmers/list/route.ts
   - GET 回傳所有農友（id, name, farm_name），給切換器用

5. 在 README 補上：「MVP 階段右上角的農友切換器是 dev tool，P4 會替換為正式登入」
```

### 驗收標準
- [ ] 啟動後預設為陳惠茹（或任一農友），cookie 有 `current_farmer_id`
- [ ] 切換農友後重新整理仍維持選擇
- [ ] `getCurrentFarmer()` 在任何 server component 都能正常 await 取得當前農友

---

## P0-C2｜App Shell 與行動側邊欄

### 任務說明
建立行動優先的 App Shell：頂部 bar（含農友切換器）、底部 tab bar（4 個主要頁面入口）。

### 指令

```
請建立 /src/app/(app)/layout.tsx 作為登入後主版面：

頂部 bar（h-14, sticky top-0, bg-white border-b）：
  - 左：FarmFlow 字標（小尺寸）
  - 右：FarmerSwitcher 元件

主內容區：
  - flex-1 overflow-auto
  - 父層為 min-h-screen flex flex-col

底部 tab bar（h-16, sticky bottom-0, 5 等分）：
  - 接單 (/intake) — Inbox icon
  - 訂單 (/orders) — ListOrdered icon
  - 出貨 (/fulfillment) — Truck icon
  - 商品 (/products) — Package icon
  - 設定 (/settings) — Settings icon
  
  - 當前路由 active 時：icon + label 變主色（emerald-600）
  - 其餘為 zinc-500
  - 觸控目標 ≥ 44px 高

樣式要求：
  - Tailwind only
  - 行動寬度 375px 完整顯示
  - desktop（≥ 1024px）：tab bar 改為左側 sidebar，main content 居中 max-w-5xl

請把 /src/app/page.tsx 重定向到 /intake（mvp 預設首頁）。

順便建立四個空頁面：
- /src/app/(app)/intake/page.tsx
- /src/app/(app)/orders/page.tsx
- /src/app/(app)/fulfillment/page.tsx
- /src/app/(app)/products/page.tsx
- /src/app/(app)/settings/page.tsx
每頁先放 <h1>{頁面名}</h1> 即可。
```

### 驗收標準
- [ ] 行動版 375px 寬下五個 tab 完整顯示、可切換
- [ ] Desktop 1280px 寬 sidebar 在左、內容居中
- [ ] 切換農友與切換頁面互不影響
- [ ] Lighthouse Mobile Accessibility ≥ 90

---

# Phase D · 商品管理

## P0-D1｜商品列表頁（卡片式）

### 任務說明
農友可在 `/products` 看到自己的所有商品，可上下架、可進入編輯。這是 LLM Parser 的「真相來源」，必須允許農友隨時修改。

### 指令

```
請在 /src/app/(app)/products/page.tsx 建立商品列表頁：

1. server component，從 DB 查當前農友的所有商品（含 inactive）

2. 排版：
   - 頂部：標題「商品管理」+「新增商品」按鈕（連到 /products/new）
   - 卡片清單（每張卡片是 ProductCard 元件）：
     * 卡片左上：display_name（粗體）+ price（NT$）
     * 卡片右上：is_active 的 Switch（toggle）— shadcn switch
     * 第二行：description（zinc-500 小字）
     * 第三行：short_aliases 顯示為 badge tags
     * 第四行：weight_g 顯示為「黑貓重量：X g」
     * 卡片右下：「編輯」按鈕 → /products/[id]/edit

3. /src/components/shared/product-card.tsx
   - 'use client'
   - 需要 server action toggleProductActive(productId)（建在 /src/app/(app)/products/actions.ts）
   - toggleProductActive 內部驗證 product.farmer_id === currentFarmerId

4. 空狀態：「還沒有商品，點右上方新增商品開始」

5. 響應式：行動單欄、平板雙欄、desktop 三欄

要求：所有 DB 查詢都帶 farmer_id 過濾，不可漏掉。
```

### 驗收標準
- [ ] 切到不同農友，商品列表正確隔離
- [ ] 切換 Switch 可即時上下架，無需 reload
- [ ] 觸控按鈕大小符合 44px

---

## P0-D2｜商品建立 / 編輯表單

### 任務說明
建立可重用的商品表單（建立與編輯共用），重點是把 short_aliases 設計成易用的 chip input。

### 指令

```
請建立：

1. /src/app/(app)/products/new/page.tsx 與 /src/app/(app)/products/[id]/edit/page.tsx
   兩者都用同一個 ProductForm 元件，只是 initialValues 不同。

2. /src/components/shared/product-form.tsx ('use client')
   使用 react-hook-form + zod。表單欄位：
   
   - display_name: text，required，max 50
   - price: number，required，> 0
   - weight_g: number，required，> 0（提示：「黑貓出貨計費用」）
   - description: textarea，max 200
   - short_aliases: 自訂 chip input
     * 顯示為一排可刪除的 badge
     * 下方有 input + Enter 加入新 alias
     * placeholder「客戶可能用的別名，例如：大箱、大的、大盒」
   - sort_order: number，預設 0
   - is_active: switch，預設 true
   - photo_url: text（先放純 URL 欄位，圖片上傳留 P1）

3. server actions：
   - createProduct(data)
   - updateProduct(id, data)
   - 兩者都驗證 farmer_id 屬於當前農友
   - 成功後 revalidatePath('/products') 並 redirect 回 /products

4. zod schema 提取到 /src/lib/validation/product.ts，可被其他地方 import

5. 失敗的 UX：
   - 表單級錯誤顯示在頂部紅色 alert
   - 欄位級錯誤直接在欄位下方
```

### 驗收標準
- [ ] 新增商品後立刻在列表頁看到
- [ ] short_aliases chip input 可加可刪，至少 1 個 alias 才能存
- [ ] 編輯既有商品所有欄位正確帶入

---

# Phase E · 訂單接收（核心）

## P0-E1｜LLM Parser 服務

### 任務說明
**P0 最核心的技術組件。** 把農友貼進來的訊息，透過 Claude API 解析成結構化訂單草稿。

### 指令

```
請建立 LLM Parser 服務：

1. /src/lib/llm/types.ts
   匯出 ParsedOrderDraft 型別：
   {
     items: Array<{ product_id: string; product_display_name: string; quantity: number }>;
     recipient_name: string | null;
     recipient_phone: string | null;
     recipient_address: string | null;
     delivery_zip: string | null;
     delivery_preference: string | null;
     desired_arrival_date: string | null;  // YYYY-MM-DD
     bank_last_5: string | null;
     notes: string | null;
     confidence: number;  // 0-1
     ambiguities: string[];
   }

2. /src/lib/llm/prompts.ts
   匯出 buildSystemPrompt(farmer, products): string
   依 PRD 第 7.2 節的模板組出完整 system prompt，注入：
   - 農友姓名
   - 商品目錄（display_name、price、description、short_aliases 全部列出）
   - 5 則 few-shot 範例（A 標準型、B 複合單、C 片段型、D 老客戶省略、E 特殊備註）
   
   範例請參考 PRD 7.3 節，根據種子農友的真實商品改寫，不要是抽象範例。

3. /src/lib/llm/parse.ts
   匯出 parseOrderText(rawText, farmer, products): Promise<ParsedOrderDraft>
   - 用 @anthropic-ai/sdk
   - model: 'claude-haiku-4-5' (使用最新可用)
   - max_tokens: 800
   - 強制 JSON 輸出（在 user message 結尾加「請只輸出 JSON，不要其他文字」）
   - 取回後 JSON.parse，並用 zod 驗證形狀；驗證失敗則 throw
   - 失敗時不要崩潰：catch 後回傳 confidence=0、ambiguities=['LLM 解析失敗，請手動填寫'] 的空草稿

4. /src/app/api/parse/route.ts
   POST { rawText: string }
   - 取當前農友 + 商品清單
   - 呼叫 parseOrderText
   - 回傳 ParsedOrderDraft + parsed_at timestamp
   - 在 server-side console.log 解析耗時與 token 使用（觀察成本）

5. /src/lib/validation/parsed-order.ts
   zod schema 對應 ParsedOrderDraft，給 API route 與後續存檔共用

注意事項：
- 整份檔案都是 server-only，不要被 client 拉走
- API key 走 process.env.ANTHROPIC_API_KEY
- 每次呼叫前 console.time，回應後 console.timeEnd 標示「LLM parse」
```

### 驗收標準
- [ ] 用 curl 或 Thunder Client POST `/api/parse` 帶任一段中文訂單文字，2-5 秒內回傳結構化結果
- [ ] 商品比對成功：客戶寫「我要 2 個大的」應對應到「喜蕃大禮盒」之類
- [ ] 解析失敗時不會 crash，會回傳低 confidence 草稿
- [ ] 100 筆樣本平均成本 < NT$15（檢視 Anthropic console）

---

## P0-E2｜訂單接收頁（貼上 + 解析 + 草稿）

### 任務說明
農友把 LINE 訊息貼進來、按解析、看結果、修改、存檔。這是 P0 最常被使用的頁面。

### 指令

```
請建立 /src/app/(app)/intake/page.tsx：

設計（行動優先）：
1. 頂部說明卡：「把 LINE 訊息貼進來，AI 會自動解析訂單」
2. 大型 textarea：min-h-40，placeholder「貼上 LINE 訊息或語音輸入文字...」
3. 兩個 sticky 底部按鈕（grid-cols-2 gap-2）：
   - 「清空」(secondary)
   - 「解析訂單」(primary，Sparkles icon) — 解析中顯示 loading spinner

互動：
- 'use client' 元件
- 點「解析訂單」→ 呼叫 /api/parse → 顯示草稿區（OrderDraftEditor 元件，下面 P0-E3 建立）
- 草稿出現後，textarea 區塊收合（顯示「原始訊息」可點擊展開）
- 草稿存檔成功 → router.push(`/orders/${newOrderId}`)
- 如果解析 confidence < 0.5，自動顯示警告 banner「解析信心較低，請仔細核對」

State 管理：
- useState 管 rawText、parsedDraft（可能為 null 或 ParsedOrderDraft）、isLoading
- 不用 react-query，這頁是純粹的單次操作

UX 細節：
- textarea 用 inputmode="text" 和 autocapitalize="sentences"
- 解析中按鈕 disabled 並顯示「AI 解析中...（約 5 秒）」
- 失敗用 toast 顯示「解析失敗，請稍後重試或手動建立訂單」+ 提供「手動建立」連結
```

### 驗收標準
- [ ] 貼一段測試訂單 → 點解析 → 5 秒內出現草稿
- [ ] 行動版 375px 寬整體流程順暢
- [ ] 解析失敗時 textarea 內容不丟失

---

## P0-E3｜訂單草稿編輯器（解析結果展示與修改）

### 任務說明
把 LLM 的解析結果用表單形式展示，農友可逐欄修改後存檔。**所有可疑欄位（ambiguities 提到的）要視覺強調。**

### 指令

```
請建立 /src/components/shared/order-draft-editor.tsx ('use client')：

Props:
- draft: ParsedOrderDraft
- rawText: string  // 用來存 raw_text
- products: Product[]
- onSaved: (orderId: string) => void

排版（行動單欄）：

【區塊 1：解析摘要】
- confidence 條（zinc 進度條）：< 0.5 紅、< 0.8 黃、≥ 0.8 綠
- ambiguities 用黃色 banner 列出（每條前綴 ⚠️）

【區塊 2：商品明細】
- 每筆 item 一張小卡片：
  * 商品 Select（從 products 過濾 is_active=true）
  * 數量 number input
  * 單價（自動帶入 product.price，灰色不可改）
  * 小計（自動算）
  * 右側「刪除」icon
- 「+ 新增商品」按鈕
- 底部顯示 total_amount

【區塊 3：收件人】
- recipient_name (text, required)
- recipient_phone (tel, inputmode=tel, required)
- recipient_address (text, required)
- delivery_zip (text, 自動從 address 抽，可手改)
- delivery_preference (select：都可以 / 只能平日 / 指定日期)
- desired_arrival_date (date, conditional 顯示)

【區塊 4：付款 + 備註】
- payment_method (select：銀行轉帳 / 貨到付款)
- bank_last_5 (text, optional)
- notes (textarea, optional)

【區塊 5：底部 sticky bar】
- 「取消」「存為草稿」「確認並存檔」
- 「存為草稿」：status='draft'
- 「確認並存檔」：status='confirmed'，並寫入 order_events 'confirmed' event

存檔邏輯（server action saveOrderDraft）：
1. 計算 total_amount
2. 插入 orders（含 raw_text, parse_confidence, parse_ambiguities）
3. 插入 order_items（unit_price 從 product.price 帶入快照）
4. 插入 order_events 'created'（payload: { source: 'paste', confidence }）
5. 若 status='confirmed'，再插一筆 order_events 'confirmed'
6. upsertCustomer：依 (farmer_id, recipient_phone) 找，找到就更新 last_ordered_at+1，找不到就新建
7. 用 transaction 確保原子性（drizzle 的 db.transaction）
8. 產生 order_number 格式：ORD-YYYYMMDD-NNN（NNN 為當日序號）

驗證：
- 所有必填欄位空 → 顯示錯誤、不可送出
- 數量 > 0、價格 > 0
- 電話格式正規化（去空白、連字號）

技術提示：
- form 用 react-hook-form + zod（schema 從 /src/lib/validation/order-draft.ts 匯入）
- 商品列表用 useFieldArray 處理動態新增/刪除
```

### 驗收標準
- [ ] 解析後的欄位正確帶入表單
- [ ] 修改任一欄位 → 提交 → DB 中正確存入
- [ ] 同一電話第二次下單 → customers 表只有一筆，total_orders+=1
- [ ] order_events 中至少有 'created'（status='confirmed' 時還要有 'confirmed'）
- [ ] 整個流程在行動 375px 寬可順利完成

---

# Phase F · 訂單管理

## P0-F1｜訂單列表頁（行動卡片 + 篩選）

### 任務說明
農友最常看的頁面之一，必須在行動端非常順暢。

### 指令

```
請建立 /src/app/(app)/orders/page.tsx (server component) + 對應的 client 元件：

頂部：
- 篩選列（橫向可滾動 chips）：
  * 全部
  * 待確認 (draft)
  * 已確認 (confirmed)
  * 待出貨 (confirmed + paid 且 ship_date >= today)
  * 已出貨 (shipped)
  * 已完成 (completed)
- 搜尋 input（text，搜 recipient_name / recipient_phone）
- 預設依 created_at desc

清單：
- 每張卡片：
  * 第一行：order_number + status badge（顏色映射：draft 灰、confirmed 藍、shipped 綠、completed 黑）
  * 第二行：recipient_name｜recipient_phone（電話用 tel: 連結）
  * 第三行：商品摘要（如「玉女小番茄4入 × 2」）
  * 第四行：total_amount（粗體）+ ship_date（如有）
  * 點卡片進 /orders/[id]
- 空狀態：「目前沒有訂單，去 /intake 接第一筆吧」

效能：
- server component 直接 SSR 第一頁
- 分頁：每頁 50 筆，infinite scroll 用 client component 載第二頁起（react-query useInfiniteQuery + /api/orders/list）
- WHERE 一律帶 farmer_id

URL state（搜尋與篩選）：
- 用 searchParams 同步，方便分享連結
- e.g. /orders?status=confirmed&q=王小明

樣式：
- 卡片間距 gap-2
- 行動 single column；md+ 雙欄
```

### 驗收標準
- [ ] 切換 status chip 立即重新查詢
- [ ] 200 筆訂單情境下 P95 < 1 秒
- [ ] URL 帶篩選參數可直接進入過濾後的視圖

---

## P0-F2｜訂單詳情 / 編輯頁

### 任務說明
單筆訂單的全部資訊一頁可編輯，含 timeline 與狀態變更按鈕。

### 指令

```
請建立 /src/app/(app)/orders/[id]/page.tsx (server component)：

排版：

【區塊 1：訂單頭】
- order_number + status badge
- 建立時間（相對：2 小時前）
- 兩個按鈕：「編輯」「刪除」
- 點「編輯」進入 inline 編輯模式（與 P0-E3 的 OrderDraftEditor 共用元件！只是 mode='edit'）

【區塊 2：訂單詳情卡】
- 商品明細（不可改）
- 收件資訊
- 付款資訊
- 備註

【區塊 3：狀態操作】
依當前 status 顯示可變更的下一步按鈕：
- draft → 「確認訂單」(status=confirmed)
- confirmed → 「標記已收款」(payment_status=paid) + 「標記已出貨」(status=shipped)
- shipped → 「標記已完成」(status=completed)
- 任何狀態 → 「取消訂單」(status=cancelled)

按鈕點下 → confirmation dialog → server action 更新 + 寫 order_events

【區塊 4：通知文案】
產生格式化文字（依 notification_templates 配置 + 訂單資料填空）
- 顯示為唯讀 textarea（可編輯後再複製）
- 「複製」按鈕（用 navigator.clipboard，成功 toast）
- 提示：「複製後到 LINE 貼給 {recipient_name}」

【區塊 5：訂單事件 timeline】
- 從 order_events 撈，按 created_at desc
- 每筆顯示：event_type icon + 中文敘述 + 相對時間
- e.g. 「📝 訂單建立 · 2 小時前 (透過 paste)」
- e.g. 「✅ 確認訂單 · 1 小時前」

【區塊 6：原始訊息】
- 折疊區塊，預設收合
- 展開顯示 raw_text（zinc 字、固定寬字體）

刪除訂單：
- confirmation 「確定刪除這筆訂單？此操作無法復原」
- 刪除後 redirect 回 /orders

權限：
- 所有 action 都驗證 order.farmer_id === currentFarmer.id，不符 throw 403
```

### 驗收標準
- [ ] 全部欄位都能在編輯模式下修改並儲存
- [ ] 狀態變更後 timeline 正確新增事件
- [ ] 通知文案複製按鈕在手機可用（包含 iOS Safari）
- [ ] 嘗試訪問非自己的訂單 ID 回 403

---

## P0-F3｜手動建立訂單入口

### 任務說明
即使沒有 LINE 訊息（電話訂單、自取），農友也要能直接建立訂單。

### 指令

```
請建立 /src/app/(app)/intake/manual/page.tsx：

直接渲染 OrderDraftEditor 元件，但 initialDraft 為空草稿：
{
  items: [],
  recipient_name: '',
  recipient_phone: '',
  ...
  confidence: 1.0,  // 手動建立信心 100%
  ambiguities: [],
}
rawText 為 null（intake_mode='manual'）

並在 /intake 頁面底部加一個次要連結：「沒有 LINE 訊息？手動建立訂單」連到此頁。

存檔時：
- intake_mode = 'manual'
- raw_text = null
- parse_confidence = null
```

### 驗收標準
- [ ] 從 /intake 可順暢進入手動模式
- [ ] 手動建立的訂單在 DB 中 `intake_mode = 'manual'`、`raw_text = null`

---

# Phase G · 出貨輸出

## P0-G1｜黑貓批次 Excel 匯出

### 任務說明
**P0 的最終價值兌現點。** 把當日 / 指定日期的訂單轉成黑貓「批次匯入」可直接吃的 .xlsx 檔。

### 指令

```
請建立：

1. /src/lib/shipping/tcat-excel.ts
   匯出 generateTcatBatchExcel(orders: OrderWithItems[]): Promise<Buffer>
   
   使用 exceljs，建立一個 workbook，sheet 名為「批次出貨」，欄位順序與標頭對應黑貓系統的批次匯入格式（必填項，請依以下欄位 — 若你不確定可以參考 farmer_details.md 中徐方的 Excel 分頁六設計，並先以保守欄位建出，第一版上線後我會手動拿黑貓真實樣本對欄）：
   
   - 收件人姓名 (orders.recipient_name)
   - 收件人電話 (orders.recipient_phone)
   - 收件人地址 (orders.recipient_address)
   - 寄件人姓名 (farmer.name)
   - 寄件人電話 (farmer.phone)
   - 寄件人地址 (預留欄位，先空白)
   - 商品名稱 (合併 order_items 顯示，如 "玉女小番茄4入x2")
   - 件數 (sum of quantity 或固定 1，看黑貓格式 — 預設用 sum)
   - 重量 (g) (sum of order_items.quantity * product.weight_g)
   - 代收金額 (若 payment_method='cod' 帶 total_amount，否則 0)
   - 希望配達日期 (desired_arrival_date 格式 YYYY/MM/DD，否則空)
   - 訂單備註 (orders.notes)
   
   每張表頭加底色（黃色），凍結首列。

2. /src/app/(app)/fulfillment/page.tsx
   排版：
   - 頂部：日期選擇器（預設明天，labels「選擇出貨日」）
   - 篩選 chips：
     * 「待出貨」(status=confirmed AND payment_status=paid)
     * 「全部待出貨（含未付款）」(status=confirmed)
   - 訂單清單（與 /orders 列表類似，但更簡潔，顯示收件人、電話、品項摘要）
   - 底部 sticky 兩個按鈕：
     * 「下載黑貓批次 Excel」(primary)
     * 「下載出貨彙總表」(secondary，連到 G2 視圖)
   
3. /src/app/api/shipping/tcat-export/route.ts
   POST { orderIds: string[] }
   - 驗證所有 orderIds 都屬於當前農友
   - 查 orders + 連 join order_items + products
   - 呼叫 generateTcatBatchExcel
   - 回傳檔案：Content-Type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, Content-Disposition=attachment; filename=tcat-export-YYYYMMDD.xlsx
   - 順便把這些訂單的 ship_date 更新為選定日期（如尚未設定）

4. 在 /fulfillment 頁面點下載後：
   - 用 fetch + blob 下載
   - 成功 toast「Excel 已下載，請打開黑貓系統 → 批次匯入」

5. 重要：把這些訂單在下載後選擇是否一鍵 mark as 'packing'（彈窗詢問）。
```

### 驗收標準
- [ ] 選 5 筆測試訂單 → 下載 Excel → 用 Excel 開啟，所有欄位齊備
- [ ] 重量正確（quantity × weight_g 加總）
- [ ] 中文無亂碼
- [ ] **手動上傳到黑貓 localhost「批次匯入」可成功（最後驗證請農友協助）**

---

## P0-G2｜出貨彙總視圖

### 任務說明
裝箱前的「總量視圖」：今天要包多少盒、多少箱、各品項各幾個。**這個畫面取代徐方 Excel 分頁三的功能。**

### 指令

```
請建立 /src/app/(app)/fulfillment/summary/page.tsx (server component)：

依日期參數 ?date=YYYY-MM-DD（預設明天）：

【區塊 1：總量卡（橫向 grid）】
依當前農友的所有 active products，顯示：
- 商品名稱 + 圖片小縮圖
- 待出貨總數量（從 order_items 加總，限該日訂單）
- 總重量（display 為 kg）

【區塊 2：訂單清單】
按 ship_date 篩選，列出每筆訂單：
- recipient_name + 電話末四碼
- 品項摘要
- 地址縮短（前 15 字 + ...）
- delivery_preference 用 badge 顯示
- 點選進 /orders/[id]

【底部按鈕】
「列印此頁」(window.print, 帶 print stylesheet：隱藏 nav，調整字體大小)
「下載 PDF」(P1 再做，先放 disabled 按鈕)

print 樣式：
- @media print：tab bar、頂部 bar 都 hidden
- 商品總量區用大字（24pt）
- 訂單清單按地址鄰近排序（先按 zip code）
```

### 驗收標準
- [ ] 切換日期能正確過濾訂單
- [ ] 各品項加總數量正確
- [ ] 「列印此頁」在桌面瀏覽器產生整潔的列印預覽
- [ ] 訂單依郵遞區號排序

---

## P0-G3｜通知模板設定頁

### 任務說明
讓農友可以編輯各狀態的通知模板。已有資料來自種子，但要可修改。

### 指令

```
請在 /src/app/(app)/settings/page.tsx 建立設定主頁：

Tabs：
- 商家資訊（顯示 farmer 基本資料，唯讀，提示「需管理員修改」）
- 通知模板（重點）
- 收款方式（顯示 bank_name + bank_account，唯讀）

通知模板 tab：
- 三個 card，對應 trigger_event in (confirmed, paid, shipped)
- 每個 card：
  * 標題：「訂單已確認時的通知文案」等
  * 大型 textarea（可編輯）
  * 下方說明：「可用變數：{recipient_name}、{items_summary}、{recipient_address}、{total_amount}、{tracking_number}」
  * 底部「儲存」按鈕（disabled 直到值變更）
  * 「預覽」按鈕：顯示填入示例值的 modal

server action：
- updateNotificationTemplate(triggerEvent, templateText)
- 驗證 farmer_id 隔離

預覽渲染：
- 簡單 string.replace 填入示例：{recipient_name} → 王小明、{total_amount} → 1400 等
- 使用 /src/lib/notification/render.ts 抽出 renderTemplate(template, vars) 函式

注意：在 P0-F2 的訂單詳情通知文案區塊已經有用到這個 renderTemplate 邏輯。本任務只是讓模板「可被編輯」。
```

### 驗收標準
- [ ] 修改任一模板 → 儲存 → 重新整理仍存在
- [ ] 預覽顯示填入後的真實樣貌
- [ ] 訂單詳情頁的通知文案使用最新的模板內容

---

# Phase H · PWA 與部署

## P0-H1｜PWA 配置

### 任務說明
讓農友可以「加入主畫面」當作 App 用。

### 指令

```
請完成 PWA 設定：

1. 安裝 next-pwa（注意 Next.js 14 App Router 相容版本：@ducanh2912/next-pwa）

2. /next.config.mjs 加入 PWA 配置：
   - dest: 'public'
   - disable: process.env.NODE_ENV === 'development'
   - register: true
   - skipWaiting: true
   
3. /public/manifest.json：
   {
     "name": "FarmFlow",
     "short_name": "FarmFlow",
     "description": "農友出貨流程管理",
     "start_url": "/intake",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#10b981",
     "orientation": "portrait",
     "icons": [
       { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
       { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
     ]
   }

4. /src/app/layout.tsx 補上 metadata：
   - manifest: '/manifest.json'
   - themeColor: '#10b981'
   - viewport: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no
   - apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style

5. 圖示生成：
   - 暫時放 placeholder（純色 + 「FF」字樣）
   - 用 ImageMagick 或請我手動換真圖
   - 在 /public/icons/ 放 icon-192.png、icon-512.png、icon-maskable-512.png
   - 同時建立 /public/icons/apple-touch-icon.png (180x180)

6. 在 README 加入：
   - 「行動裝置加入主畫面」步驟（iOS Safari、Android Chrome 各一段）
```

### 驗收標準
- [ ] iPhone Safari 訪問 → 分享 → 加入主畫面 → 圖示與名稱正確
- [ ] Android Chrome 訪問 → 自動跳出「安裝 App」提示
- [ ] Chrome DevTools Lighthouse 「Installable」項目 ✅
- [ ] 離線時開啟 App 至少能看到殼（不要白屏）

---

## P0-H2｜Zeabur 部署

### 任務說明
正式上線到 Zeabur Pro 環境，種子農友開始使用。

### 指令

```
請完成 Zeabur 部署：

1. 確認 /Dockerfile 或讓 Zeabur 自動偵測 Next.js（建議讓它自動偵測）

2. 建立 zeabur.json 或 .zeabur 配置（參考 Zeabur Agent Skills 文件）：
   - service: web
   - port: 3000
   - 環境變數設定提示（不寫 secrets，由 Zeabur UI 設定）

3. 環境變數清單（請貼到 Zeabur 控制台）：
   - DATABASE_URL（Supabase pooler URL，注意要用 transaction pooler 6543 port 而非 direct 5432，避免 Next.js serverless 連線爆掉）
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ANTHROPIC_API_KEY
   - NODE_ENV=production

4. 部署後驗證：
   - 訪問 production URL → 首頁可開
   - /api/health 回 ok
   - 手動建立一筆測試訂單，DB 中可看到

5. 自定 domain（可選 P0 上線前完成）：
   - 在 Zeabur 設定 custom domain
   - DNS CNAME 到 Zeabur

6. 在 README 補上 production URL 與 deploy guide
```

### 驗收標準
- [ ] Zeabur 部署成功，URL 可訪問
- [ ] /api/health 在 production 回 ok
- [ ] 解析訂單流程在 production 跑通（含 LLM）
- [ ] 行動裝置可訪問並加入主畫面

---

## P0-H3｜端到端驗收測試

### 任務說明
P0 的最後檢查清單。所有功能要逐項測試。

### 指令

```
請建立 /docs/p0-acceptance-checklist.md 並執行以下端到端測試：

測試帳號：陳惠茹

1. [ ] 登入後預設在 /intake，農友切換器顯示「陳惠茹」
2. [ ] 切到 /products → 看到 3 樣商品（小箱、中箱、大箱）
3. [ ] 新增一個商品「特大箱」，價格 1500，alias 「特大」 → 列表立即顯示
4. [ ] 上下架切換可運作
5. [ ] 回 /intake，貼以下測試訊息：
      "我要訂 2 個大箱，0912345678 王太太，台北市信義區忠孝東路 5 段 1 號"
6. [ ] LLM 解析回傳：items=[{display_name:'大箱',quantity:2}], recipient_name='王太太', phone, address 都正確
7. [ ] 修改 quantity 為 3 → 存為已確認 → 跳到 /orders/[id]
8. [ ] timeline 顯示 created + confirmed
9. [ ] 訂單詳情通知文案區可複製
10. [ ] 切回 /orders → 看到此訂單，狀態 confirmed
11. [ ] 標記為已收款 → payment_status=paid
12. [ ] 標記為已出貨 → status=shipped, timeline 多一筆
13. [ ] 切到 /fulfillment → 選日期 → 看到此訂單
14. [ ] 下載黑貓 Excel → 開啟 → 欄位完整無亂碼
15. [ ] 切到 /fulfillment/summary → 看到「大箱 × 3」彙總
16. [ ] 切到 /settings → 編輯通知模板「已出貨」→ 儲存
17. [ ] 切換農友到「徐方」→ 商品列表變成喜蕃系列
18. [ ] 切回陳惠茹 → 訂單列表只看到陳惠茹的訂單
19. [ ] 新分頁開無痕 → 訪問另一農友 ID 的訂單 → 403

技術驗證：
20. [ ] Lighthouse Mobile 跑 /intake、/orders、/fulfillment：
       - Performance ≥ 80, Accessibility ≥ 90, Best Practices ≥ 90, PWA ≥ 90
21. [ ] DevTools Network → /api/parse 回應時間 < 5s
22. [ ] DevTools Network → /api/orders/list 回應時間 < 1s
23. [ ] iPhone SE 寬度（375px）所有頁面無水平滾動
24. [ ] 加入主畫面 → 從主畫面開啟 → 無瀏覽器 UI

完成所有項目後，請整理一份「P0 已完成 vs 已知 issue 清單」回報。
```

### 驗收標準
- [ ] 24 項測試全部通過
- [ ] 已知 issue 不超過 3 項，且都不是阻擋核心流程的問題
- [ ] 帶兩位種子農友（官庭安、陳惠茹）線上 demo 一輪，確認 willingness to use

---

# 📊 P0 任務總覽

| Task | 預估時間 | 依賴 |
|------|----------|------|
| A1 專案初始化 | 60m | – |
| A2 Supabase + Drizzle | 30m | A1 |
| B1 Schema 撰寫 | 60m | A2 |
| B2 RLS Policy | 30m | B1 |
| B3 Seed 腳本 | 45m | B2 |
| C1 農友 Context | 30m | B3 |
| C2 App Shell | 45m | C1 |
| D1 商品列表 | 45m | C2 |
| D2 商品表單 | 60m | D1 |
| **E1 LLM Parser** | **90m** | **D2** |
| E2 訂單接收頁 | 45m | E1 |
| E3 草稿編輯器 | 90m | E1 |
| F1 訂單列表 | 45m | E3 |
| F2 訂單詳情 | 60m | F1 |
| F3 手動建立 | 30m | E3 |
| G1 黑貓 Excel | 60m | F2 |
| G2 出貨彙總 | 45m | F2 |
| G3 通知模板 | 45m | F2 |
| H1 PWA | 30m | G3 |
| H2 Zeabur 部署 | 30m | H1 |
| H3 端到端驗收 | 90m | H2 |
| **Total** | **~17–18 小時** | |

預期實際開發時間（含調試、學習、農友溝通）：**3 週（每週 ~6 小時）**。

---

## 💡 給 Claude Code 使用者的提示

1. **不要一次貼多個 prompt。** 每個 task 跑完、驗證、commit 後，再貼下一個。
2. **遇到歧義先問。** 任何 prompt 中沒明確定義的 UI 細節（顏色、間距），讓 Claude Code 先問你，不要自行創造。
3. **Test 邊做邊寫。** 雖然 prompt 沒明寫單元測試需求，但 LLM Parser、Excel 匯出、狀態機這三個地方建議手動補測試（用 vitest）。
4. **Commit message 用 conventional commits**：feat:、fix:、chore:。每個 task 完成都該是一個獨立 commit。
5. **PR 描述貼上對應 prompt 編號**：如「Closes P0-E1」，方便日後追溯。

---

**文件結束。執行愉快！**
