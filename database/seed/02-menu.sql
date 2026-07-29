-- ============================================================
-- 种子数据 02:菜单按钮权限树(12 个一级菜单 + 页面 + 按钮)
-- 库:mtrip_system
-- ID 规则:一级目录=100N;页面=一级+序号;按钮=页面ID*100+序号
-- menu_type:1一级菜单(目录) 2页面菜单 3页面按钮
-- ============================================================
USE `mtrip_system`;

-- ---------- 一级目录 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(100,  0, '系统管理',    'sys',       1, '/system',    '', 'SettingOutlined',     1),
(200,  0, '系统日志',    'log',       1, '/log',       '', 'FileSearchOutlined',  2),
(300,  0, '系统配置',    'config',    1, '/config',    '', 'ToolOutlined',        3),
(400,  0, '商户管理',    'merchant',  1, '/merchant',  '', 'ShopOutlined',        4),
(500,  0, '供应商管理',  'supplier',  1, '/supplier',  '', 'ApartmentOutlined',   5),
(600,  0, 'C端用户管理', 'user',      1, '/user',      '', 'TeamOutlined',        6),
(700,  0, '商品管理',    'goods',     1, '/goods',     '', 'GoldOutlined',        7),
(800,  0, '订单管理',    'order',     1, '/order',     '', 'ProfileOutlined',     8),
(900,  0, '财务管理',    'finance',   1, '/finance',   '', 'AccountBookOutlined', 9),
(1000, 0, '营销活动',    'marketing', 1, '/marketing', '', 'GiftOutlined',        10),
(1100, 0, '数据统计中心','stats',     1, '/stats',     '', 'BarChartOutlined',    11),
(1200, 0, '核销管理',    'verify',    1, '/verify',    '', 'ScanOutlined',        12);

-- ---------- 1 系统管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(101, 100, '管理员管理', 'sys:admin:list', 2, '/system/admin', 'system/admin/index', '', 1),
(102, 100, '角色管理',   'sys:role:list',  2, '/system/role',  'system/role/index',  '', 2),
(103, 100, '菜单权限',   'sys:menu:list',  2, '/system/menu',  'system/menu/index',  '', 3),
(104, 100, '操作日志',   'sys:oplog:list', 2, '/system/oplog', 'system/oplog/index', '', 4);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(10101, 101, '新增管理员', 'sys:admin:add',      3, 1),
(10102, 101, '编辑管理员', 'sys:admin:edit',     3, 2),
(10103, 101, '删除管理员', 'sys:admin:delete',   3, 3),
(10104, 101, '重置密码',   'sys:admin:reset-pwd',3, 4),
(10105, 101, '启用禁用',   'sys:admin:status',   3, 5),
(10201, 102, '新增角色',   'sys:role:add',       3, 1),
(10202, 102, '编辑角色',   'sys:role:edit',      3, 2),
(10203, 102, '删除角色',   'sys:role:delete',    3, 3),
(10204, 102, '分配权限',   'sys:role:perm',      3, 4),
(10301, 103, '新增菜单',   'sys:menu:add',       3, 1),
(10302, 103, '编辑菜单',   'sys:menu:edit',      3, 2),
(10303, 103, '删除菜单',   'sys:menu:delete',    3, 3),
(10401, 104, '导出日志',   'sys:oplog:export',   3, 1);

-- ---------- 2 系统日志 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(201, 200, '后台操作日志', 'log:operation:list', 2, '/log/operation', 'log/operation/index', '', 1),
(202, 200, '接口调用日志', 'log:api:list',       2, '/log/api',       'log/api/index',       '', 2);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(20101, 201, '导出操作日志', 'log:operation:export', 3, 1),
(20201, 202, '导出接口日志', 'log:api:export',       3, 1);

