# P1-L1｜LINE Webhook 設定教學

## 一、前置條件

- 已完成 `docs/p1-line-setup.md`（取得 Channel Secret、Channel Access Token）
- 已在 FarmFlow 設定頁填入上述兩個值（寫入資料庫）
- 已執行 `pnpm db:migrate` 建立 `line_webhook_events` 表
- Production domain 可對外訪問（Zeabur 部署後確認）

---

## 二、Webhook URL 格式

```
https://{your-domain}/api/line-webhook/{farmer_id}
```

- `farmer_id` 是你在 `farmers` 資料表中的 UUID
- 取得方式：登入 FarmFlow 後，從 Supabase Table Editor 或 Drizzle Studio 查看

範例：
```
https://farmflow.example.com/api/line-webhook/550e8400-e29b-41d4-a716-446655440000
```

---

## 三、LINE Developer Console 設定步驟

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)，進入你的 Messaging API channel。
2. 點選 **「Messaging API」** 頁籤。
3. 找到 **Webhook settings** 區塊：
   - **Webhook URL**：填入上方格式的 URL
   - 點「Update」儲存
4. 開啟 **Use webhook**（切換到 On）
5. 關閉 **Auto-reply messages**（否則每次客戶傳訊息都會有預設自動回覆）
6. 關閉 **Greeting messages**（可選）
7. 點「Verify」按鈕測試——Console 顯示「Success」即表示 webhook 設定成功

> 「Verify」按鈕會送出一個空的 `events: []` payload，FarmFlow 會回 200 OK。

---

## 四、本地開發測試（ngrok / Cloudflare Tunnel）

需要把本地 dev server 暴露到外網才能讓 LINE 打到你的 webhook。

### 方法 A：Cloudflare Tunnel（推薦，免費）

```bash
# 安裝（一次性）
brew install cloudflared   # macOS
# 或 winget install Cloudflare.cloudflared  # Windows

# 啟動（每次開發時）
cloudflared tunnel --url http://localhost:3000
```

複製輸出的 `https://xxxx.trycloudflare.com`，填入 LINE Developer Console。

### 方法 B：ngrok

```bash
ngrok http 3000
```

複製 `https://xxxx.ngrok-free.app`，填入 LINE Developer Console。

> ⚠️ 免費版 ngrok 每次重啟 URL 會變，需重新更新 LINE 設定。

---

## 五、Mock Signature 本地測試（不需要外網）

在農友已設定 `line_channel_secret` 後，可用腳本直接測試：

```bash
# 依農友名字自動查詢 DB（需 dev server 在 localhost:3000）
FARMER_NAME=官庭安 tsx scripts/test-webhook.ts

# 或直接指定
FARMER_ID=<uuid> CHANNEL_SECRET=<secret> tsx scripts/test-webhook.ts

# 指定非預設端口
WEBHOOK_BASE_URL=http://localhost:3001 FARMER_NAME=官庭安 tsx scripts/test-webhook.ts
```

腳本會：
1. 用正確簽章送一筆 mock `message` 事件 → 驗證 `line_webhook_events` 有新增一筆
2. 用錯誤簽章再送一次 → 驗證沒有新增（簽章驗證有效）

---

## 六、驗收清單

- [ ] LINE Developer Console 的「Verify」按鈕回傳 Success
- [ ] `FARMER_NAME=xxx tsx scripts/test-webhook.ts` 全部 PASS
- [ ] 簽章不符 → 200 但不 INSERT（測試腳本已覆蓋）
- [ ] 不存在的 farmerId → 200 但不 INSERT（curl 手動測）
- [ ] Supabase Table Editor 查 `line_webhook_events` 看到事件記錄

---

## 七、RLS 設定（Production 部署時）

Drizzle migration 只建立表結構。RLS policy 需另外執行：

```bash
# 在 Supabase SQL Editor 貼上並執行：
# scripts/rls-line-webhook-events.sql
```

確認 `current_farmer_id()` 函式已存在（由 P0.5 Auth migration 建立）。

---

## 常見問題

| 問題 | 原因 / 解法 |
|------|------------|
| Verify 失敗：Webhook URL is invalid | URL 路徑錯誤，確認格式正確、domain 可對外訪問 |
| Verify 成功但訊息不進 DB | 確認 `line_channel_secret` 已在 FarmFlow 設定頁填入並儲存 |
| 本地測試腳本：Farmer has no channel_secret | 在設定頁填入 Channel Secret 並存檔 |
| 事件進 DB 但 `processing_status` 一直是 `received` | 正常，P1-L2 才會加入實際處理邏輯 |
