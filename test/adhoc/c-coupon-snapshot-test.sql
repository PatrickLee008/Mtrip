-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;
-- ============================================================
-- 订单券规则快照(order_main.coupon_snapshot)联调用测试券(一次性 fixture,勿用于生产)
--
-- 三张券各覆盖结算分账的一条出资方分支,只发给 site 7 的用户 28:
--   A 满减 · 仅酒店 · 商户出资(2)     满 50,000 减 10,000   → Trip 带券 + merchant_pays
--   B 折扣 · 全场 · 共担(4) 60/30/10  9 折,最高减 20,000     → funding_rules 三方拆分
--   C 指定房型 · 合作方出资(3)         物业 3 房型 4 减 5,000 → 快照 roomTypeIds + partner_pays
--
-- 幂等:先按 `[Snap Test]` 记号删掉上次插入的券/领券记录,再重新插入(可重复执行)。
-- 导入:
--   docker exec -i mtrip-mysql-1 mysql -uroot -p<root 密码> --default-character-set=utf8mb4 < test/adhoc/c-coupon-snapshot-test.sql
-- ============================================================
USE `mtrip_business`;

SET @site_id     = 7;
SET @user_id     = 28;
SET @property_id = 3;
SET @room_type   = 4;

DELETE FROM `marketing_coupon_receive`
 WHERE `coupon_id` IN (SELECT `id` FROM `marketing_coupon` WHERE `coupon_name` LIKE '[Snap Test]%');
DELETE FROM `marketing_coupon` WHERE `coupon_name` LIKE '[Snap Test]%';

INSERT INTO `marketing_coupon`
  (`site_id`, `merchant_id`, `coupon_name`, `coupon_type`, `discount_value`, `min_amount`, `max_discount`,
   `funding_source`, `funding_rules`, `goods_scope`, `property_ids`, `room_type_ids`, `total_count`, `per_user_limit`,
   `valid_type`, `valid_start`, `valid_end`, `stackable`, `status`, `remark`)
VALUES
  (@site_id, 0, '[Snap Test] A Merchant 10,000 Off', 1, 10000.00, 50000.00, 0.00,
   2, NULL, 1, NULL, NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, 1, 'Snapshot test: merchant-funded.'),
  (@site_id, 0, '[Snap Test] B Shared 10% Off', 2, 9.00, 0.00, 20000.00,
   4, JSON_OBJECT('mtrip', 60, 'merchant', 30, 'partner', 10), 0, NULL, NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, 1, 'Snapshot test: shared 60/30/10.'),
  (@site_id, 0, '[Snap Test] C Partner Room 4 5,000 Off', 1, 5000.00, 0.00, 0.00,
   3, NULL, 3, JSON_ARRAY(@property_id), JSON_ARRAY(@room_type), 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0, 1, 'Snapshot test: partner-funded, room type 4 only.');

INSERT INTO `marketing_coupon_receive`
  (`site_id`, `coupon_id`, `user_id`, `coupon_code`, `status`, `valid_start`, `valid_end`)
SELECT c.`site_id`, c.`id`, @user_id, CONCAT('SNAP-', c.`id`, '-', @user_id), 0, c.`valid_start`, c.`valid_end`
  FROM `marketing_coupon` c
 WHERE c.`coupon_name` LIKE '[Snap Test]%';

UPDATE `marketing_coupon` c
   SET c.`received_count` = (SELECT COUNT(*) FROM `marketing_coupon_receive` r WHERE r.`coupon_id` = c.`id` AND r.`deleted_at` IS NULL)
 WHERE c.`coupon_name` LIKE '[Snap Test]%';

SELECT r.`id` AS `receive_id`, c.`id` AS `coupon_id`, c.`coupon_name`, c.`funding_source`, c.`funding_rules`
  FROM `marketing_coupon_receive` r
  JOIN `marketing_coupon` c ON c.`id` = r.`coupon_id`
 WHERE c.`coupon_name` LIKE '[Snap Test]%'
 ORDER BY c.`id`;