-- ---------- 3 系统配置 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(301, 300, '全局参数',     'config:global:list',  2, '/config/global',  'config/global/index',  '', 1),
(302, 300, '站点管理',     'config:site:list',    2, '/config/site',    'config/site/index',    '', 2),
(303, 300, '存储配置',     'config:storage:list', 2, '/config/storage', 'config/storage/index', '', 3),
(304, 300, '支付配置',     'config:pay:list',     2, '/config/pay',     'config/pay/index',     '', 4),
(305, 300, '短信配置',     'config:sms:list',     2, '/config/sms',     'config/sms/index',     '', 5),
(306, 300, '地图配置',     'config:map:list',     2, '/config/map',     'config/map/index',     '', 6),
(307, 300, '客户端密钥',   'config:client:list',  2, '/config/client',  'config/client/index',  '', 7),
(308, 300, '接口权限模板', 'config:permtpl:list', 2, '/config/permtpl', 'config/permtpl/index', '', 8);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(30101, 301, '编辑参数',   'config:global:edit',      3, 1),
(30102, 301, '恢复默认',   'config:global:reset',     3, 2),
(30201, 302, '新增站点',   'config:site:add',         3, 1),
(30202, 302, '编辑站点',   'config:site:edit',        3, 2),
(30203, 302, '删除站点',   'config:site:delete',      3, 3),
(30204, 302, '启用停用',   'config:site:status',      3, 4),
(30301, 303, '新增存储',   'config:storage:add',      3, 1),
(30302, 303, '编辑存储',   'config:storage:edit',     3, 2),
(30303, 303, '删除存储',   'config:storage:delete',   3, 3),
(30304, 303, '启用停用',   'config:storage:status',   3, 4),
(30401, 304, '新增渠道',   'config:pay:add',          3, 1),
(30402, 304, '编辑渠道',   'config:pay:edit',         3, 2),
(30403, 304, '删除渠道',   'config:pay:delete',       3, 3),
(30404, 304, '启用停用',   'config:pay:status',       3, 4),
(30501, 305, '新增渠道',   'config:sms:add',          3, 1),
(30502, 305, '编辑渠道',   'config:sms:edit',         3, 2),
(30503, 305, '删除渠道',   'config:sms:delete',       3, 3),
(30504, 305, '模板管理',   'config:sms:template',     3, 4),
(30601, 306, '编辑配置',   'config:map:edit',         3, 1),
(30701, 307, '新增客户端', 'config:client:add',       3, 1),
(30702, 307, '编辑客户端', 'config:client:edit',      3, 2),
(30703, 307, '删除客户端', 'config:client:delete',    3, 3),
(30704, 307, '启用禁用',   'config:client:status',    3, 4),
(30705, 307, '重置密钥',   'config:client:reset-secret', 3, 5),
(30801, 308, '新增模板',   'config:permtpl:add',      3, 1),
(30802, 308, '编辑模板',   'config:permtpl:edit',     3, 2),
(30803, 308, '删除模板',   'config:permtpl:delete',   3, 3);

-- ---------- 4 商户管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(401, 400, '商户列表', 'merchant:list:list',    2, '/merchant/list',    'merchant/list/index',    '', 1),
(402, 400, '商户账户', 'merchant:account:list', 2, '/merchant/account', 'merchant/account/index', '', 2),
(403, 400, '商户权限', 'merchant:perm:list',    2, '/merchant/perm',    'merchant/perm/index',    '', 3),
(404, 400, '商户统计', 'merchant:stats:list',   2, '/merchant/stats',   'merchant/stats/index',   '', 4);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(40101, 401, '新增商户', 'merchant:list:add',    3, 1),
(40102, 401, '编辑商户', 'merchant:list:edit',   3, 2),
(40103, 401, '入驻审核', 'merchant:list:audit',  3, 3),
(40104, 401, '冻结解冻', 'merchant:list:status', 3, 4),
(40105, 401, '删除商户', 'merchant:list:delete', 3, 5),
(40201, 402, '编辑账户', 'merchant:account:edit',3, 1),
(40301, 403, '配置权限', 'merchant:perm:edit',   3, 1),
(40401, 404, '导出统计', 'merchant:stats:export',3, 1);

-- ---------- 5 供应商管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(501, 500, '供应商列表', 'supplier:list:list',   2, '/supplier/list',   'supplier/list/index',   '', 1),
(502, 500, '供货商品',   'supplier:goods:list',  2, '/supplier/goods',  'supplier/goods/index',  '', 2),
(503, 500, '对账结算',   'supplier:settle:list', 2, '/supplier/settle', 'supplier/settle/index', '', 3),
(504, 500, '供应商报表', 'supplier:report:list', 2, '/supplier/report', 'supplier/report/index', '', 4);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(50101, 501, '新增供应商', 'supplier:list:add',      3, 1),
(50102, 501, '编辑供应商', 'supplier:list:edit',     3, 2),
(50103, 501, '启用停用',   'supplier:list:status',   3, 3),
(50104, 501, '删除供应商', 'supplier:list:delete',   3, 4),
(50301, 503, '确认对账',   'supplier:settle:confirm',3, 1),
(50302, 503, '标记打款',   'supplier:settle:pay',    3, 2),
(50401, 504, '导出报表',   'supplier:report:export', 3, 1);

