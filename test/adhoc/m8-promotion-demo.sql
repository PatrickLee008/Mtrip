-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- M8 促销与活动——联调用演示数据(一次性 fixture,勿用于生产)
--
-- 目的:让商户端 /promotions(四个 Tab)与 /campaigns、/promotions/analytics 在没有真实
--       商户登录账号的开发库里也能看到真实数据(数据全部落在开发库现有的商户 6 / 物业 7)。
-- 设计源:Figma `2285:21516` 的样例行(WELCOME26 / VIP5000 / SUMMER20 / LOYALTY10 / NEWYEAR)
--         + 卡片样例(Early Bird 15% Off / Stay 3 Nights, Save 10% 等)。
--
-- ⚠ 本文件**不登记**进 deploy/docker-compose.yml 的 initdb 挂载列表,也不会被 test/apply.sh 导入。
--    清空方式:见同目录 README「M8 演示数据」一节。
-- 幂等:先按 `mc_demo_*` 记号删掉上次插入的行,再重新插入(可重复执行)。
-- ============================================================
USE `mtrip_business`;

-- ---- 1. 清理上次插入的演示数据(券码统一带 DEMO 前缀便于识别) ----
DELETE FROM `marketing_promotion_impression`
 WHERE `coupon_id` IN (SELECT `id` FROM `marketing_coupon` WHERE `coupon_name` LIKE '[M8 Demo]%');
DELETE FROM `finance_account_entry`
 WHERE `coupon_id` IN (
   SELECT r.`id` FROM `marketing_coupon_receive` r
   JOIN `marketing_coupon` c ON c.`id` = r.`coupon_id`
   WHERE c.`coupon_name` LIKE '[M8 Demo]%'
 );
DELETE FROM `marketing_coupon_receive`
 WHERE `coupon_id` IN (SELECT `id` FROM `marketing_coupon` WHERE `coupon_name` LIKE '[M8 Demo]%');
DELETE FROM `marketing_promo_code`
 WHERE `coupon_id` IN (SELECT `id` FROM `marketing_coupon` WHERE `coupon_name` LIKE '[M8 Demo]%');
DELETE FROM `marketing_coupon` WHERE `coupon_name` LIKE '[M8 Demo]%';
DELETE FROM `marketing_campaign_participant`
 WHERE `campaign_id` IN (SELECT `id` FROM `marketing_campaign` WHERE `title` LIKE '[M8 Demo]%');
DELETE FROM `marketing_campaign` WHERE `title` LIKE '[M8 Demo]%';

-- ---- 2. 促销(marketing_coupon) ----
-- 折扣口径提醒:coupon_type=2 时 discount_value 是 10 分制折扣率(8.50 = 用户付 85% = 15% off),
-- 与后端 PricingService / CouponView 一致;下方注释标出「设计口径」便于核对。
INSERT INTO `marketing_coupon`
  (`site_id`, `merchant_id`, `created_by_merchant_admin`, `coupon_name`, `description`,
   `coupon_type`, `promotion_kind`, `promo_code`, `discount_value`, `min_amount`, `max_discount`,
   `funding_source`, `funding_rules`, `goods_scope`, `property_ids`, `room_type_ids`,
   `total_count`, `received_count`, `used_count`, `per_user_limit`,
   `min_nights`, `max_nights`, `book_advance_days`,
   `valid_type`, `valid_start`, `valid_end`, `valid_days`, `status`, `remark`, `staff_note`)
