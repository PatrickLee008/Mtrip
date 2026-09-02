USE mtrip_business;
SELECT id, category, title, LEFT(message, 120) AS msg, created_at
FROM merchant_notify
WHERE created_at >= '2026-09-01 07:00:00'
ORDER BY id DESC LIMIT 5;
