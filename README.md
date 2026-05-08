# FarmFlow

團購管理平台 MVP

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