VALUES
  -- Percentage Tab(卡片网格)—— 稿面卡片样例
  (7, 6, 0, '[M8 Demo] Early Bird 15% Off', '15% discount for bookings made 30 days in advance.',
   2, 1, '', 8.50, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   0, 320, 96, 1, 0, 0, 30, 1, '2026-10-01 00:00:00', '2026-12-31 23:59:59', 0, 1,
   'Advance purchase required. Non-refundable.', 'Ops: keep an eye on Q4 volume.'),
  (7, 6, 0, '[M8 Demo] Stay 3 Nights, Save 10%', 'Enjoy an extra 10% off when extending your stay to 3 or more nights.',
   2, 4, '', 9.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', '[6]',
   0, 0, 41, 1, 3, 14, 0, 1, '2026-11-01 00:00:00', '2026-11-30 23:59:59', 0, 0,
   'Minimum 3 consecutive nights.', ''),

  -- Fixed Amount Tab(卡片网格)
  (7, 6, 0, '[M8 Demo] Early Bird 10,000MMK Off', '10,000MMK off for bookings made 30 days in advance.',
   1, 2, '', 10000.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   200, 88, 23, 1, 0, 0, 30, 1, '2026-10-01 00:00:00', '2026-12-31 23:59:59', 0, 1,
   'Advance purchase required.', ''),
  (7, 6, 0, '[M8 Demo] Stay 3 Nights, Save 20,000MMK', 'Enjoy an extra save 20,000MMK when extending your stay to 3 or more nights.',
   1, 4, '', 20000.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', '[5]',
   150, 60, 18, 1, 3, 0, 0, 1, '2026-11-01 00:00:00', '2026-11-30 23:59:59', 0, 1,
   'Minimum 3 consecutive nights.', ''),

  -- Coupon Code Tab(表格)—— 稿面 5 行样例
  (7, 6, 0, '[M8 Demo] WELCOME26', 'Welcome offer for returning guests.',
   2, 3, 'DEMOWELCOME26', 9.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   100, 45, 45, 1, 0, 0, 0, 1, '2026-10-01 00:00:00', '2026-10-31 23:59:59', 0, 1, '', ''),
  (7, 6, 0, '[M8 Demo] VIP5000', 'Flat discount for VIP guests.',
   1, 3, 'DEMOVIP5000', 5000.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   0, 132, 77, 1, 0, 0, 0, 1, '2026-01-01 00:00:00', NULL, 0, 1, '', ''),
  (7, 6, 0, '[M8 Demo] SUMMER20', 'Summer campaign coupon.',
   2, 3, 'DEMOSUMMER20', 8.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   200, 80, 62, 1, 0, 0, 0, 1, '2026-06-01 00:00:00', '2026-08-31 23:59:59', 0, 3, '', ''),
  (7, 6, 0, '[M8 Demo] LOYALTY10', 'Loyalty members discount.',
   2, 3, 'DEMOLOYALTY10', 9.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   500, 120, 96, 1, 0, 0, 0, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, 1, '', ''),
  (7, 6, 0, '[M8 Demo] NEWYEAR', 'New year flat discount.',
   1, 3, 'DEMONEWYEAR', 3000.00, 0, 0, 2, '{"merchant":100}', 3, '[7]', NULL,
   50, 50, 50, 1, 0, 0, 0, 1, '2025-12-25 00:00:00', '2026-01-05 23:59:59', 0, 1, '', '');

-- ---- 3. 曝光埋点(按日聚合;近 30 天各来源造一批,支撑转化率与趋势图) ----
INSERT INTO `marketing_promotion_impression`
  (`site_id`, `coupon_id`, `campaign_id`, `stat_date`, `source`, `impressions`)
SELECT 7, c.`id`, 0, DATE_SUB(CURDATE(), INTERVAL n.`d` DAY), 'app_list',
       -- 用券 id 做基数,保证每张券的数字不同且可复现
       120 + (c.`id` % 7) * 35 + n.`d` * 4
FROM `marketing_coupon` c
JOIN (
  SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 8 UNION ALL SELECT 11 UNION ALL SELECT 15
  UNION ALL SELECT 20 UNION ALL SELECT 26
) n
WHERE c.`coupon_name` LIKE '[M8 Demo]%' AND c.`deleted_at` IS NULL;

-- ---- 4. 领券记录 + 结算流水(给效果分析页造出真实的领券/核销/收益/出资) ----
-- 每张券造 12 条领券记录,其中 6 条已核销并落 finance_account_entry
INSERT INTO `marketing_coupon_receive`
  (`site_id`, `coupon_id`, `user_id`, `coupon_code`, `status`, `valid_start`, `valid_end`, `order_id`, `used_time`, `created_at`)
SELECT 7, c.`id`, 9000 + n.`d`, CONCAT('DEMO', c.`id`, '-', n.`d`),
       IF(n.`d` % 2 = 0, 1, 0),
       DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 40 DAY),
       IF(n.`d` % 2 = 0, 700000 + c.`id` * 100 + n.`d`, 0),
       IF(n.`d` % 2 = 0, DATE_SUB(NOW(), INTERVAL n.`d` DAY), NULL),
       DATE_SUB(NOW(), INTERVAL (20 - n.`d`) DAY)
FROM `marketing_coupon` c
JOIN (
  SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
) n
WHERE c.`coupon_name` LIKE '[M8 Demo]%' AND c.`deleted_at` IS NULL;

-- 结算流水:coupon_id 存的是**领券记录 ID**(不是券模板 ID),与 SettlementService 一致
INSERT INTO `finance_account_entry`
  (`site_id`, `order_id`, `order_no`, `merchant_id`, `property_id`, `room_type_id`, `coupon_id`,
   `order_amount`, `commission`, `discount_amount`, `funding_source`,
   `mtrip_pays`, `merchant_pays`, `partner_pays`, `merchant_settlement`, `platform_revenue`)
SELECT d.`site_id`, d.`order_id`, CONCAT('DEMO-', d.`order_id`), 6, 7, 5, d.`receive_id`,
       d.`order_amount`, ROUND(d.`order_amount` * 0.1, 2), d.`discount`, 2,
       0, d.`discount`, 0,
       ROUND(d.`order_amount` * 0.9 - d.`discount`, 2),
       ROUND(d.`order_amount` * 0.1, 2)
