-- 阶段3 E2E 稳态夹具恢复:1001已入住(305)、1015/1021/1055已确认、1035/1041已退房、1061已入住
-- 与 m4-e2e-test.php 的断言一致(可重复运行)
UPDATE order_main SET booking_status=3, order_status=2, assigned_room_no='305',
  checked_in_at=COALESCE(checked_in_at, NOW()), checked_out_at=NULL WHERE id=1001;
UPDATE order_main SET booking_status=2, order_status=1, payment_status=2,
  checked_in_at=NULL, checked_out_at=NULL, assigned_room_no='' WHERE id IN (1015,1055);
UPDATE order_main SET booking_status=2, order_status=1, checked_in_at=NULL, assigned_room_no='' WHERE id=1021;
UPDATE order_main SET booking_status=4, order_status=3, checked_out_at=COALESCE(checked_out_at, NOW()) WHERE id IN (1035,1041);
UPDATE order_main SET booking_status=3, order_status=2, checked_out_at=NULL WHERE id=1061;
SELECT id, booking_status, order_status, payment_status, assigned_room_no FROM order_main WHERE merchant_id=1001 ORDER BY id;
