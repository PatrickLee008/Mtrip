USE mtrip_business;
-- NO 前缀订单现状与时间线来源
SELECT id, order_no, order_status, booking_status, payment_status, payment_expires_at, cancel_reason, created_at
FROM order_main WHERE order_no LIKE 'NO2026%' ORDER BY id;

SELECT e.order_id, e.event_type, e.operator_type, e.created_at
FROM order_booking_event e
JOIN order_main o ON o.id = e.order_id
WHERE o.order_no LIKE 'NO2026%'
ORDER BY e.id DESC LIMIT 20;
