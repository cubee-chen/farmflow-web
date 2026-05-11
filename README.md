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

## 開發注意事項

右上角的**農友切換器**是 dev tool，用於在四位種子農友之間切換操作視角。  
MVP 階段以 cookie (`current_farmer_id`) 模擬登入態，P4 會替換為正式登入。
