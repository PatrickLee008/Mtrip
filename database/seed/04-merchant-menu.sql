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
(400, 0, '订单核销',   'Orders',    'menu.order',     'mch:order:list',  2, '/order',     'order/index',     'ProfileOutlined',   4, '1,2,3'),
(500, 0, '商品管理',   'Goods',     'menu.goods',     'mch:goods:list',  2, '/goods',     'goods/index',     'GoldOutlined',      5, '1,2,3');

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

-- ---------- 订单核销按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(40001, 400, '订单核销', 'Verify Order',  'mch:order:verify', 3, 1, '1,2,3');

-- ---------- 商品管理按钮 ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(50001, 500, '新增商品', 'Add Goods',      'mch:goods:add',    3, 1, '1,2'),
(50002, 500, '编辑商品', 'Edit Goods',     'mch:goods:edit',   3, 2, '1,2'),
(50003, 500, '上下架',   'On/Off Shelf',   'mch:goods:status', 3, 3, '1,2');

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
