-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App M4 酒店预订管理]:预订管理菜单改名 + 履约按钮权限 + 业务模块标记
-- 需求源:docs/plans/实现方案-Merchant-M4-酒店预订管理.md §7.3 / §3
-- 库:mtrip_business;幂等(守卫式 ALTER / INSERT IGNORE)
-- 约定:#[Permission] 键与本文件 perm_key、前端 v-perm 三者完全一致
-- ============================================================
USE `mtrip_business`;

-- ---------- 1. merchant_menu 增加业务模块标记(酒店预订菜单仅酒店业务视图展示) ----------
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_menu' AND COLUMN_NAME='business_scope');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `merchant_menu` ADD COLUMN `business_scope` VARCHAR(20) NOT NULL DEFAULT '''' COMMENT ''所属业务模块:空=全业务可见,hotel=仅酒店业务视图展示'' AFTER `account_scope`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 2. 订单核销菜单升级为预订管理(路由/组件不变,兼容既有授权) ----------
UPDATE `merchant_menu` SET
  `menu_name` = '预订管理',
  `menu_name_en` = 'Booking Management',
  `i18n_key` = 'menu.booking',
  `business_scope` = 'hotel'
WHERE `id` = 400 AND `perm_key` = 'mch:order:list';

-- ---------- 3. 预订履约按钮权限 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(40002, 400, '查看预订详情', 'View Booking',     'mch:order:detail',        3, 2,  '1,2,3'),
(40003, 400, '导出预订',     'Export Bookings',  'mch:order:export',        3, 3,  '1,2,3'),
(40004, 400, '确认预订',     'Confirm Booking',  'mch:order:confirm',       3, 4,  '1,2,3'),
(40005, 400, '办理入住',     'Check In',         'mch:order:check-in',      3, 5,  '1,2,3'),
(40006, 400, '办理退房',     'Check Out',        'mch:order:check-out',     3, 6,  '1,2,3'),
(40007, 400, '取消预订',     'Cancel Booking',   'mch:order:cancel',        3, 7,  '1,2,3'),
(40008, 400, '预订退款',     'Refund Booking',   'mch:order:refund',        3, 8,  '1,2,3'),
(40009, 400, '标记未入住',   'Mark No-show',     'mch:order:no-show',       3, 9,  '1,2,3'),
(40010, 400, 'No-show豁免费用', 'Waive No-show Fee', 'mch:order:no-show-waive', 3, 10, '1,2'),
(40011, 400, '内部备注',     'Internal Note',    'mch:order:note',          3, 11, '1,2,3'),
(40012, 400, '同步PMS渠道',  'Sync PMS',         'mch:order:sync',          3, 12, '1,2,3'),
(40013, 400, '预订凭证',     'Booking Voucher',  'mch:order:voucher',       3, 13, '1,2,3'),
(40014, 400, '查看住客联系方式', 'View Guest Contact', 'mch:order:guest-contact', 3, 14, '1,2,3');

-- ---------- 4. 内置角色授权新增按钮(不自动扩权给自建角色) ----------
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `merchant_menu` WHERE `id` BETWEEN 40002 AND 40014 AND `deleted_at` IS NULL AND FIND_IN_SET(1, `account_scope`);
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 2, `id` FROM `merchant_menu` WHERE `id` BETWEEN 40002 AND 40014 AND `deleted_at` IS NULL AND FIND_IN_SET(2, `account_scope`);
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 3, `id` FROM `merchant_menu` WHERE `id` BETWEEN 40002 AND 40014 AND `deleted_at` IS NULL AND FIND_IN_SET(3, `account_scope`);
