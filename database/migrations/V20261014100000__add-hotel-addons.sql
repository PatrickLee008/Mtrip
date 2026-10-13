SET NAMES utf8mb4;

-- 酒店附加服务(Merchant PRD「optional value-added services」+ Consumer App 订房「Enhance Your Stay」,QA CA_TC_034)。
--
--   merchant_store.addons      物业的附加服务配置(JSON 数组,随物业资料审核发布)。
--                              服务固定 7 项:breakfast / airport_transfer / spa / laundry / room_service / extra_bed / late_checkout;
--                              每项 {key, enabled, price, units:[person|night|room], description},
--                              价格 = price × 人数(勾 person)× 晚数(勾 night)× 间数(勾 room),都不勾按次收一次。
--   order_main.addon_amount    本预订的附加服务金额(不参与券/长住折扣;取消时全额退,不受取消政策影响)。
--                              明细快照写在已有的 order_main.addon_snapshot。
--
-- 唯一计价实现:order-service App\Service\AddonPricingService。
-- 幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_store' AND COLUMN_NAME = 'addons');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `merchant_store` ADD COLUMN `addons` JSON NULL COMMENT ''附加服务配置(随资料审核发布)'' AFTER `hotel_policies`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_main' AND COLUMN_NAME = 'addon_amount');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `order_main` ADD COLUMN `addon_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''附加服务金额(取消全额退)'' AFTER `addon_snapshot`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
