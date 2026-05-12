# P1 Acceptance Checklist

> **Scope:** Verify the full P1 envelope — LINE Messaging API webhook intake, automatic LINE push notifications, bank CSV reconciliation, exceptions handling, image-message grouping, and cross-farmer isolation.
> **How to run:** Tick each item as you verify it. Items marked _(SQL)_ are run in Supabase SQL Editor against production data. Items marked _(LINE)_ require a real LINE Official Account and a test customer LINE account.
> **Prerequisites:** All P0/P0.5/P1 migrations applied; `ADMIN_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, and the seed farmer's `line_channel_secret` / `line_channel_access_token` set in Vercel.

---

## A · End-to-end happy path (intake → notify → reconcile)

The following sequence is one continuous flow with the same test order.

- [ ] **A1** Test customer sends a text order via LINE (e.g. "我要 2 箱大的，台北市信義區 X 路 1 號，0912345678 王小明")
- [ ] **A2** Within 30 seconds, `/orders` shows a new `draft` with `intake_mode='line_webhook'` and the customer is auto-linked (see customer detail → 累計訂單 +1)
- [ ] **A3** Farmer opens the draft, reviews, marks **已確認** (confirmed)
- [ ] **A4** Test customer's LINE receives the "訂單已確認" push within ~5 seconds
- [ ] **A5** `notification_logs` has a row for this order with `status='sent'`, `trigger_event='confirmed'`
- [ ] **A6** Operator uploads a bank CSV (郵局 or 國泰格式) containing a row matching this order's amount + customer's `bank_last_5`
- [ ] **A7** Reconciliation page auto-matches → status `matched`; operator confirms the batch
- [ ] **A8** Order's `payment_status` flips to `paid`, `paid_at` filled
- [ ] **A9** Customer's LINE receives "款項已收到" push; `notification_logs` row with `trigger_event='paid', status='sent'`
- [ ] **A10** Farmer marks the order **已出貨** (shipped)
- [ ] **A11** Customer's LINE receives "已出貨" push; `notification_logs` row with `trigger_event='shipped', status='sent'`
- [ ] **A12** Order timeline (in `/orders/[id]` 訂單事件 section) shows ordered chain: `created → confirmed → paid → shipped`

## B · Exceptions handling

- [ ] **B1** Upload a CSV with an amount that doesn't match any order → reconciliation batch shows `unmatched` / `amount_mismatch`; `/exceptions` 對帳異常 tab lists it
- [ ] **B2** Temporarily blank out `farmers.line_channel_access_token` for the test farmer (or set an obviously invalid value) → trigger a push (e.g. confirm an order) → `notification_logs.status='failed'` with `error_message`; `/exceptions` 推播失敗 tab shows it with retry button
- [ ] **B3** Restore the access token, click 重試 in `/exceptions` → log row becomes `sent`
- [ ] **B4** Send a deliberately ambiguous LINE message ("再來一箱，謝謝") → resulting draft has low `parse_confidence` (< 0.7) and appears in `/exceptions` 低信心訂單 tab

## C · LINE image grouping

- [ ] **C1** Test customer rapidly sends **3 images** in succession (< 10s apart). After 30s of silence, exactly **1** draft appears in `/orders` (not 3)
- [ ] **C2** Open the draft → image gallery shows all 3 thumbnails; `orders.raw_image_urls` has 3 paths
- [ ] **C3** Send 1 text message then 1 image (with > 5s gap) → result is **2 separate drafts**, not 1
- [ ] **C4** Image quality flag: send a deliberately blurry/cropped image → draft surfaces a banner reflecting `image_quality` ('blurry' / 'partial' / etc.); `image_quality` column populated
- [ ] **C5** _(SQL)_ Verify pending groups reach terminal state:
  ```sql
  SELECT status, count(*) FROM pending_image_groups
  WHERE first_received_at > now() - interval '1 hour'
  GROUP BY status;
  ```
  No row should sit `pending` for more than ~2 minutes under normal conditions

## D · Performance

- [ ] **D1** Webhook ack latency: from Vercel logs or LINE platform delivery dashboard, ack is consistently **< 1s** (LINE retries if > 2s)
- [ ] **D2** Reconciliation engine: upload a CSV with **1000+ rows** → matching completes within **30s**
- [ ] **D3** LINE push round-trip (status change → customer receives): **< 2s** average (best-effort; LINE platform variance applies)
- [ ] **D4** LLM parse: `parseOrderText` 95th percentile < 5s, `parseOrderFromImages` 95th percentile < 10s for ≤ 3 images (sample via Vercel function logs)

## E · Isolation and security

- [ ] **E1** Cross-farmer webhook: send a LINE message to Farmer A's Official Account → only A's `/orders` shows a new draft; B's `/orders` unchanged. `line_webhook_events.farmer_id` matches A only
- [ ] **E2** Reconciliation isolation: log in as A → `/reconciliation` shows no batches uploaded by B. Direct SQL check:
  ```sql
  -- run as a sanity check (service-role bypasses RLS, so verify in the app, not in SQL)
  ```
  Verify in the UI, not raw DB.
- [ ] **E3** Push isolation: confirm an order owned by A → notification log uses A's `line_channel_access_token`, customer linked to A. B's customers receive nothing for A's actions
- [ ] **E4** Storage isolation: open `intake-images/{B_farmer_id}/...` while logged in as A (e.g. via direct signed-URL endpoint) → request fails (403/404)
- [ ] **E5** Admin health page: visit `/admin/health` without `?token=` → "Forbidden". With wrong token → "Forbidden". With correct `ADMIN_SECRET` → dashboard renders with per-farmer breakdown

## F · Final acceptance (human)

- [ ] **F1** Demo end-to-end to 徐方 over screen-share — confirm he agrees the system covers his current Google Form / GAS workflow
- [ ] **F2** Demo end-to-end to 陳奕宏 — confirm he agrees this covers what his cousin's webapp does plus the LINE gap
- [ ] **F3** Both agree the next time their real customer messages them on LINE, they're willing to handle it through FarmFlow instead of their existing tool

## Definition of done

This document is considered "complete" when every box above is ticked. Any box that fails goes into [P1 Known Issues](./p1-known-issues.md) with mitigation; non-blocking items stay open into P2.
