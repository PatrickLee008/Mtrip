-- 阶段2过期任务验证:订单1074 (M4EXPTEST001)
USE mtrip_business;
SELECT id, order_no, order_status, booking_status, payment_status, cancel_reason, cancel_time, version
FROM order_main WHERE order_no = 'M4EXPTEST001';

SELECT event_type, event_category, operator_type, detail, created_at
FROM order_booking_event WHERE order_id = 1074 ORDER BY id;

SELECT id, notify_type, title, created_at
FROM merchant_notify
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
ORDER BY id DESC LIMIT 10;
