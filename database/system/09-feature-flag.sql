-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 模块11]:平台特性开关(Feature Toggles)
-- 设计源:docs/redesign/super-admin-portal/modules/11-platform-configuration.md
-- 库:mtrip_system
-- ============================================================
USE `mtrip_system`;

CREATE TABLE IF NOT EXISTS `sys_feature_flag` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID(0=全局)',
  `flag_key`    VARCHAR(50)  NOT NULL COMMENT '开关键',
  `label`       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '显示名',
  `description` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '说明',
  `enabled`     TINYINT      NOT NULL DEFAULT 0 COMMENT '是否开启:0否 1是',
  `sort`        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_site_key` (`site_id`, `flag_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='平台特性开关';

-- 初始化 9 个特性开关(设计稿 Feature Toggles)
INSERT IGNORE INTO `sys_feature_flag` (`site_id`, `flag_key`, `label`, `description`, `enabled`, `sort`) VALUES
(0, 'affiliate_program',     'Affiliate Program',      'Enable affiliate and influencer partner program',        1, 1),
(0, 'flash_sale',            'Flash Sale Campaigns',   'Allow merchants to create flash sale promotions',        1, 2),
(0, 'dynamic_pricing',       'Dynamic Pricing',        'AI-driven dynamic pricing suggestions',                  0, 3),
(0, 'instant_booking',       'Instant Booking',        'Allow instant booking without merchant confirmation',    1, 4),
(0, 'split_payments',        'Split Payments',         'Enable split payment for group bookings',                0, 5),
(0, 'loyalty_points',        'Loyalty Points',         'mTrip Rewards loyalty point accumulation',               1, 6),
(0, 'multi_currency',        'Multi-currency Display', 'Show prices in user-selected currency',                  0, 7),
(0, 'merchant_impersonation','Merchant Impersonation', 'Allow super admins to impersonate merchants',            1, 8),
(0, 'two_factor_auth',       'Two-Factor Auth (2FA)',  'Require 2FA for all admin accounts',                     1, 9);
