# FarmFlow

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cubee-chen/farmflow-web)

團購管理平台 MVP

## 正式環境

Production URL: `https://farmflow-web.vercel.app`

部署狀態：每次 push `main` 分支自動重新部署。

## 技術棧

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york / zinc)
- **Database**: Drizzle ORM + Supabase (PostgreSQL)
- **AI**: Anthropic Claude SDK
- **Forms**: React Hook Form + Zod
- **Data fetching**: TanStack Query
- **Utilities**: date-fns, ExcelJS, lucide-react

## 本機啟動

```bash
pnpm install
cp .env.example .env.local
# 填入 .env.local 的環境變數
pnpm dev
```

## 環境變數

| 變數名 | 說明 |
|--------|------|
| `DATABASE_URL` | Supabase transaction pooler URL（port **6543**，不可用 5432）<br>`postgresql://postgres.[ref]:[pw]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgmode=transaction` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key（server only） |
| `ANTHROPIC_API_KEY` | Anthropic API key，用於 LLM 訂單解析 |
| `ADMIN_SECRET` | P1 起：用於 `/admin/health` 監控頁與 `/api/admin/*` 端點守門 |
| `CRON_SECRET` | P1 起：用於 `/api/cron/*` 端點守門（Vercel cron 觸發時自動帶此 Bearer header） |

Vercel 部署：到 **Settings → Environment Variables** 貼上以上變數，三個環境（Production / Preview / Development）都勾選。

## Auth Seed

首次部署後執行一次：

```bash
pnpm migrate:seed-auth
```

腳本會為 `scripts/migrate-seed-auth.ts` 中定義的種子農友建立 Supabase Auth 帳號，並將 `farmers.auth_user_id` 填入。已建立的帳號會自動跳過（冪等）。

若重置 DB（`pnpm db:seed`），需重新執行：

```bash
pnpm db:seed          # 清空並重建 farmers / products 等資料
pnpm migrate:seed-auth  # 補回 auth_user_id 對應關係
```

