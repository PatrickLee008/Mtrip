-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 种子数据 05:供应商端菜单树 + 内置角色 + 角色菜单授权(计划 14-供应商端 supplier-web 落地)
-- 库:mtrip_business
-- ID 规则:一级=100N;页面=一级+序号;按钮=页面ID*100+序号
-- menu_type:1目录 2页面 3按钮
-- 供应商单层主体,菜单对全部供应商账号可见(无 account_scope)
-- 幂等:INSERT IGNORE + 授权 SELECT
-- ============================================================
USE `mtrip_business`;

-- ---------- 一级(工作台为独立页面;组织与权限为目录;供货商品/对账结算为页面) ----------
INSERT IGNORE INTO `supplier_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `i18n_key`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(100, 0, '工作台',     'Dashboard', 'menu.dashboard', 'sup:dashboard',   2, '/dashboard', 'dashboard/index', 'DashboardOutlined', 1),
(200, 0, '组织与权限', 'Org',       'menu.org',       'sup:org',         1, '/account',   '',                'TeamOutlined',      2),
(300, 0, '供货商品',   'Supply',    'menu.supply',    'sup:goods:list',  2, '/goods',     'goods/index',     'GoldOutlined',      3),
(400, 0, '对账结算',   'Settle',    'menu.settle',    'sup:settle:list', 2, '/settle',    'settle/index',    'AccountBookOutlined', 4);

-- ---------- 组织与权限:子账号管理 + 角色管理 ----------
INSERT IGNORE INTO `supplier_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `i18n_key`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(201, 200, '子账号管理', 'Sub Accounts', 'menu.account', 'sup:account:list', 2, '/account/list', 'account/index', '', 1),
(202, 200, '角色管理',   'Roles',        'menu.role',    'sup:role:list',    2, '/account/role', 'role/index',    '', 2);
INSERT IGNORE INTO `supplier_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`) VALUES
(20101, 201, '新增子账号', 'Add Account',    'sup:account:add',       3, 1),
(20102, 201, '编辑子账号', 'Edit Account',   'sup:account:edit',      3, 2),
(20103, 201, '启用禁用',   'Enable/Disable', 'sup:account:status',    3, 3),
(20104, 201, '重置密码',   'Reset Password', 'sup:account:reset-pwd', 3, 4),
(20201, 202, '新增角色',   'Add Role',       'sup:role:add',          3, 1),
(20202, 202, '编辑角色',   'Edit Role',      'sup:role:edit',         3, 2),
(20203, 202, '删除角色',   'Delete Role',    'sup:role:delete',       3, 3),
(20204, 202, '分配菜单',   'Assign Menus',   'sup:role:assign',       3, 4),
(20205, 202, '赋予角色',   'Grant Role',     'sup:role:grant',        3, 5);

-- ---------- 供货商品按钮 ----------
INSERT IGNORE INTO `supplier_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`) VALUES
(30001, 300, '新增供货商品', 'Add Goods',      'sup:goods:add',    3, 1),
(30002, 300, '编辑供货商品', 'Edit Goods',     'sup:goods:edit',   3, 2),
(30003, 300, '停供/恢复',    'Toggle Supply',  'sup:goods:status', 3, 3),
(30004, 300, '删除供货商品', 'Delete Goods',   'sup:goods:delete', 3, 4);

-- ---------- 内置角色(supplier_id=0,is_builtin=1) ----------
INSERT INTO `supplier_role` (`id`, `site_id`, `supplier_id`, `role_name`, `role_code`, `is_builtin`, `status`, `remark`)
VALUES (1, 0, 0, '供应商管理员', 'supplier_admin', 1, 1, '平台内置:供应商账号可见全部功能')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

-- ---------- 内置角色授权:获授全部启用菜单 ----------
INSERT IGNORE INTO `supplier_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `supplier_menu` WHERE `deleted_at` IS NULL AND `status` = 1;
