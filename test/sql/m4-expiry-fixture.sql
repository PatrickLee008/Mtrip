USE mtrip_business;
-- 阶段2验收:插入一条已过期未支付的测试预订,验证每分钟定时任务自动取消+释放库存+时间线
INSERT INTO order_main (order_no, site_id, user_id, order_type, merchant_id, supplier_id, goods_id, goods_name, goods_image, sku_id, sku_name, quantity, unit_price, original_price, total_amount, pay_amount, order_status, refund_status, booking_status, payment_status, booking_channel, payment_expires_at, use_date, end_date, contact_name, contact_phone)
VALUES ('M4EXPTEST001', 1, 999901, 1, 1, 0, 999901, 'M4过期测试酒店', '', 999901, '测试房型', 1, 100.00, 100.00, 100.00, 100.00, 0, 0, 1, 1, 'mtrip', DATE_SUB(NOW(), INTERVAL 1 MINUTE), DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), '测试住客', '');
SELECT id, order_no, booking_status, payment_status, payment_expires_at FROM order_main WHERE order_no='M4EXPTEST001';