FROM (
  SELECT r.`site_id`, r.`order_id`, r.`id` AS `receive_id`,
         CASE WHEN c.`coupon_type` = 2 THEN 19500.00 + (r.`user_id` % 5) * 1000 ELSE 25000.00 END AS `order_amount`,
         CASE WHEN c.`coupon_type` = 2
              THEN ROUND((19500.00 + (r.`user_id` % 5) * 1000) * (1 - c.`discount_value` / 10), 2)
              ELSE c.`discount_value` END AS `discount`
  FROM `marketing_coupon_receive` r
  JOIN `marketing_coupon` c ON c.`id` = r.`coupon_id`
  WHERE c.`coupon_name` LIKE '[M8 Demo]%' AND r.`status` = 1 AND r.`deleted_at` IS NULL
) d;

-- ---- 5. 平台活动 + 商户参与(定向邀请 + 公开报名各一条) ----
INSERT INTO `marketing_campaign`
  (`site_id`, `title`, `subtitle`, `banner`, `landing_url`, `coupon_ids`,
   `funding_source`, `funding_rules`, `requirements`, `terms`, `invite_mode`,
   `start_time`, `end_time`, `sort`, `status`)
VALUES
  (7, '[M8 Demo] Songkran Water Festival', 'Co-funded water festival campaign for Phuket and Yangon hotels.',
   '', '', NULL, 4, '{"mtrip":60,"merchant":40}', '', '', 1,
   DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 27 DAY), 0, 1),
  (7, '[M8 Demo] Green Season Flash Sale', 'Platform-funded flash sale, open to every hotel in the site.',
   '', '', NULL, 1, NULL, '', '', 2,
   DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 14 DAY), 1, 1);

UPDATE `marketing_campaign`
   SET `requirements` = 'Property must be published, KYC approved, and keep at least 5 sellable rooms during the campaign window.',
       `terms` = 'Discount applies to room-only bookings of 2 nights or more. Platform funds 60% of the discount, the merchant funds 40%. Cancellations follow the property refund policy.',
       `coupon_ids` = (SELECT JSON_ARRAYAGG(`id`) FROM `marketing_coupon` WHERE `coupon_name` = '[M8 Demo] WELCOME26')
 WHERE `title` = '[M8 Demo] Songkran Water Festival';

UPDATE `marketing_campaign`
   SET `requirements` = 'Open to all published hotels in this site.',
       `terms` = 'Fully funded by the platform. No merchant co-payment. Campaign budget is limited and allocated first come, first served.'
 WHERE `title` = '[M8 Demo] Green Season Flash Sale';

-- 定向邀请:商户 6 收到邀请待响应;公开报名:商户 6 尚未报名(列表里可见、可直接参加)
INSERT INTO `marketing_campaign_participant`
  (`site_id`, `campaign_id`, `merchant_id`, `status`, `funding_source`, `funding_rules`, `invited_at`)
SELECT 7, c.`id`, 6, 0, c.`funding_source`, c.`funding_rules`, DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM `marketing_campaign` c
WHERE c.`title` = '[M8 Demo] Songkran Water Festival';

-- ---- 6. 券码镜像(让 C 端 /coupon/redeem 真能兑换这些演示券码) ----
INSERT INTO `marketing_promo_code`
  (`site_id`, `code`, `name`, `coupon_id`, `discount_type`, `discount_value`, `discount_display`,
   `status`, `start_date`, `end_date`, `usage_limit`, `usage_count`, `per_user_limit`,
   `min_spend`, `stackable`, `merchant_scope`, `merchant_count`, `created_by`)
SELECT c.`site_id`, c.`promo_code`, c.`coupon_name`, c.`id`,
       IF(c.`coupon_type` = 2, 'percentage', 'amount'), c.`discount_value`,
       IF(c.`coupon_type` = 2, CONCAT(ROUND((10 - c.`discount_value`) * 10), '% OFF'), CONCAT(c.`discount_value`, ' OFF')),
       IF(c.`status` = 1, 1, 5),
       DATE(c.`valid_start`), DATE(c.`valid_end`), c.`total_count`, 0, c.`per_user_limit`,
       ROUND(c.`min_amount`), 0, 'custom', 1, 'M8 Demo'
FROM `marketing_coupon` c
WHERE c.`coupon_name` LIKE '[M8 Demo]%' AND c.`promo_code` <> '' AND c.`deleted_at` IS NULL;

SELECT 'M8 demo data ready' AS result,
       (SELECT COUNT(*) FROM `marketing_coupon` WHERE `coupon_name` LIKE '[M8 Demo]%') AS promotions,
       (SELECT COUNT(*) FROM `marketing_promotion_impression` i JOIN `marketing_coupon` c ON c.`id` = i.`coupon_id` WHERE c.`coupon_name` LIKE '[M8 Demo]%') AS impression_rows,
       (SELECT COUNT(*) FROM `marketing_coupon_receive` r JOIN `marketing_coupon` c ON c.`id` = r.`coupon_id` WHERE c.`coupon_name` LIKE '[M8 Demo]%') AS receive_rows,
       (SELECT COUNT(*) FROM `marketing_campaign` WHERE `title` LIKE '[M8 Demo]%') AS campaigns;
