-- Backfill paid notification template for existing farmers.
-- Run this once in Supabase SQL Editor after deploying P1-S5.
-- Safe to re-run: skips farmers that already have a paid template.

INSERT INTO notification_templates (farmer_id, trigger_event, template_text, is_active)
SELECT
  id,
  'paid',
  '已收到您的款項 {total_amount}（訂單 {order_number}），訂單即將備貨出貨～感謝您的支持！',
  true
FROM farmers f
WHERE NOT EXISTS (
  SELECT 1
  FROM notification_templates t
  WHERE t.farmer_id = f.id AND t.trigger_event = 'paid'
);

-- Verify: every farmer should now have 3 templates (confirmed/paid/shipped)
-- SELECT farmer_id, count(*) FROM notification_templates GROUP BY farmer_id;
