-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- C 端优惠券——联调用演示数据(一次性 fixture,勿用于生产)
--
-- 起因:开发库里仅有的 5 张券(id 4-8)全在 **site 1**,而 C 端账号(21/25/28)都在
--       **site 7** —— 领券中心 `/marketing/coupon/available` 按 site_id 过滤,所以一张都看不到;
--       结账的 `/marketing/coupon/match-list` 只查本人已领记录,库里也是 0 条。
--
-- 金额按**开发库真实房价**定:site 7 只有物业 3(胤竹酒店)的房型 3 标准间 19,500 /
-- 房型 4 豪华客房 29,500,历史订单落在 19,500~118,000 之间。门槛因此压在 30,000~80,000,
-- 不要照搬设计稿上的 20 万门槛 —— 那样每张券都是「未达门槛」,等于没造。
--
-- 五张券覆盖结账那条链路的各个分支:
--   1 满减 · 仅酒店     满 50,000 减 8,000        → 门槛 + goods_scope=1 过滤
--   2 折扣 · 全场 · 封顶 8.5 折,最高减 10,000     → 折扣率与封顶
--   3 无门槛             直减 5,000               → 永远可用,用来看「自动择优」会不会选错
--   4 指定物业           物业 3 满 30,000 减 6,000 → **验证 Trip 的券范围校验**
--                                                   (2026-09-21 修过 TripController:
--                                                    整车同一家酒店才把 propertyId 传下去)
--   5 促销码 MTRIP2026   满 80,000 减 15,000       → 走 `marketing_promo_code` 兑换链路
--
-- 发放:1/2/4 直接发给 site 7 **全部三个账号**(21/25/28),省得猜你登的是哪个;
--       3 留在领券中心手动领,5 留给你在 App 里输码兑换。
--
-- ⚠ 本库的 `marketing_coupon` 比 `database/marketing/01-marketing.sql` **旧**:
--   没有 description / promotion_kind / promo_code / staff_note,另有 funding_source /
--   funding_rules / stackable。本文件按**库里实际列**写;C 端服务(CouponView)只读这些列,
--   所以不影响。哪天补了 M8 那批迁移,这里要跟着加列。
--
-- ⚠ 不登记进 deploy/docker-compose.yml 的 initdb 挂载,也不被 test/apply.sh 导入。
-- 幂等:先按 `[C Demo]` 记号删掉上次插入的券/领券/促销码,再重新插入(可重复执行)。
--
-- 导入:
--   docker exec -i mtrip-mysql-1 mysql -uroot -proot@2026 --default-character-set=utf8mb4 < test/adhoc/c-coupon-demo.sql
-- ============================================================
USE `mtrip_business`;

-- ---- 0. 参数(换库/换账号只改这里) ----
SET @site_id     = 7;    -- C 端账号所在站点
SET @property_id = 3;    -- 胤竹酒店(site 7 目前唯一有房型的物业)

-- ---- 1. 清理上次插入的演示数据 ----
DELETE FROM `marketing_promo_code_redeem`
 WHERE `promo_code_id` IN (SELECT `id` FROM `marketing_promo_code` WHERE `code` = 'MTRIP2026');
DELETE FROM `marketing_promo_code` WHERE `code` = 'MTRIP2026';
DELETE FROM `marketing_coupon_receive`
 WHERE `coupon_id` IN (SELECT `id` FROM `marketing_coupon` WHERE `coupon_name` LIKE '[C Demo]%');
DELETE FROM `marketing_coupon` WHERE `coupon_name` LIKE '[C Demo]%';

-- ---- 2. 券模板 ----
-- status=1 进行中;valid_type=1 固定日期(今天起 60 天);funding_source=1 平台出资;
-- stackable=0 不叠加(与现网默认一致);total_count=0 不限量;per_user_limit=1。
INSERT INTO `marketing_coupon`
  (`site_id`, `merchant_id`, `coupon_name`, `coupon_type`, `discount_value`, `min_amount`, `max_discount`,
   `funding_source`, `goods_scope`, `property_ids`, `room_type_ids`, `total_count`, `per_user_limit`,
   `valid_type`, `valid_start`, `valid_end`, `stackable`, `status`, `remark`)
