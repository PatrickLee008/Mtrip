-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 种子数据 04:商家端菜单树 + 内置角色 + 角色菜单授权(计划 13-商家端 merchant-web 落地)
-- 库:mtrip_business
-- ID 规则:一级=100N;页面=一级+序号;按钮=页面ID*100+序号
-- menu_type:1目录 2页面 3按钮
-- account_scope:该菜单对哪些 account_type 可见(1集团 2商户 3门店,逗号分隔)
-- 幂等:INSERT IGNORE + 授权 SELECT
-- ============================================================
USE `mtrip_business`;

-- ---------- 一级(工作台为独立页面;其余为目录/页面) ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `i18n_key`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`, `account_scope`) VALUES
(100, 0, '工作台',     'Dashboard', 'menu.dashboard', 'mch:dashboard',   2, '/dashboard', 'dashboard/index', 'DashboardOutlined', 1, '1,2,3'),
(200, 0, '组织与权限', 'Org',       'menu.org',       'mch:org',         1, '/account',   '',                'TeamOutlined',      2, '1,2'),
(300, 0, '门店管理',   'Stores',    'menu.store',     'mch:store:list',  2, '/store',     'store/index',     'ShopOutlined',      3, '1,2,3'),
(400, 0, '预订管理',   'Booking Management', 'menu.booking', 'mch:order:list',  2, '/order',     'order/index',     'ProfileOutlined',   4, '1,2,3'),
(500, 0, '商品管理',   'Goods',     'menu.goods',     'mch:goods:list',  2, '/goods',     'goods/index',     'GoldOutlined',      5, '1,2,3'),
(600, 0, '客房管理',   'Rooms',     'menu.rooms',     'mch:rooms:list',  2, '/rooms',     'rooms/index',     'HomeOutlined',      6, '1,2,3'),
(700, 0, '房量与价格', 'Availability & Pricing', 'menu.availability', 'mch:availability:list', 2, '/availability', 'availability/index', 'CalendarOutlined', 7, '1,2,3'),
(800, 0, '收益结算',   'Earnings',  'menu.earnings',  'mch:earnings:list', 2, '/earnings', 'earnings/index', 'AccountBookOutlined', 8, '1,2,3'),
(900, 0, '通知中心',   'Notifications', 'menu.notifications', 'mch:notifications:list', 2, '/notifications', 'notifications/index', 'BellOutlined', 9, '1,2,3'),
(1000, 0, '营销活动',  'Promotions', 'menu.promotions', 'mch:promotions:list', 2, '/promotions', 'promotions/index', 'TagOutlined', 10, '1,2,3'),
(1100, 0, '评价管理',  'Reviews', 'menu.reviews', 'mch:reviews:list', 2, '/reviews', 'reviews/index', 'StarOutlined', 11, '1,2,3'),
(1200, 0, '帮助中心',  'Support', 'menu.support', 'mch:support:list', 2, '/support', 'support/index', 'CustomerServiceOutlined', 12, '1,2,3'),
(1300, 0, '设置',      'Settings', 'menu.settings', 'mch:settings:list', 2, '/settings', 'settings/index', 'SettingOutlined', 13, '1,2,3');

-- ---------- 组织与权限:子账号管理 + 角色管理 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `i18n_key`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`, `account_scope`) VALUES
(201, 200, '子账号管理', 'Sub Accounts', 'menu.account', 'mch:account:list', 2, '/account/list', 'account/index', '', 1, '1,2'),
(202, 200, '角色管理',   'Roles',        'menu.role',    'mch:role:list',    2, '/account/role', 'role/index',    '', 2, '1,2');
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(20101, 201, '新增子账号', 'Add Account',    'mch:account:add',       3, 1, '1,2'),
(20102, 201, '编辑子账号', 'Edit Account',   'mch:account:edit',      3, 2, '1,2'),
(20103, 201, '启用禁用',   'Enable/Disable', 'mch:account:status',    3, 3, '1,2'),
(20104, 201, '重置密码',   'Reset Password', 'mch:account:reset-pwd', 3, 4, '1,2'),
(20201, 202, '新增角色',   'Add Role',       'mch:role:add',          3, 1, '1,2'),
(20202, 202, '编辑角色',   'Edit Role',      'mch:role:edit',         3, 2, '1,2'),
(20203, 202, '删除角色',   'Delete Role',    'mch:role:delete',       3, 3, '1,2'),
(20204, 202, '分配菜单',   'Assign Menus',   'mch:role:assign',       3, 4, '1,2'),
(20205, 202, '赋予角色',   'Grant Role',     'mch:role:grant',        3, 5, '1,2');

