USE mtrip_business;
SELECT id, order_no, booking_status, payment_status, booking_channel, order_status, use_date, end_date
FROM order_main WHERE merchant_id = 1001 AND deleted_at IS NULL ORDER BY id;