開啟 [http://localhost:3000](http://localhost:3000)

## 行動裝置加入主畫面

### iOS Safari

1. 用 Safari 開啟 FarmFlow 網址
2. 點選底部的**分享**按鈕（方形內有向上箭頭）
3. 向下滑動選單，點選「**加入主畫面**」
4. 確認名稱為「FarmFlow」後點選「新增」

### Android Chrome

1. 用 Chrome 開啟 FarmFlow 網址
2. Chrome 會自動跳出「**安裝應用程式**」橫幅，點選即可安裝
3. 若未自動跳出：點選右上角三點選單 → 「**新增至主畫面**」→ 「安裝」

安裝後可從主畫面直接開啟，以全螢幕 App 模式執行。

---

## 對帳功能使用說明

### 下載銀行 CSV

**中華郵政（目前支援）**

1. 登入郵局網路銀行 → 帳戶查詢 → 交易明細
2. 選擇查詢區間，點選「匯出 CSV」
3. 下載的 `.csv` 檔案即可直接上傳（支援 UTF-8 BOM 及 Big5 編碼）

### 操作流程

1. **上傳**：進入「對帳」頁面 → 選擇銀行 → 選擇 CSV 檔 → 點「上傳並配對」
2. **檢查**：系統自動比對銀行交易與未付款訂單，結果分三類：
   - **已配對**：金額與帳號末五碼都符合，信心度高
   - **待處理**：金額不符或有多個候選訂單，需人工確認
   - **未配對**：找不到對應訂單
3. **手動調整**：
   - 待處理：展開後從候選清單選擇正確訂單，或點「都不是」移至未配對
   - 未配對：點「手動指定訂單」搜尋並指定訂單
   - 已配對：點「取消配對」可撤銷自動配對
4. **確認**：點「確認對帳」→ 系統將所有配對訂單標為已付款，並記錄付款事件

### 異常處理

**找不到對應訂單（未配對）**
- 確認訂單已建立且狀態為「已確認」、「備貨中」或「已出貨」
- 確認付款狀態為「未付款」（已付款訂單不納入配對）
- 可使用手動指定訂單功能，搜尋收件人姓名或電話

**金額不符（待處理）**
- 系統允許 ±10 元誤差（手續費、零頭）
- 若差異較大，確認收款金額後手動選擇對應訂單，或點「都不是」不計入本次對帳

**重複上傳 / 重跑**
- 已上傳的批次可點「重新跑匹配」重新自動配對（會清除手動調整）
- 已確認的批次無法重跑或再次確認

---

## P1 已完成功能

P1 階段把 MVP 從「貼上接單」推到「LINE 全流程接單 + 自動通知 + 銀行對帳」。已上線功能：

- **LINE Messaging API webhook 接入**（`/api/line-webhook/[farmerId]`）：客戶在 LINE OA 私訊訊息 → 自動進 `/orders` 草稿
- **客戶自動綁定**：LINE userId 第一次出現時自動建檔；既有客戶以 `default_name` / `notes` 模糊匹配（見 `linkLineUserToCustomer`）
- **客戶合併工具**：`/customers/[id]/merge` 把多筆 customer 合併、訂單轉移、累計值重算
- **LINE 圖片訊息多圖整合**：30 秒內收到的多張圖合併解析為一筆訂單，state 存於 `pending_image_groups`（partial unique index 保證單一 farmer-user pair 一次只有一個 pending group）
- **自動 LINE 推播**：訂單 confirmed / paid / shipped 自動發 LINE，與設定 tab 的模板掛勾
- **推播重試與異常清單**：`/exceptions` 統一列出對帳異常 / 推播失敗 / 低信心訂單
- **銀行 CSV 對帳**：`/reconciliation` 上傳 → 自動匹配（金額 + 帳號末 5 碼）→ 確認 → 自動標已付款 + 推播
- **監控頁**：`/admin/health?token=<ADMIN_SECRET>` 顯示過去 24h webhook / 推播數、過去 7d 對帳成功率、各農友未處理 exceptions 數

完整 P1 文件：

- [P1 驗收清單](./docs/p1-acceptance-checklist.md)
- [P1 已知問題（非阻塞）](./docs/p1-known-issues.md)
- [給農友的 P1 升級說明](./docs/p1-farmer-changelog.md)
- [LINE Channel 設定教學](./docs/p1-line-setup.md)
- [LINE Webhook 設定教學](./docs/p1-line-webhook-setup.md)

## P1 使用指南

### 啟動 LINE 接單 / 推播
1. LINE Developers Console 建立 Messaging API channel，取得 `Channel Secret` + `Channel Access Token`
2. 在 FarmFlow `設定 → LINE 整合` tab 填入兩個值
3. Webhook URL 填入 `https://<domain>/api/line-webhook/<farmer_id>`，並「Verify」測試成功
4. 之後客戶在你的 LINE OA 私訊 → 自動進 `/orders` 草稿

### 上傳銀行 CSV 對帳
1. 從郵局網銀 / 國泰網銀下載交易明細 CSV
2. `/reconciliation` → 上傳並配對 → 檢查綠 / 黃 / 紅三類 → 手動處理黃紅 → 確認對帳
3. 配對成功的訂單自動標已付款並推 LINE 給客戶

### 監控
- 開 `https://<domain>/admin/health?token=<ADMIN_SECRET>` 即可看跨農友健康度
- `Exceptions` 頁右上角徽章顯示「我有事情要處理」的總筆數

### 手動清掃滯留 image group（罕見情況）
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<domain>/api/cron/flush-pending-image-groups
```
詳見 [P1 Known Issues KI-1](./docs/p1-known-issues.md)。

## 開發注意事項

P0.5 已導入 Supabase Auth；目前以登入 session 取代 P0 階段的 cookie 模擬。RLS 預期透過 `current_farmer_id()` 函式自動隔離（service-role 走 backend script 與 webhook 入口）。
