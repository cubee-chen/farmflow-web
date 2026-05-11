# LINE Messaging API 設定教學

本文說明如何申請 LINE Messaging API channel、取得 Channel Secret 與 Channel Access Token，以及找到自己的 LINE userId 以供測試推播。

---

## 一、建立 LINE Messaging API Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)，用你的 LINE 帳號登入。
2. 如果沒有 Provider，點「Create a new provider」建立（名稱填農場名稱即可）。
3. 在 Provider 頁面點「Create a new channel」，選擇 **Messaging API**。
4. 填寫基本資料：
   - **Channel name**：農場名稱（例如「春霞番茄農場」）
   - **Channel description**：農友出貨通知
   - **Category / Subcategory**：依實際選擇
5. 同意條款後點「Create」。

---

## 二、取得 Channel Secret

1. 進入剛建立的 channel，點選上方的 **「Basic settings」** 頁籤。
2. 找到 **Channel secret** 區塊，點「Issue」生成（若已有則直接複製）。
3. 複製這 32 位英數字的字串，貼到 FarmFlow 設定頁 > LINE 通知 > **Channel Secret** 欄位。

---

## 三、取得 Channel Access Token（長效版）

1. 在同一個 channel，點選 **「Messaging API」** 頁籤。
2. 往下找到 **Channel access token** 區塊。
3. 點「Issue」生成長效 token（Long-lived token，有效期 30 年）。
4. 複製這 ~186 個字元的字串，貼到 FarmFlow 設定頁 > LINE 通知 > **Channel Access Token** 欄位。

> ⚠️ Token 只顯示一次。複製後請妥善保存。若遺失可重新 Issue，舊 token 即失效。

---

## 四、找到自己的 LINE userId（測試推播用）

LINE 推播目標是「userId」，不是 LINE ID（@帳號）。以下是兩種取得方式：

### 方法 A：透過 LINE Official Account Manager

1. 開啟 [LINE Official Account Manager](https://manager.line.biz/)，進入你的 OA。
2. 點「聊天」> 對話列表，找到測試用對話。
3. 點對話右上角的「i」圖示，可看到對方的 userId（`U` 開頭 + 32 位英數字）。

### 方法 B：傳送訊息給你的 Bot 後從 Webhook 取得

1. 用你的 LINE 帳號加入自己建立的 Bot（掃 QR Code 或搜尋 Basic ID）。
2. 傳送任意訊息給 Bot。
3. 若你已設定 Webhook，可在 Webhook 事件的 `source.userId` 取得。

---

## 五、驗證設定

1. 在 FarmFlow **設定 > LINE 通知** 填入 Channel Secret 和 Channel Access Token 並儲存。
2. 在「測試推播」區塊貼上你的 userId（`Uxxxxxxx...`）。
3. 點「測試推播」——若 LINE 收到「FarmFlow 測試訊息 ✅」即表示設定成功。

---

## 常見問題

| 問題 | 原因 / 解法 |
|------|------------|
| 推播失敗：401 Unauthorized | Channel Access Token 錯誤或已過期，重新 Issue 一個新的 |
| 推播失敗：400 Invalid reply token | 確認 `to` 是 userId，不是 LINE ID（@帳號）或 groupId |
| 推播失敗：403 Forbidden | 帳號類型不支援 push（需 Messaging API channel，不能是 LINE Login） |
| 收不到訊息 | 確認已加 Bot 為好友；官方帳號如未加好友無法收推播 |
