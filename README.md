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

## 開發注意事項

右上角的**農友切換器**是 dev tool，用於在四位種子農友之間切換操作視角。  
MVP 階段以 cookie (`current_farmer_id`) 模擬登入態，P4 會替換為正式登入。
