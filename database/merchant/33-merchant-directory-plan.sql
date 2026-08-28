SET NAMES utf8mb4;
USE `mtrip_business`;
-- 独立佣金档位，不根据旧VIP标记或佣金比例推断；NULL表示历史商户尚未配置。
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='commission_plan')=0,
 'ALTER TABLE merchant_info ADD COLUMN commission_plan VARCHAR(16) NULL DEFAULT NULL COMMENT ''vip/premium/standard; NULL=not configured''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
USE `mtrip_system`;
UPDATE sys_menu SET menu_name='商户管理', menu_name_en='Merchant Management', i18n_key='menu.merchant' WHERE perm_key='merchant' AND menu_type=1;
UPDATE sys_menu SET menu_name='所有商户', menu_name_en='All Merchants', i18n_key='menu.merchantList' WHERE component='merchant/list/index' AND menu_type=2;
