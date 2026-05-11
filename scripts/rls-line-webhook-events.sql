-- RLS policies for line_webhook_events
-- INSERT: service_role only (webhook is sessionless, uses Drizzle / postgres user)
-- SELECT/UPDATE/DELETE: authenticated farmers can only access their own rows

ALTER TABLE line_webhook_events ENABLE ROW LEVEL SECURITY;

-- Authenticated farmers: read-only access to their own events
CREATE POLICY "farmer_owns_line_webhook_events"
  ON line_webhook_events
  FOR SELECT TO authenticated
  USING (farmer_id = current_farmer_id());

-- service_role retains full access (Drizzle direct connection bypasses RLS,
-- but this policy keeps explicit intent clear for Supabase client usage)
CREATE POLICY "service_role_all_line_webhook_events"
  ON line_webhook_events
  FOR ALL TO service_role
  USING (true);
