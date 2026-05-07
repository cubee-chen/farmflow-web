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

## 開發注意事項

右上角的**農友切換器**是 dev tool，用於在四位種子農友之間切換操作視角。  
MVP 階段以 cookie (`current_farmer_id`) 模擬登入態，P4 會替換為正式登入。
