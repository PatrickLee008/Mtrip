USE mtrip_business;
-- 清理阶段2过期验证 fixture
DELETE FROM order_booking_event WHERE order_id = (SELECT id FROM (SELECT id FROM order_main WHERE order_no = 'M4EXPTEST001') t);
DELETE FROM merchant_notify WHERE deep_link_value LIKE '%notificationTarget=1074';
DELETE FROM order_internal_note WHERE order_id = 1074;
DELETE FROM order_main WHERE order_no = 'M4EXPTEST001';
-- 检查 fixture 是否残留库存记录
SELECT COUNT(*) AS stock_left FROM goods_daily_stock WHERE goods_id = 999901;
SELECT COUNT(*) AS stock_log_left FROM goods_stock_log WHERE goods_id = 999901;
SELECT COUNT(*) AS order_left FROM order_main WHERE order_no = 'M4EXPTEST001';
