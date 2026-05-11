-- RLS Rollback — 回到 P0 狀態（rls-policies.sql 的原始設定）
-- 適用情境：rls-policies-v2.sql 執行後出現問題，需要緊急回退
-- 執行條件：用 service_role 連線在 Supabase SQL Editor 執行
-- 注意：執行後 authenticated 用戶的存取會由應用程式碼中的 farmer_id 過濾負責，
--       而非 RLS。請同時將 App 回退到 P0 程式碼版本。

-- =============================================================
-- 1. 移除 v2 新增的 authenticated policies
-- =============================================================
DROP POLICY IF EXISTS "farmer_self" ON farmers;
DROP POLICY IF EXISTS "farmer_owns_products" ON products;
DROP POLICY IF EXISTS "farmer_owns_customers" ON customers;
DROP POLICY IF EXISTS "farmer_owns_orders" ON orders;
DROP POLICY IF EXISTS "farmer_owns_templates" ON notification_templates;
DROP POLICY IF EXISTS "via_order_items" ON order_items;
DROP POLICY IF EXISTS "via_order_events" ON order_events;

-- 移除 v2 版的 service_role_all（帶 WITH CHECK，與 v1 略有不同）
DROP POLICY IF EXISTS "service_role_all" ON farmers;
DROP POLICY IF EXISTS "service_role_all" ON products;
DROP POLICY IF EXISTS "service_role_all" ON customers;
DROP POLICY IF EXISTS "service_role_all" ON orders;
DROP POLICY IF EXISTS "service_role_all" ON order_items;
DROP POLICY IF EXISTS "service_role_all" ON order_events;
DROP POLICY IF EXISTS "service_role_all" ON notification_templates;

-- =============================================================
-- 2. 移除輔助函式
-- =============================================================
DROP FUNCTION IF EXISTS current_farmer_id();

-- =============================================================
-- 3. 還原 P0 的 service_role_all（僅 USING，無 WITH CHECK）
-- =============================================================
CREATE POLICY "service_role_all" ON farmers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON products FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON customers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON orders FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON order_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON order_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON notification_templates FOR ALL TO service_role USING (true);

-- =============================================================
-- 驗收查詢
-- =============================================================
-- 確認 policies 已還原（應只剩各表的 service_role_all）：
--   SELECT tablename, policyname, roles
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- 確認 current_farmer_id() 已移除：
--   SELECT proname FROM pg_proc WHERE proname = 'current_farmer_id';
--   -- 應回傳 0 rows