-- ---------- 6 C端用户管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(601, 600, '用户列表',     'user:list:list',     2, '/user/list',     'user/list/index',     '', 1),
(602, 600, '会员等级',     'user:level:list',    2, '/user/level',    'user/level/index',    '', 2),
(603, 600, '反馈投诉',     'user:feedback:list', 2, '/user/feedback', 'user/feedback/index', '', 3),
(604, 600, '用户操作日志', 'user:log:list',      2, '/user/log',      'user/log/index',      '', 4);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(60101, 601, '冻结解冻', 'user:list:status',         3, 1),
(60102, 601, '余额调整', 'user:list:adjust-balance', 3, 2),
(60103, 601, '积分调整', 'user:list:adjust-points',  3, 3),
(60201, 602, '新增等级', 'user:level:add',           3, 1),
(60202, 602, '编辑等级', 'user:level:edit',          3, 2),
(60203, 602, '删除等级', 'user:level:delete',        3, 3),
(60301, 603, '处理反馈', 'user:feedback:handle',     3, 1);

-- ---------- 7 商品管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(701, 700, '酒店管理',     'goods:hotel:list',    2, '/goods/hotel',    'goods/hotel/index',    '', 1),
(702, 700, '门票管理',     'goods:ticket:list',   2, '/goods/ticket',   'goods/ticket/index',   '', 2),
(703, 700, '商品分类',     'goods:category:list', 2, '/goods/category', 'goods/category/index', '', 3),
(704, 700, '库存管控',     'goods:stock:list',    2, '/goods/stock',    'goods/stock/index',    '', 4),
(705, 700, '上下架审核',   'goods:audit:list',    2, '/goods/audit',    'goods/audit/index',    '', 5);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(70101, 701, '新增酒店', 'goods:hotel:add',      3, 1),
(70102, 701, '编辑酒店', 'goods:hotel:edit',     3, 2),
(70103, 701, '删除酒店', 'goods:hotel:delete',   3, 3),
(70104, 701, '房型管理', 'goods:hotel:room',     3, 4),
(70201, 702, '新增门票', 'goods:ticket:add',     3, 1),
(70202, 702, '编辑门票', 'goods:ticket:edit',    3, 2),
(70203, 702, '删除门票', 'goods:ticket:delete',  3, 3),
(70204, 702, '票种管理', 'goods:ticket:type',    3, 4),
(70301, 703, '新增分类', 'goods:category:add',   3, 1),
(70302, 703, '编辑分类', 'goods:category:edit',  3, 2),
(70303, 703, '删除分类', 'goods:category:delete',3, 3),
(70401, 704, '调整库存', 'goods:stock:edit',     3, 1),
(70402, 704, '关房停售', 'goods:stock:close',    3, 2),
(70501, 705, '审核商品', 'goods:audit:audit',    3, 1),
(70502, 705, '强制下架', 'goods:audit:off',      3, 2);

-- ---------- 8 订单管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(801, 800, '全部订单', 'order:all:list',    2, '/order/all',    'order/all/index',    '', 1),
(802, 800, '酒店订单', 'order:hotel:list',  2, '/order/hotel',  'order/hotel/index',  '', 2),
(803, 800, '门票订单', 'order:ticket:list', 2, '/order/ticket', 'order/ticket/index', '', 3),
(804, 800, '退款审核', 'order:refund:list', 2, '/order/refund', 'order/refund/index', '', 4),
(805, 800, '核销记录', 'order:verify:list', 2, '/order/verify', 'order/verify/index', '', 5),
(806, 800, '导出对账', 'order:export:list', 2, '/order/export', 'order/export/index', '', 6);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(80101, 801, '订单详情', 'order:all:detail',   3, 1),
(80102, 801, '取消订单', 'order:all:cancel',   3, 2),
(80103, 801, '导出订单', 'order:all:export',   3, 3),
(80401, 804, '退款审核', 'order:refund:audit', 3, 1),
(80501, 805, '撤销核销', 'order:verify:revoke',3, 1),
(80601, 806, '导出对账单', 'order:export:export', 3, 1);

-- ---------- 9 财务管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(901, 900, '资金总览',   'finance:overview:list', 2, '/finance/overview', 'finance/overview/index', '', 1),
(902, 900, '商户结算',   'finance:msettle:list',  2, '/finance/msettle',  'finance/msettle/index',  '', 2),
(903, 900, '供应商结算', 'finance:ssettle:list',  2, '/finance/ssettle',  'finance/ssettle/index',  '', 3),
(904, 900, '资金流水',   'finance:flow:list',     2, '/finance/flow',     'finance/flow/index',     '', 4),
(905, 900, '税费配置',   'finance:tax:list',      2, '/finance/tax',      'finance/tax/index',      '', 5);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(90201, 902, '确认结算', 'finance:msettle:confirm', 3, 1),
(90202, 902, '标记打款', 'finance:msettle:pay',     3, 2),
(90301, 903, '确认结算', 'finance:ssettle:confirm', 3, 1),
(90302, 903, '标记打款', 'finance:ssettle:pay',     3, 2),
(90401, 904, '手动调账', 'finance:flow:adjust',     3, 1),
(90402, 904, '导出流水', 'finance:flow:export',     3, 2),
(90501, 905, '新增税费', 'finance:tax:add',         3, 1),
(90502, 905, '编辑税费', 'finance:tax:edit',        3, 2),
(90503, 905, '删除税费', 'finance:tax:delete',      3, 3);

