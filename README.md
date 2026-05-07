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
