USE mtrip_business;
SELECT order_id, event_type, operator_type, operator_name, status, LEFT(detail, 80) AS detail, created_at
FROM order_booking_event WHERE order_id IN (1001, 1041) ORDER BY id;
SELECT COUNT(*) AS notes FROM order_internal_note WHERE order_id = 1001;
