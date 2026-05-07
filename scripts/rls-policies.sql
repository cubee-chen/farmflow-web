-- RLS Policies for FarmFlow
-- MVP Phase: service_role full access; anon/authenticated have no access.
-- All API calls use supabaseAdmin (service_role) and enforce farmer_id in code.
-- P1 (Supabase Auth): replace USING (true) with USING (farmer_id = auth.jwt() ->> 'farmer_id')

-- Enable RLS on all tables
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- service_role full access policies
CREATE POLICY "service_role_all" ON farmers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON products FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON customers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON orders FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON order_items FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON order_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON notification_templates FOR ALL TO service_role USING (true);