-- ---------- 门店管理按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(30001, 300, '新增门店',   'Add Store',      'mch:store:add',      3, 1, '1,2'),
(30002, 300, '编辑门店',   'Edit Store',     'mch:store:edit',     3, 2, '1,2'),
(30003, 300, '设为主门店', 'Set Main',       'mch:store:set-main', 3, 3, '1,2'),
(30004, 300, '启用停业',   'Enable/Disable', 'mch:store:status',   3, 4, '1,2');

-- ---------- 预订管理按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(40001, 400, '订单核销', 'Verify Order',  'mch:order:verify', 3, 1, '1,2,3'),
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

-- ---------- 商品管理按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(50001, 500, '新增商品', 'Add Goods',      'mch:goods:add',    3, 1, '1,2'),
(50002, 500, '编辑商品', 'Edit Goods',     'mch:goods:edit',   3, 2, '1,2'),
(50003, 500, '上下架',   'On/Off Shelf',   'mch:goods:status', 3, 3, '1,2');

-- ---------- 客房管理按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(60001, 600, '新增房型', 'Add Room Type',      'mch:rooms:add',    3, 1, '1,2'),
(60002, 600, '编辑房型', 'Edit Room Type',     'mch:rooms:edit',   3, 2, '1,2'),
(60003, 600, '删除房型', 'Delete Room Type',   'mch:rooms:delete', 3, 3, '1,2'),
(60004, 600, '启用停售', 'Enable/Disable',     'mch:rooms:status', 3, 4, '1,2');

-- ---------- 房量与价格按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(70001, 700, '编辑日历', 'Edit Calendar',  'mch:availability:edit',        3, 1, '1,2,3'),
(70002, 700, '批量更新', 'Bulk Update',    'mch:availability:bulk-update', 3, 2, '1,2,3'),
(70003, 700, '同步库存', 'Sync Inventory', 'mch:availability:sync',        3, 3, '1,2,3');

-- ---------- 收益结算按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(80001, 800, '导出结算单', 'Export Settlements', 'mch:earnings:export',  3, 1, '1,2,3'),
(80002, 800, '提交申诉',   'Submit Dispute',    'mch:earnings:dispute', 3, 2, '1,2,3');

-- ---------- 通知中心按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(90001, 900, '标记已读', 'Mark as Read', 'mch:notifications:read', 3, 1, '1,2,3');

-- ---------- 营销活动按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(100001, 1000, '新增活动', 'Add Promotion',    'mch:promotions:add',    3, 1, '1,2'),
(100002, 1000, '编辑活动', 'Edit Promotion',   'mch:promotions:edit',   3, 2, '1,2'),
(100003, 1000, '发布/停发', 'Publish/Pause',   'mch:promotions:status', 3, 3, '1,2'),
(100004, 1000, '删除活动', 'Delete Promotion', 'mch:promotions:delete', 3, 4, '1,2');

-- ---------- 评价管理按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(110001, 1100, '回复评价', 'Reply Review', 'mch:reviews:reply', 3, 1, '1,2,3'),
(110002, 1100, '标记复核', 'Flag Review',  'mch:reviews:flag',  3, 2, '1,2,3');

-- ---------- 内置角色(merchant_id=0,is_builtin=1;按 account_type 区分) ----------
INSERT INTO `merchant_role` (`id`, `site_id`, `group_id`, `merchant_id`, `account_type`, `role_name`, `role_code`, `is_builtin`, `status`, `remark`)
VALUES (1, 0, 0, 0, 1, '集团管理员', 'group_admin', 1, 1, '平台内置:集团账号可见全部功能')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);
INSERT INTO `merchant_role` (`id`, `site_id`, `group_id`, `merchant_id`, `account_type`, `role_name`, `role_code`, `is_builtin`, `status`, `remark`)
VALUES (2, 0, 0, 0, 2, '商户管理员', 'merchant_admin', 1, 1, '平台内置:商户账号可见全部功能')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);
INSERT INTO `merchant_role` (`id`, `site_id`, `group_id`, `merchant_id`, `account_type`, `role_name`, `role_code`, `is_builtin`, `status`, `remark`)
VALUES (3, 0, 0, 0, 3, '门店管理员', 'store_admin', 1, 1, '平台内置:门店账号可见履约相关功能')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

-- ---------- 内置角色授权:各角色获授本 account_type 可见的全部菜单 ----------
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `merchant_menu` WHERE `deleted_at` IS NULL AND `status` = 1 AND FIND_IN_SET(1, `account_scope`);
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 2, `id` FROM `merchant_menu` WHERE `deleted_at` IS NULL AND `status` = 1 AND FIND_IN_SET(2, `account_scope`);
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 3, `id` FROM `merchant_menu` WHERE `deleted_at` IS NULL AND `status` = 1 AND FIND_IN_SET(3, `account_scope`);
