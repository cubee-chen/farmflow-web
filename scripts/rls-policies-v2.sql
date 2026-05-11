-- RLS Policies v2 — P0.5 Auth 正規化
-- 執行條件：
--   1. farmers.auth_user_id 欄位已存在（migration 0001 已跑）
--   2. 至少一位農友的 auth_user_id 已填入（migrate-seed-auth.ts 跑完後）
--   3. 用 service_role 連線在 Supabase SQL Editor 執行
--
-- 執行後效果：
--   - authenticated 用戶只看得到自己的資料（透過 current_farmer_id()）
--   - service_role 維持全權（後台 / webhook / cron 用）
--   - anon key 無任何存取權

-- =============================================================
-- 1. 輔助函式：從 auth.uid() 取得當前 farmer.id
-- =============================================================
CREATE OR REPLACE FUNCTION current_farmer_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM farmers WHERE auth_user_id = auth.uid()
$$;

-- 給 authenticated 與 service_role 角色執行權限
GRANT EXECUTE ON FUNCTION current_farmer_id() TO authenticated, service_role;

-- =============================================================
-- 2. 移除舊 service_role_all（稍後重建附帶 WITH CHECK 的版本）
-- =============================================================
DROP POLICY IF EXISTS "service_role_all" ON farmers;
DROP POLICY IF EXISTS "service_role_all" ON products;
DROP POLICY IF EXISTS "service_role_all" ON customers;
DROP POLICY IF EXISTS "service_role_all" ON orders;
DROP POLICY IF EXISTS "service_role_all" ON order_items;
DROP POLICY IF EXISTS "service_role_all" ON order_events;
DROP POLICY IF EXISTS "service_role_all" ON notification_templates;

-- =============================================================
-- 3. 新 policies：authenticated 用 current_farmer_id() 過濾
--    先 DROP IF EXISTS 確保冪等（可重複執行）
-- =============================================================
DROP POLICY IF EXISTS "farmer_self" ON farmers;
DROP POLICY IF EXISTS "farmer_owns_products" ON products;
DROP POLICY IF EXISTS "farmer_owns_customers" ON customers;
DROP POLICY IF EXISTS "farmer_owns_orders" ON orders;
DROP POLICY IF EXISTS "farmer_owns_templates" ON notification_templates;
DROP POLICY IF EXISTS "via_order_items" ON order_items;
DROP POLICY IF EXISTS "via_order_events" ON order_events;

-- farmers：只能讀/寫自己那一筆
CREATE POLICY "farmer_self" ON farmers
  FOR ALL TO authenticated
  USING (id = current_farmer_id())
  WITH CHECK (id = current_farmer_id());

-- products
CREATE POLICY "farmer_owns_products" ON products
  FOR ALL TO authenticated
  USING (farmer_id = current_farmer_id())
  WITH CHECK (farmer_id = current_farmer_id());

-- customers
CREATE POLICY "farmer_owns_customers" ON customers
  FOR ALL TO authenticated
  USING (farmer_id = current_farmer_id())
  WITH CHECK (farmer_id = current_farmer_id());

-- orders
CREATE POLICY "farmer_owns_orders" ON orders
  FOR ALL TO authenticated
  USING (farmer_id = current_farmer_id())
  WITH CHECK (farmer_id = current_farmer_id());

-- notification_templates
CREATE POLICY "farmer_owns_templates" ON notification_templates
  FOR ALL TO authenticated
  USING (farmer_id = current_farmer_id())
  WITH CHECK (farmer_id = current_farmer_id());

-- =============================================================
-- 4. order_items / order_events — 透過 orders 反查 farmer
-- =============================================================
CREATE POLICY "via_order_items" ON order_items
  FOR ALL TO authenticated
  USING (
    order_id IN (SELECT id FROM orders WHERE farmer_id = current_farmer_id())
  )
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE farmer_id = current_farmer_id())
  );

CREATE POLICY "via_order_events" ON order_events
  FOR ALL TO authenticated
  USING (
    order_id IN (SELECT id FROM orders WHERE farmer_id = current_farmer_id())
  )
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE farmer_id = current_farmer_id())
  );

-- =============================================================
-- 5. service_role 全權（後台管理 / LINE webhook / cron 用）
-- =============================================================
CREATE POLICY "service_role_all" ON farmers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON order_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON order_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON notification_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================
-- 驗收查詢（執行完後可手動跑確認）
-- =============================================================
-- 確認 current_farmer_id() 函式存在：
--   SELECT proname FROM pg_proc WHERE proname = 'current_farmer_id';
--
-- 確認 policies 已建立：
--   SELECT tablename, policyname, roles
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- 確認 anon 無法存取（此 DB 未 GRANT SELECT TO anon，結果是 permission denied）：
--   SET ROLE anon;
--   SELECT * FROM farmers;
--   RESET ROLE;
--   → 預期：permission denied（比 0 rows 更嚴格，屬正確安全行為）
--   → 若預期看到 0 rows 而非報錯，需先 GRANT SELECT ON farmers TO anon，
--     但對本系統而言無此必要。

-- =============================================================
-- P1-R1 新增：銀行對帳三張表的 RLS
-- =============================================================

-- 移除舊 policy（確保冪等）
DROP POLICY IF EXISTS "farmer_owns_reconciliation_batches" ON bank_reconciliation_batches;
DROP POLICY IF EXISTS "via_batch_bank_transactions" ON bank_transactions;
DROP POLICY IF EXISTS "via_tx_reconciliation_matches" ON reconciliation_matches;
DROP POLICY IF EXISTS "service_role_all" ON bank_reconciliation_batches;
DROP POLICY IF EXISTS "service_role_all" ON bank_transactions;
DROP POLICY IF EXISTS "service_role_all" ON reconciliation_matches;

-- bank_reconciliation_batches：直接帶 farmer_id
CREATE POLICY "farmer_owns_reconciliation_batches" ON bank_reconciliation_batches
  FOR ALL TO authenticated
  USING (farmer_id = current_farmer_id())
  WITH CHECK (farmer_id = current_farmer_id());

-- bank_transactions：透過 batch 反查 farmer
CREATE POLICY "via_batch_bank_transactions" ON bank_transactions
  FOR ALL TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM bank_reconciliation_batches
      WHERE farmer_id = current_farmer_id()
    )
  )
  WITH CHECK (
    batch_id IN (
      SELECT id FROM bank_reconciliation_batches
      WHERE farmer_id = current_farmer_id()
    )
  );

-- reconciliation_matches：透過 bank_transaction → batch 反查 farmer
CREATE POLICY "via_tx_reconciliation_matches" ON reconciliation_matches
  FOR ALL TO authenticated
  USING (
    bank_transaction_id IN (
      SELECT bt.id FROM bank_transactions bt
      JOIN bank_reconciliation_batches brb ON bt.batch_id = brb.id
      WHERE brb.farmer_id = current_farmer_id()
    )
  )
  WITH CHECK (
    bank_transaction_id IN (
      SELECT bt.id FROM bank_transactions bt
      JOIN bank_reconciliation_batches brb ON bt.batch_id = brb.id
      WHERE brb.farmer_id = current_farmer_id()
    )
  );

-- service_role 全權
CREATE POLICY "service_role_all" ON bank_reconciliation_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON bank_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON reconciliation_matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
