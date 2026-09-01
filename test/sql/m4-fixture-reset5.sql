USE mtrip_business;
-- 回补阶段5 E2E夹具:1021 恢复为已确认(供入住用例),1061 恢复为已入住(供退房用例)
UPDATE order_main SET booking_status = 2, order_status = 1, checked_in_at = NULL, assigned_room_no = '' WHERE id = 1021;
UPDATE order_main SET booking_status = 3, order_status = 2, checked_out_at = NULL WHERE id = 1061;
-- 清理此前各轮E2E累积的入住/退房测试通知(保留其他业务通知)
DELETE FROM merchant_notify WHERE merchant_id = 1001 AND category = 'booking' AND (title = '住客已入住' OR title = '住客已退房');
SELECT id, booking_status, order_status FROM order_main WHERE merchant_id = 1001 AND deleted_at IS NULL ORDER BY id;
