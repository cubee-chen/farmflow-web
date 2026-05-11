-- RLS for notification_logs (P1-N1)
-- Run after deploying migration 0004_p1_n1_line_push.sql

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmer_owns_notification_logs" ON notification_logs
  FOR ALL TO authenticated
  USING (farmer_id = current_farmer_id());

CREATE POLICY "service_role_all_notification_logs" ON notification_logs
  FOR ALL TO service_role
  USING (true);
