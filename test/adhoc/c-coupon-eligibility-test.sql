-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;
-- ============================================================
-- 优惠券资格条件(PRD §17.5 / §17.6)联调用测试券(一次性 fixture,勿用于生产)
--
-- 每张券只开一个条件,便于对照 trip/quote 与 /marketing/coupon/match-list 的判定:
--   D 最少 3 间              满减 7,000
--   E 仅房型 4 + 最少 2 间    满减 6,000(「指定房型 + 最少间数」组合,间数按合格行算)
--   F 提前 60 天预订          满减 5,000
--   G 长住 ≥ 3 晚             满减 4,000
--   H 入住日期段 = 今天+40 ~ 今天+45 满减 3,000
--   I 仅房型 3 · 9 折         只分给房型 3 的行(§17.6)
-- 只发 site 7 用户 28;幂等:先按 `[Elig Test]` 记号删掉上次插入的券/领券记录。
-- 导入:
--   docker exec -i mtrip-mysql-1 mysql -uroot -p<root 密码> --default-character-set=utf8mb4 < test/adhoc/c-coupon-eligibility-test.sql
-- ============================================================
USE `mtrip_business`;

SET @site_id = 7;
SET @user_id = 28;

DELETE FROM `marketing_coupon_receive`
 WHERE `coupon_id` IN (SELECT `id` FROM `marketing_coupon` WHERE `coupon_name` LIKE '[Elig Test]%');
DELETE FROM `marketing_coupon` WHERE `coupon_name` LIKE '[Elig Test]%';

INSERT INTO `marketing_coupon`
  (`site_id`, `merchant_id`, `coupon_name`, `coupon_type`, `discount_value`, `min_amount`, `max_discount`,
   `funding_source`, `goods_scope`, `property_ids`, `room_type_ids`, `total_count`, `per_user_limit`,
   `min_nights`, `max_nights`, `book_advance_days`, `min_room_count`, `min_hotel_count`, `stay_start`, `stay_end`,
   `valid_type`, `valid_start`, `valid_end`, `stackable`, `status`, `remark`)
VALUES
  (@site_id, 0, '[Elig Test] D Min 3 Rooms', 1, 7000, 0, 0, 1, 1, NULL, NULL, 0, 1,
   0, 0, 0, 3, 0, NULL, NULL, 1, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, 1, 'Eligibility test'),
  (@site_id, 0, '[Elig Test] E Room 4 + Min 2 Rooms', 1, 6000, 0, 0, 1, 1, NULL, JSON_ARRAY(4), 0, 1,
   0, 0, 0, 2, 0, NULL, NULL, 1, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, 1, 'Eligibility test'),
  (@site_id, 0, '[Elig Test] F Early Bird 60 Days', 1, 5000, 0, 0, 1, 1, NULL, NULL, 0, 1,
   0, 0, 60, 0, 0, NULL, NULL, 1, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, 1, 'Eligibility test'),
  (@site_id, 0, '[Elig Test] G Long Stay 3 Nights', 1, 4000, 0, 0, 1, 1, NULL, NULL, 0, 1,
   3, 0, 0, 0, 0, NULL, NULL, 1, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, 1, 'Eligibility test'),
  (@site_id, 0, '[Elig Test] H Stay Window', 1, 3000, 0, 0, 1, 1, NULL, NULL, 0, 1,
   0, 0, 0, 0, 0, DATE_ADD(CURDATE(), INTERVAL 40 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY),
   1, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, 1, 'Eligibility test'),
  (@site_id, 0, '[Elig Test] I Room 3 Only 10% Off', 2, 9.00, 0, 0, 1, 1, NULL, JSON_ARRAY(3), 0, 1,
   0, 0, 0, 0, 0, NULL, NULL, 1, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 0, 1, 'Eligibility test');

INSERT INTO `marketing_coupon_receive`
  (`site_id`, `coupon_id`, `user_id`, `coupon_code`, `status`, `valid_start`, `valid_end`)
SELECT c.`site_id`, c.`id`, @user_id, CONCAT('ELIG-', c.`id`, '-', @user_id), 0, c.`valid_start`, c.`valid_end`
  FROM `marketing_coupon` c
 WHERE c.`coupon_name` LIKE '[Elig Test]%';

UPDATE `marketing_coupon` c
   SET c.`received_count` = (SELECT COUNT(*) FROM `marketing_coupon_receive` r WHERE r.`coupon_id` = c.`id` AND r.`deleted_at` IS NULL)
 WHERE c.`coupon_name` LIKE '[Elig Test]%';

SELECT r.`id` AS `receive_id`, c.`coupon_name`
  FROM `marketing_coupon_receive` r
  JOIN `marketing_coupon` c ON c.`id` = r.`coupon_id`
 WHERE c.`coupon_name` LIKE '[Elig Test]%'
 ORDER BY c.`id`;