VALUES
  -- 1 满减 · 仅酒店订单
  (@site_id, 0, '[C Demo] Hotel Save 8,000', 1, 8000.00, 50000.00, 0.00,
   1, 1, NULL, NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), 0, 1,
   'Valid on hotel bookings only. One coupon per order.'),

  -- 2 折扣 · 全场 · 封顶
  (@site_id, 0, '[C Demo] 15% Off Sitewide', 2, 8.50, 0.00, 10000.00,
   1, 0, NULL, NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), 0, 1,
   'Up to MMK 10,000 off. One coupon per order.'),

  -- 3 无门槛(留在领券中心手动领,用来验证「领取」按钮)
  (@site_id, 0, '[C Demo] 5,000 Off No Minimum', 3, 5000.00, 0.00, 0.00,
   1, 0, NULL, NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), 0, 1,
   'No minimum spend. One coupon per order.'),

  -- 4 指定物业:goods_scope=3 + property_ids,验证 Trip 下的范围校验
  (@site_id, 0, '[C Demo] Yinzhu Hotel Only 6,000 Off', 1, 6000.00, 30000.00, 0.00,
   1, 3, JSON_ARRAY(@property_id), NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), 0, 1,
   'Valid at the selected hotel only. One coupon per order.'),

  -- 5 促销码兑换后拿到的券
  -- ⚠ 必须 status=1:兑换走 assertCouponIssuable,已停发(2)会报 40914「促销码关联的优惠券未在发放中」。
  --    本库没有「隐藏券」的概念(领券中心 availableCoupons 只按 site+status+有效期过滤),
  --    所以这张在领券中心也看得见、也能直接领 —— 想只验证兑换链路,就拿个没领过它的账号输码。
  (@site_id, 0, '[C Demo] Promo MTRIP2026 15,000 Off', 1, 15000.00, 80000.00, 0.00,
   1, 0, NULL, NULL, 0, 1,
   1, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), 0, 1,
   'Redeemed with promo code MTRIP2026. One coupon per order.');

-- ---- 3. 促销码 MTRIP2026 → 绑第 5 张券 ----
-- 本库的促销码是**独立表**(不是 marketing_coupon.promo_code);status=1 生效,
-- 兑换逻辑见 MarketingController::redeemPromoCode / assertPromoUsable。
INSERT INTO `marketing_promo_code`
  (`site_id`, `code`, `name`, `campaign_id`, `coupon_id`, `discount_type`, `discount_value`,
   `discount_display`, `status`, `start_date`, `end_date`, `usage_limit`, `usage_count`,
   `per_user_limit`, `min_spend`, `stackable`, `merchant_scope`, `merchant_count`, `created_by`)
SELECT @site_id, 'MTRIP2026', '[C Demo] MTRIP2026', 0, c.`id`, 2, 15000.00,
       'MMK 15,000 OFF', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 60 DAY), 0, 0,
       1, 80000.00, 0, 0, 0, 0
  FROM `marketing_coupon` c
 WHERE c.`coupon_name` = '[C Demo] Promo MTRIP2026 15,000 Off';

-- ---- 4. 把 1/2/4 发给 site 7 的全部账号 ----
-- 券码唯一:CDEMO-<券id>-<用户id>;status=0 未使用;有效期跟模板。
INSERT INTO `marketing_coupon_receive`
  (`site_id`, `coupon_id`, `user_id`, `coupon_code`, `status`, `valid_start`, `valid_end`)
SELECT c.`site_id`, c.`id`, u.`id`,
       CONCAT('CDEMO-', c.`id`, '-', u.`id`), 0, c.`valid_start`, c.`valid_end`
  FROM `marketing_coupon` c
  JOIN `user_info` u ON u.`site_id` = c.`site_id` AND u.`deleted_at` IS NULL
 WHERE c.`coupon_name` IN (
         '[C Demo] Hotel Save 8,000',
         '[C Demo] 15% Off Sitewide',
         '[C Demo] Yinzhu Hotel Only 6,000 Off');

-- 领取数同步(领券中心「已领 n」按它显示)
UPDATE `marketing_coupon` c
   SET c.`received_count` = (
        SELECT COUNT(*) FROM `marketing_coupon_receive` r
         WHERE r.`coupon_id` = c.`id` AND r.`deleted_at` IS NULL)
 WHERE c.`coupon_name` LIKE '[C Demo]%';

-- ---- 5. 核对 ----
SELECT c.`id`, c.`coupon_name`, c.`coupon_type` AS `type`, c.`discount_value` AS `value`,
       c.`min_amount` AS `min`, c.`max_discount` AS `cap`, c.`goods_scope` AS `scope`,
       c.`status`, c.`received_count` AS `received`
  FROM `marketing_coupon` c
 WHERE c.`coupon_name` LIKE '[C Demo]%'
 ORDER BY c.`id`;

SELECT r.`user_id`, COUNT(*) AS `my_coupons`
  FROM `marketing_coupon_receive` r
  JOIN `marketing_coupon` c ON c.`id` = r.`coupon_id`
 WHERE c.`coupon_name` LIKE '[C Demo]%'
 GROUP BY r.`user_id` ORDER BY r.`user_id`;
