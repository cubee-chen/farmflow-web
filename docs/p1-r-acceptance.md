# P1-R 對帳功能驗收清單

## 端到端測試流程

使用 `scripts/billing-samples/mock_post_office.csv` 作為測試資料（10 筆，含 4 種匹配狀態）。

### 上傳與配對

- [ ] 選擇「中華郵政」，上傳 `mock_post_office.csv`，出現新批次並自動導向詳情頁
- [ ] 詳情頁統計格子正確顯示：共 N 筆、已配對、待處理、未配對數量
- [ ] 已配對 tab：每筆顯示日期、金額、訂單號、收件人、信心度顏色
- [ ] 待處理 tab：有紅色數字 badge，展開後顯示候選訂單列表（金額不符 / 多個候選）
- [ ] 未配對 tab：顯示「手動指定訂單」按鈕

### 手動配對操作

- [ ] 待處理 tab：選擇候選訂單後點「手動配對」→ 該筆移到已配對 tab
- [ ] 待處理 tab：點「都不是」→ 該筆移到未配對 tab
- [ ] 已配對 tab：點「取消配對」→ 該筆移到未配對 tab
- [ ] 未配對 tab：點「手動指定訂單」→ 搜尋並選取訂單 → 移到已配對 tab

### 重新跑匹配

- [ ] 點「重新跑匹配」→ 出現警告 dialog
- [ ] 確認後所有手動調整清除，重新自動配對
- [ ] 已 confirmed 的 batch：「重新跑匹配」按鈕為 disabled

### 確認對帳

- [ ] 點「確認對帳」→ 出現確認 dialog（顯示將更新 N 筆訂單）
- [ ] 確認後 `orders.payment_status = 'paid'`，`paid_at` 有值
- [ ] 確認後 `order_events` 多一筆 `event_type = 'paid'`，`created_by = 'system'`，`payload.batch_id` 正確
- [ ] 訂單詳情頁 timeline 可看到「paid」事件
- [ ] batch `status = 'confirmed'`，詳情頁按鈕顯示「已確認」（disabled）
- [ ] console.log 可看到 `[notify] queued:` 對每筆 paid 訂單

### 確認摘要頁

- [ ] 導向 `/reconciliation/[batchId]/confirmed`
- [ ] 顯示「已確認 N 筆訂單為已付款」banner
- [ ] 列表包含每筆：收件人、訂單號、日期、金額
- [ ] 每行「複製收款通知」按鈕可複製文案，點後顯示「已複製」
- [ ] 「訂單」連結可跳轉訂單詳情
- [ ] 「回對帳列表」按鈕正常

### 對帳列表頁

- [ ] 有 status='draft' 且 7 天內的批次 → 頂部顯示黃色 banner「您有 N 個未確認的對帳批次」
- [ ] banner「前往處理」連結指向最新的 draft batch
- [ ] 所有批次確認後 → banner 消失

### 安全性

- [ ] 以農友 A 登入，嘗試訪問農友 B 的 batch URL → 回傳 404
- [ ] 嘗試對農友 B 的 batch 呼叫 confirm API → 回傳 404
- [ ] 已 confirmed 的 batch 再次呼叫 confirm API → 回傳 409

### 取消配對後確認

- [ ] 在確認前取消某筆 match（unlink）→ 確認對帳 → 該筆訂單的 payment_status 不變
