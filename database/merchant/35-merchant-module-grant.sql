SET NAMES utf8mb4;
USE `mtrip_business`;
-- ============================================================
-- 增量 35:商户功能模块授权(管理端开通商户时授予酒店/餐饮等业务模块)
--
-- 两段式:
--   1) merchant_menu.module_key —— 该菜单属于哪个业务模块,''=公共菜单(始终可见)
--   2) merchant_module_grant    —— 某商户被授予了哪些模块
--
-- 可见性口径(MerchantAuthService::menus / RoleController::menuTree 实现):
--   · 商户在本表**没有任何授权行** → 视为全模块开通(向后兼容,不影响存量商户登录)
--   · 商户**有授权行**            → 只可见 module_key='' 的公共菜单 + 已授权模块的菜单
--   · account_type=1 集团账号     → 恒为全模块(集团跨商户,不按单商户模块裁剪)
--   · account_type=3 门店账号     → 沿用所属商户的授权
--
-- 幂等:CREATE TABLE IF NOT EXISTS + information_schema 探测加列 + 条件回填
-- ============================================================

CREATE TABLE IF NOT EXISTS `merchant_module_grant` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id` BIGINT UNSIGNED NOT NULL COMMENT '商户ID(merchant_info.id)',
  `module_key`  VARCHAR(30)  NOT NULL COMMENT '模块标识:hotel/restaurant/...',
  `granted_by`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '授权人(sys_admin.id)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_merchant_module` (`merchant_id`, `module_key`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户功能模块授权表';

-- 菜单归属模块(''=公共)
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_menu' AND COLUMN_NAME='module_key')=0, 'ALTER TABLE merchant_menu ADD COLUMN module_key VARCHAR(30) NOT NULL DEFAULT '''' COMMENT ''所属业务模块,空=公共菜单''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_menu' AND INDEX_NAME='idx_module_key')=0, 'ALTER TABLE merchant_menu ADD INDEX idx_module_key (module_key)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 回填:客房管理(600)与房量与价格(700)及其按钮为酒店专属;其余留空=公共。
-- 说明:商品管理(500)故意保持公共 —— 酒店的增值商品与餐饮的菜品共用该页面;
--       待餐饮专属页面(如菜品管理)落地后再在此处补 module_key='restaurant'。
UPDATE `merchant_menu`
SET `module_key` = 'hotel'
WHERE `module_key` = ''
  AND `id` IN (600, 60001, 60002, 60003, 60004, 700, 70001, 70002, 70003);