-- ---------- 10 营销活动 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(1001, 1000, '优惠券',   'marketing:coupon:list',   2, '/marketing/coupon',   'marketing/coupon/index',   '', 1),
(1002, 1000, '限时活动', 'marketing:activity:list', 2, '/marketing/activity', 'marketing/activity/index', '', 2),
(1003, 1000, '首页推荐', 'marketing:banner:list',   2, '/marketing/banner',   'marketing/banner/index',   '', 3),
(1004, 1000, '积分活动', 'marketing:points:list',   2, '/marketing/points',   'marketing/points/index',   '', 4);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(100101, 1001, '新增优惠券', 'marketing:coupon:add',     3, 1),
(100102, 1001, '编辑优惠券', 'marketing:coupon:edit',    3, 2),
(100103, 1001, '停止发放',   'marketing:coupon:stop',    3, 3),
(100104, 1001, '删除优惠券', 'marketing:coupon:delete',  3, 4),
(100201, 1002, '新增活动',   'marketing:activity:add',   3, 1),
(100202, 1002, '编辑活动',   'marketing:activity:edit',  3, 2),
(100203, 1002, '暂停活动',   'marketing:activity:pause', 3, 3),
(100204, 1002, '删除活动',   'marketing:activity:delete',3, 4),
(100301, 1003, '新增推荐',   'marketing:banner:add',     3, 1),
(100302, 1003, '编辑推荐',   'marketing:banner:edit',    3, 2),
(100303, 1003, '删除推荐',   'marketing:banner:delete',  3, 3),
(100304, 1003, '上架下架',   'marketing:banner:status',  3, 4),
(100401, 1004, '编辑积分规则','marketing:points:edit',   3, 1);

-- ---------- 11 数据统计中心 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(1101, 1100, '数据大屏', 'stats:dashboard:list', 2, '/stats/dashboard', 'stats/dashboard/index', '', 1),
(1102, 1100, '站点统计', 'stats:site:list',      2, '/stats/site',      'stats/site/index',      '', 2),
(1103, 1100, '商户统计', 'stats:merchant:list',  2, '/stats/merchant',  'stats/merchant/index',  '', 3),
(1104, 1100, '商品统计', 'stats:goods:list',     2, '/stats/goods',     'stats/goods/index',     '', 4),
(1105, 1100, '财务报表', 'stats:finance:list',   2, '/stats/finance',   'stats/finance/index',   '', 5);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(110201, 1102, '导出统计', 'stats:site:export',     3, 1),
(110301, 1103, '导出统计', 'stats:merchant:export', 3, 1),
(110401, 1104, '导出统计', 'stats:goods:export',    3, 1),
(110501, 1105, '导出报表', 'stats:finance:export',  3, 1);

-- ---------- 12 核销管理 ----------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`) VALUES
(1201, 1200, '核销设备', 'verify:device:list', 2, '/verify/device', 'verify/device/index', '', 1),
(1202, 1200, '核销规则', 'verify:rule:list',   2, '/verify/rule',   'verify/rule/index',   '', 2),
(1203, 1200, '核销日志', 'verify:log:list',    2, '/verify/log',    'verify/log/index',    '', 3);
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `perm_key`, `menu_type`, `sort`) VALUES
(120101, 1201, '新增设备', 'verify:device:add',    3, 1),
(120102, 1201, '编辑设备', 'verify:device:edit',   3, 2),
(120103, 1201, '删除设备', 'verify:device:delete', 3, 3),
(120104, 1201, '启用禁用', 'verify:device:status', 3, 4),
(120201, 1202, '新增规则', 'verify:rule:add',      3, 1),
(120202, 1202, '编辑规则', 'verify:rule:edit',     3, 2),
(120203, 1202, '删除规则', 'verify:rule:delete',   3, 3),
(120301, 1203, '导出日志', 'verify:log:export',    3, 1);

-- ---------- 超管角色授权全部菜单 ----------
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `sys_menu` WHERE `deleted_at` IS NULL;
