-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 种子数据 02:菜单按钮权限树 —— Super Admin Portal 新 IA(15 模块 + 遗留分组)
-- 设计源:docs/redesign/super-admin-portal/(modules 01-13);gap-analysis / migration-plan
-- 库:mtrip_system
--
-- ID 规则:一级目录/顶级页=N00;二级页面=父+序号;按钮=页面ID*100+序号
-- menu_type:1一级目录 2页面 3按钮
-- 多语言:i18n_key 命中词条→翻译;留空→回退 menu_name_en(英)/menu_name(中),新页无需加词条
-- component:必须与 admin-web/src/views/{component}.vue 一致;缺失自动回退 views/wip(前端渐进补齐)
-- 多个页面可共享同一 component(dynamic.ts 按 route name 包装,KeepAlive 可区分)
--
-- perm_key:
--   【复用】现有 backend #[Permission] 已用的键(merchant/order/finance/marketing/stats/user/
--            sys/config/supplier/goods/verify/log/…),原样保留,现有授权不受影响。
--   【新增】新模块键(affiliate/platform/help/merchant:verify/inventory:alert/config:feature/
--            sys:session/…),待对应后端落地时三处对齐(注解↔本表↔前端 v-perm)。
--   注:平台超管(is_super,site_id=0)在 AdminContext::hasAnyPermission 中直接放行(bypass),
--        故按钮增减不影响超管;非超管角色在菜单重构后需在后台重新分配权限(sys_role_menu)。
--   本表按钮为各模块关键项,后续随页面落地按需扩充。
--
-- 重构安全:本文件是菜单树的唯一事实源,采用「先清后建」使 db-apply 能真正重排
--   (INSERT IGNORE 无法覆盖旧行);fresh init(down -v)时两表为空,DELETE 为 no-op。
-- ============================================================
USE `mtrip_system`;

-- 先清后建(菜单重构):子表先删,父表后删,再整体重建 + 重新授权超管
DELETE FROM `sys_role_menu`;
DELETE FROM `sys_menu`;

-- ================= 一级目录 + 顶级页(parent_id=0)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(100,0,'仪表盘','Dashboard','menu.dashboard','dashboard:view',2,'/dashboard','dashboard/index','DashboardOutlined',1),
(200,0,'商户验证','Merchant Verification','','merchant:verify',1,'/merchant-verify','','SafetyCertificateOutlined',2),
(300,0,'商户管理','Merchant Management','menu.merchant','merchant',1,'/merchant','','ShopOutlined',3),
(400,0,'业务运营','Business Operations','','biz',1,'/biz','','ProfileOutlined',4),
(500,0,'促销与活动','Campaign & Promotion','menu.marketing','marketing',1,'/marketing','','GiftOutlined',5),
(600,0,'带货达人','Affiliate & Influencer','','affiliate',1,'/affiliate','','TeamOutlined',6),
(700,0,'平台规则与合规','Platform Rules & Compliance','','compliance',1,'/compliance','','AuditOutlined',7),
(800,0,'用户与角色','User & Role Management','menu.system','sys',1,'/system','','SettingOutlined',8),
(900,0,'报表与分析','Reports & Analytics','menu.stats','stats',1,'/stats','','BarChartOutlined',9),
(1000,0,'终端用户管理','End User Management','menu.user','user',1,'/user','','UserOutlined',10),
(1100,0,'帮助中心','Help Center','','helpcenter',1,'/helpcenter','','QuestionCircleOutlined',11),
(1200,0,'内容管理','Content Management','','content',1,'/content','','LayoutOutlined',12),
(1300,0,'平台配置','Platform Configuration','menu.config','config',1,'/config','','ToolOutlined',13),
-- ---- 遗留模块(保留为独立分组)----
(1400,0,'供应商管理','Supplier','menu.supplier','supplier',1,'/supplier','','ApartmentOutlined',14),
(1500,0,'商品(门票/分类)','Goods (legacy)','menu.goods','goods',1,'/goods','','GoldOutlined',15),
(1600,0,'核销管理','Verification','menu.verify','verify',1,'/verify','','ScanOutlined',16),
(1700,0,'Trip 管理','Trips','','trip',1,'/trip','','CompassOutlined',17),
(1800,0,'系统日志','Logs','menu.log','log',1,'/log','','FileSearchOutlined',18);

-- ================= 200 商户验证(5 菜单:Onboarding + 4 验证状态页,对齐 stir-long 原型)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(201,200,'待核实','Pending Verification','','merchant:list:audit',2,'/merchant-verify/pending','merchant/verify/index','',2),
(202,200,'得到正式认可','Approved','','merchant:list:audit',2,'/merchant-verify/approved','merchant/verify/index','',4),
(203,200,'已拒绝','Rejected','','merchant:list:audit',2,'/merchant-verify/rejected','merchant/verify/index','',5),
(204,200,'重新提交','Resubmission','','merchant:list:audit',2,'/merchant-verify/resubmission','merchant/verify/index','',3),
(205,200,'入驻申请','Onboarding','','merchant:onboarding:list',2,'/merchant-verify/onboarding','merchant/onboarding/index','',1);
-- 排序对齐原型侧边栏:Onboarding → Pending Verification → Resubmission → Approved → Rejected
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(20101,201,'通过审核','Approve','merchant:verify:approve',3,1),
(20102,201,'驳回申请','Reject','merchant:verify:reject',3,2),
(20103,201,'要求重交','Request Resubmission','merchant:verify:resubmit',3,3),
(20104,201,'核验文档','Verify Document','merchant:verify:doc',3,4),
(20105,201,'重生成访问码','Regenerate Access Code','merchant:verify:regencode',3,5),
(20106,201,'重发访问码','Resend Access Code','merchant:verify:resend',3,6),
(20501,205,'录入线索','Create Lead','merchant:onboarding:create',3,1),
(20502,205,'更新阶段','Update Stage','merchant:onboarding:update',3,2),
(20503,205,'指派运营','Assign Ops','merchant:onboarding:assign',3,3),
(20504,205,'发送KYC','Send KYC','merchant:onboarding:kyc',3,4),
(20505,205,'入驻通过','Approve Onboarding','merchant:onboarding:approve',3,5),
(20506,205,'入驻驳回','Reject Onboarding','merchant:onboarding:reject',3,6);

-- ================= 300 商户管理 =================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(301,300,'所有商户','All Merchants','menu.merchantList','merchant:list:list',2,'/merchant/list','merchant/list/index','',1),
(302,300,'商户文档','Merchant Documents','','merchant:doc:list',2,'/merchant/documents','merchant/documents/index','',2),
(303,300,'已暂停','Suspended','','merchant:list:list',2,'/merchant/suspended','merchant/suspended/index','',3),
(304,300,'黑名单','Blacklisted','','merchant:list:list',2,'/merchant/blacklisted','merchant/blacklisted/index','',4),
(305,300,'商户活动','Merchant Activities','','merchant:activity:list',2,'/merchant/activities','merchant/activities/index','',5),
(306,300,'商户账户','Merchant Accounts','menu.merchantAccount','merchant:account:list',2,'/merchant/account','merchant/account/index','',6),
(307,300,'集团管理','Groups','menu.merchantGroup','merchant:group:list',2,'/merchant/group','merchant/group/index','',7),
(308,300,'门店管理','Stores','menu.merchantStore','merchant:store:list',2,'/merchant/store','merchant/store/index','',8),
(309,300,'商户统计','Merchant Stats','menu.merchantStats','merchant:stats:list',2,'/merchant/stats','merchant/stats/index','',9),
(310,300,'市场排名','Marketplace Ranking','','merchant:ranking:list',2,'/merchant/ranking','merchant/ranking/index','',10);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(30101,301,'新增商户','Add','merchant:list:add',3,1),
(30102,301,'编辑商户','Edit','merchant:list:edit',3,2),
(30103,301,'冻结解冻','Freeze/Unfreeze','merchant:list:status',3,3),
(30104,301,'商户代入','Impersonate','merchant:list:impersonate',3,4),
(30105,301,'删除商户','Delete','merchant:list:delete',3,5),
(30106,301,'重置2FA','Reset 2FA','merchant:list:2fa',3,6),
(30107,301,'发送通知','Notify','merchant:list:notify',3,7),
(30108,301,'暂停商户','Suspend merchant','merchant:status:suspend',3,8),
(30109,301,'恢复商户','Activate merchant','merchant:status:activate',3,9),
(30110,301,'拉黑商户','Blacklist merchant','merchant:status:blacklist',3,10),
(30111,301,'解除黑名单','Unblacklist merchant','merchant:status:unblacklist',3,11),
(30112,301,'黑名单后重新激活','Reactivate after blacklist','merchant:status:reactivate',3,12),
(30113,301,'商户状态历史','Merchant status history','merchant:status:history',3,13),
(30114,301,'关联酒店物业','Link hotel property','merchant:property:bind',3,14),
(30201,302,'替换证件','Replace Document','merchant:document:replace',3,1),
(30202,302,'审核证件','Review Document','merchant:document:verify',3,2),
(30203,302,'下载证件','Download Document','merchant:document:download',3,3),
(30501,305,'导出活动','Export Activities','merchant:activity:export',3,1),
(30601,306,'编辑账户','Edit Account','merchant:account:edit',3,1),
(30701,307,'新增集团','Add Group','merchant:group:add',3,1),
(30702,307,'编辑集团','Edit Group','merchant:group:edit',3,2),
(30801,308,'新增门店','Add Store','merchant:store:add',3,1),
(30802,308,'编辑门店','Edit Store','merchant:store:edit',3,2),
(31001,310,'保存排序','Save Order','merchant:ranking:save',3,1),
(31002,310,'发布','Publish','merchant:ranking:publish',3,2),
(31003,310,'新增目的地','Add Destination','merchant:ranking:add',3,3);

-- ================= 400 业务运营(Bookings + Inventory 扁平)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(401,400,'全部预订','All Bookings','menu.orderAll','order:all:list',2,'/order/all','order/all/index','',1),
(402,400,'退款请求','Refund Requests','menu.orderRefund','order:refund:list',2,'/order/refund','order/refund/index','',2),
(403,400,'结算与对账','Settlement & Reconciliation','menu.financeMSettle','finance:msettle:list',2,'/finance/msettle','finance/msettle/index','',3),
(404,400,'预订历史','Booking History','','order:all:list',2,'/order/history','order/all/index','',4),
(405,400,'库存总览','Inventory Overview','','goods:stock:list',2,'/inventory/overview','inventory/overview/index','',5),
(406,400,'房型可用量','Room Availability','','goods:stock:list',2,'/inventory/availability','inventory/calendar/index','',6),
(407,400,'库存明细','Room Inventory Detail','','goods:stock:list',2,'/inventory/detail','inventory/calendar/index','',7),
(408,400,'库存时间线','Inventory Timeline','','goods:stock:list',2,'/inventory/timeline','inventory/alerts/index','',8),
(409,400,'可用量日历','Availability Calendar','','goods:stock:list',2,'/inventory/calendar','inventory/calendar/index','',9),
(410,400,'库存告警','Inventory Alerts','','inventory:alert:list',2,'/inventory/alerts','inventory/alerts/index','',10),
(411,400,'库存报表','Inventory Reports','','goods:stock:list',2,'/inventory/reports','inventory/overview/index','',11);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(40101,401,'订单详情','Detail','order:all:detail',3,1),
(40102,401,'取消订单','Cancel','order:all:cancel',3,2),
(40103,401,'导出订单','Export','order:all:export',3,3),
(40201,402,'退款审核','Audit Refund','order:refund:audit',3,1),
(40301,403,'确认结算','Confirm','finance:msettle:confirm',3,1),
(40302,403,'标记打款','Mark Paid','finance:msettle:pay',3,2),
(40501,405,'调整库存','Adjust Stock','goods:stock:edit',3,1),
(40502,405,'关房停售','Close Sale','goods:stock:close',3,2),
(41001,410,'处理告警','Acknowledge/Resolve','inventory:alert:handle',3,1);

-- ================= 500 促销与活动 =================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(501,500,'活动','Campaigns','','marketing:campaign:list',2,'/marketing/campaign','cops/campaign/index','',1),
(502,500,'商户促销','Promotions','','marketing:activity:list',2,'/marketing/promotions','cops/campaign/index','',2),
(503,500,'代金券','Vouchers','','marketing:voucher:list',2,'/marketing/vouchers','marketing/vouchers/index','',3),
(504,500,'促销码','Promotion Codes','','marketing:promocode:list',2,'/marketing/codes','marketing/codes/index','',4),
(505,500,'新客奖励','Welcome Rewards','','marketing:welcome:list',2,'/marketing/welcome','marketing/welcome/index','',5),
(506,500,'活动分析','Campaign Analytics','','marketing:campaign:list',2,'/marketing/analytics','stats/dashboard/index','',6),
(507,500,'优惠券','Coupons','menu.marketingCoupon','marketing:coupon:list',2,'/marketing/coupon','marketing/coupon/index','',7),
(508,500,'长住梯度','Long-Stay Tiers','','marketing:longstay:list',2,'/cops/longstay','cops/longstay/index','',8);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(50101,501,'保存活动','Save','marketing:campaign:save',3,1),
(50102,501,'删除活动','Delete','marketing:campaign:delete',3,2),
(50301,503,'保存代金券','Save Voucher','marketing:voucher:save',3,1),
(50401,504,'保存促销码','Save Code','marketing:promocode:save',3,1),
(50501,505,'保存新客奖励','Save Welcome','marketing:welcome:save',3,1),
(50701,507,'新增优惠券','Add','marketing:coupon:add',3,1),
(50702,507,'编辑优惠券','Edit','marketing:coupon:edit',3,2),
(50703,507,'停止发放','Stop','marketing:coupon:stop',3,3),
(50801,508,'保存梯度','Save Tier','marketing:longstay:save',3,1);

-- ================= 600 带货达人(全新,perm_key 待后端落地对齐)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(601,600,'达人申请','Applications','','affiliate:application:list',2,'/affiliate/applications','affiliate/applications/index','',1),
(602,600,'合作方名录','Partner Directory','','affiliate:partner:list',2,'/affiliate/partners','affiliate/partners/index','',2),
(603,600,'联盟计划','Affiliate Program','','affiliate:program:list',2,'/affiliate/program','affiliate/program/index','',3),
(604,600,'奖励钱包','Reward Wallet','','affiliate:wallet:list',2,'/affiliate/wallet','affiliate/wallet/index','',4),
(605,600,'反欺诈合规','Fraud & Compliance','','affiliate:fraud:list',2,'/affiliate/fraud','affiliate/fraud/index','',5),
(606,600,'联盟折扣码','Affiliate Codes','','affiliate:code:list',2,'/affiliate/codes','affiliate/codes/index','',6),
(607,600,'推荐返利活动','Referral Campaigns','','affiliate:referral:list',2,'/affiliate/referral','affiliate/referral/index','',7);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(60101,601,'通过申请','Approve','affiliate:application:approve',3,1),
(60102,601,'驳回申请','Reject','affiliate:application:reject',3,2),
(60301,603,'保存计划','Save Program','affiliate:program:save',3,1),
(60401,604,'钱包调整','Adjust','affiliate:wallet:adjust',3,1),
(60402,604,'提现打款','Pay Withdrawal','affiliate:withdraw:pay',3,2),
(60501,605,'处置案件','Handle Case','affiliate:fraud:handle',3,1),
(60601,606,'保存码','Save Code','affiliate:code:save',3,1),
(60602,606,'删除码','Delete Code','affiliate:code:delete',3,2),
(60701,607,'保存推荐活动','Save Referral','affiliate:referral:save',3,1);

-- ================= 700 平台规则与合规(全新)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(701,700,'平台规则','Platform Rules','','platform:rule:list',2,'/compliance/rules','compliance/rules/index','',1),
(702,700,'商户违规','Merchant Violations','','platform:violation:list',2,'/compliance/violations','compliance/violations/index','',2),
(703,700,'警告历史','Warning History','','platform:warning:list',2,'/compliance/warnings','compliance/warnings/index','',3),
(704,700,'合规历史','Compliance History','','platform:compliance:list',2,'/compliance/history','compliance/history/index','',4);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(70101,701,'保存规则','Save','platform:rule:save',3,1),
(70102,701,'发布下线','Publish/Unpublish','platform:rule:publish',3,2),
(70201,702,'处置违规','Handle','platform:violation:handle',3,1),
(70202,702,'登记违规','Record violation','platform:violation:record',3,2),
(70301,703,'签发警告','Issue','platform:warning:issue',3,1),
(70302,703,'吊销警告','Revoke','platform:warning:revoke',3,2);

-- ================= 800 用户与角色(= 现系统管理,复用 sys:* 权限)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(801,800,'管理员','Users','menu.systemAdmin','sys:admin:list',2,'/system/admin','system/admin/index','',1),
(802,800,'角色','Roles','menu.systemRole','sys:role:list',2,'/system/role','system/role/index','',2),
(803,800,'权限矩阵','Permission Matrix','menu.systemMenu','sys:menu:list',2,'/system/menu','system/menu/index','',3),
(804,800,'活跃会话','Active Sessions','','sys:session:list',2,'/system/sessions','system/admin/index','',4),
(805,800,'回收站','Recycle Bin','menu.systemRecycle','sys:recycle:list',2,'/system/recycle','system/recycle/index','',5);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(80101,801,'新增管理员','Add','sys:admin:add',3,1),
(80102,801,'编辑管理员','Edit','sys:admin:edit',3,2),
(80103,801,'删除管理员','Delete','sys:admin:delete',3,3),
(80104,801,'重置密码','Reset Password','sys:admin:reset-pwd',3,4),
(80105,801,'启用禁用','Enable/Disable','sys:admin:status',3,5),
(80201,802,'新增角色','Add','sys:role:add',3,1),
(80202,802,'编辑角色','Edit','sys:role:edit',3,2),
(80203,802,'删除角色','Delete','sys:role:delete',3,3),
(80204,802,'分配权限','Assign Permissions','sys:role:perm',3,4),
(80301,803,'新增菜单','Add Menu','sys:menu:add',3,1),
(80302,803,'编辑菜单','Edit Menu','sys:menu:edit',3,2),
(80303,803,'删除菜单','Delete Menu','sys:menu:delete',3,3),
(80401,804,'强制登出','Force Logout','sys:session:kick',3,1),
(80501,805,'恢复数据','Restore','sys:recycle:restore',3,1),
(80502,805,'彻底删除','Purge','sys:recycle:purge',3,2);

-- ================= 900 报表与分析(= 现统计,复用 stats:* 权限)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(901,900,'高管仪表盘','Executive Dashboard','menu.statsDashboard','stats:dashboard:list',2,'/stats/dashboard','stats/dashboard/index','',1),
(902,900,'交易报表','Transaction Reports','menu.statsFinance','stats:finance:list',2,'/stats/finance','stats/finance/index','',2),
(903,900,'业务报表','Business Reports','','stats:site:list',2,'/stats/business','stats/business/index','',3),
(904,900,'自定义报表','Custom Reports','','stats:custom:list',2,'/stats/custom','stats/custom/index','',4),
(905,900,'商户统计','Merchant Stats','menu.statsMerchant','stats:merchant:list',2,'/stats/merchant','stats/merchant/index','',5),
(906,900,'商品统计','Goods Stats','menu.statsGoods','stats:goods:list',2,'/stats/goods','stats/goods/index','',6),
(907,900,'站点统计','Site Stats','menu.statsSite','stats:site:list',2,'/stats/site','stats/site/index','',7);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(90201,902,'导出报表','Export','stats:finance:export',3,1),
(90301,903,'导出报表','Export','stats:site:export',3,1),
(90401,904,'导出报表','Export','stats:custom:export',3,1),
(90501,905,'导出统计','Export','stats:merchant:export',3,1),
(90601,906,'导出统计','Export','stats:goods:export',3,1);

-- ================= 1000 终端用户管理(= 现 C端用户 + cops chat/appeal/fraud)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1001,1000,'用户目录','User Directory','menu.userList','user:list:list',2,'/user/list','user/list/index','',1),
(1002,1000,'对话中心','Conversation Center','','user:chat:list',2,'/cops/chat','cops/chat/index','',2),
(1003,1000,'用户画像','User Profile','','user:list:list',2,'/user/profile','user/profile/index','',3),
(1004,1000,'预订历史','Booking History','','user:list:list',2,'/user/bookings','order/all/index','',4),
(1005,1000,'用户活动','User Activities','','user:log:list',2,'/user/log','user/log/index','',5),
(1006,1000,'用户交易','User Transactions','','user:list:list',2,'/user/transactions','finance/flow/index','',6),
(1007,1000,'奖励与券','Rewards & Coupons','','user:list:list',2,'/user/rewards','marketing/coupon/index','',7),
(1008,1000,'用户支持','User Support','menu.userFeedback','user:feedback:list',2,'/user/feedback','user/feedback/index','',8),
(1009,1000,'访客会话','Guest Conversations','','user:chat:list',2,'/user/conversations','cops/chat/index','',9),
(1010,1000,'已暂停用户','Suspended Users','','user:list:status',2,'/user/suspended','user/suspended/index','',10),
(1011,1000,'黑名单','Blacklist','','user:list:list',2,'/user/blacklist','user/blacklist/index','',11),
(1012,1000,'申诉处理','Appeals','','user:appeal:list',2,'/cops/appeal','cops/appeal/index','',12),
(1013,1000,'会员等级','Member Levels','','user:level:list',2,'/user/level','user/level/index','',13),
(1014,1000,'风控看板','Risk Control','','user:fraud:list',2,'/cops/fraud','cops/fraud/index','',14);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(100101,1001,'冻结解冻','Freeze/Unfreeze','user:list:status',3,1),
(100102,1001,'余额调整','Adjust Balance','user:list:adjust-balance',3,2),
(100103,1001,'积分调整','Adjust Points','user:list:adjust-points',3,3),
(100201,1002,'回复消息','Reply','user:chat:reply',3,1),
(100801,1008,'处理反馈','Handle','user:feedback:handle',3,1),
(101301,1013,'新增等级','Add Level','user:level:add',3,1),
(101302,1013,'编辑等级','Edit Level','user:level:edit',3,2),
(101201,1012,'处理申诉','Handle Appeal','user:appeal:handle',3,1);

-- ================= 1100 帮助中心(全新)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1101,1100,'FAQ 文章','FAQ Articles','','help:article:list',2,'/helpcenter/articles','helpcenter/articles/index','',1),
(1102,1100,'分类','Categories','','help:category:list',2,'/helpcenter/categories','helpcenter/categories/index','',2),
(1103,1100,'公告','Announcements','','help:announcement:list',2,'/helpcenter/announcements','helpcenter/announcements/index','',3),
(1104,1100,'搜索分析','Search Analytics','','help:analytics:list',2,'/helpcenter/analytics','helpcenter/analytics/index','',4);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(110101,1101,'保存文章','Save','help:article:save',3,1),
(110102,1101,'发布归档','Publish/Archive','help:article:publish',3,2),
(110201,1102,'保存分类','Save','help:category:save',3,1),
(110301,1103,'发布公告','Publish','help:announcement:publish',3,1);

-- ================= 1200 内容管理(Banner 复用 marketing:banner;Theme 复用 config:theme)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1201,1200,'横幅管理','Banner Management','','marketing:banner:list',2,'/marketing/banner','marketing/banner/index','',1),
(1202,1200,'主题管理','Theme Management','','config:theme:list',2,'/cops/theme','cops/theme/index','',2);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(120101,1201,'新增横幅','Add','marketing:banner:add',3,1),
(120102,1201,'编辑横幅','Edit','marketing:banner:edit',3,2),
(120103,1201,'上下架','On/Off','marketing:banner:status',3,3),
(120201,1202,'保存主题','Save','config:theme:save',3,1),
(120202,1202,'删除主题','Delete','config:theme:delete',3,2);

-- ================= 1300 平台配置(= 现系统配置 + 特性开关 + 筛选/税费)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1301,1300,'全局参数','Global Config','menu.configGlobal','config:global:list',2,'/config/global','config/global/index','',1),
(1302,1300,'站点管理','Site Management','menu.configSite','config:site:list',2,'/config/site','config/site/index','',2),
(1303,1300,'存储配置','Storage','menu.configStorage','config:storage:list',2,'/config/storage','config/storage/index','',3),
(1304,1300,'支付配置','Payment','menu.configPay','config:pay:list',2,'/config/pay','config/pay/index','',4),
(1305,1300,'短信配置','SMS','menu.configSms','config:sms:list',2,'/config/sms','config/sms/index','',5),
(1306,1300,'地图配置','Map','menu.configMap','config:map:list',2,'/config/map','config/map/index','',6),
(1307,1300,'客户端密钥','Client','menu.configClient','config:client:list',2,'/config/client','config/client/index','',7),
(1308,1300,'接口权限模板','Permission Templates','menu.configPermTpl','config:permtpl:list',2,'/config/permtpl','config/permtpl/index','',8),
(1309,1300,'特性开关','Feature Toggles','','config:feature:list',2,'/config/features','config/features/index','',9),
(1310,1300,'筛选排序配置','Filter & Sort','','goods:filter:list',2,'/cops/filter','cops/filter/index','',10),
(1311,1300,'税费配置','Tax Config','menu.financeTax','finance:tax:list',2,'/finance/tax','finance/tax/index','',11);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(130101,1301,'编辑参数','Edit','config:global:edit',3,1),
(130201,1302,'新增站点','Add Site','config:site:add',3,1),
(130202,1302,'编辑站点','Edit Site','config:site:edit',3,2),
(130301,1303,'新增存储','Add Storage','config:storage:add',3,1),
(130302,1303,'编辑存储','Edit Storage','config:storage:edit',3,2),
(130303,1303,'启用禁用','Enable/Disable','config:storage:status',3,3),
(130304,1303,'删除存储/文件','Delete Storage/File','config:storage:delete',3,4),
(130305,1303,'上传文件','Upload File','config:storage:upload',3,5),
(130901,1309,'保存开关','Save','config:feature:save',3,1),
(131001,1310,'保存配置','Save','goods:filter:save',3,1);

-- ================= 遗留:1400 供应商 =================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1401,1400,'供应商列表','Suppliers','menu.supplierList','supplier:list:list',2,'/supplier/list','supplier/list/index','',1),
(1402,1400,'供货商品','Supplier Goods','','supplier:goods:list',2,'/supplier/goods','supplier/goods/index','',2),
(1403,1400,'对账结算','Settlement','menu.supplierSettle','supplier:settle:list',2,'/supplier/settle','supplier/settle/index','',3),
(1404,1400,'供应商报表','Reports','','supplier:report:list',2,'/supplier/report','supplier/report/index','',4);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(140101,1401,'新增供应商','Add','supplier:list:add',3,1),
(140102,1401,'编辑供应商','Edit','supplier:list:edit',3,2),
(140301,1403,'确认对账','Confirm','supplier:settle:confirm',3,1),
(140302,1403,'标记打款','Mark Paid','supplier:settle:pay',3,2);

-- ================= 遗留:1500 商品(门票/分类/审核/评价/酒店基础)=================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1501,1500,'酒店管理','Hotels','menu.goodsHotel','goods:hotel:list',2,'/goods/hotel','goods/hotel/index','',1),
(1502,1500,'门票管理','Tickets','menu.goodsTicket','goods:ticket:list',2,'/goods/ticket','goods/ticket/index','',2),
(1503,1500,'商品分类','Categories','menu.goodsCategory','goods:category:list',2,'/goods/category','goods/category/index','',3),
(1504,1500,'库存管控','Stock','menu.goodsStock','goods:stock:list',2,'/goods/stock','goods/stock/index','',4),
(1505,1500,'上下架审核','Listing Audit','menu.goodsAudit','goods:audit:list',2,'/goods/audit','goods/audit/index','',5),
(1506,1500,'评价审核','Reviews','','goods:review:list',2,'/cops/review','cops/review/index','',6);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(150101,1501,'新增酒店','Add','goods:hotel:add',3,1),
(150102,1501,'编辑酒店','Edit','goods:hotel:edit',3,2),
(150201,1502,'新增门票','Add','goods:ticket:add',3,1),
(150501,1505,'审核商品','Audit','goods:audit:audit',3,1),
(150601,1506,'审核评价','Audit Review','goods:review:audit',3,1),
(150602,1506,'回复评价','Reply','goods:review:reply',3,2);

-- ================= 遗留:1600 核销 =================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1601,1600,'核销设备','Devices','','verify:device:list',2,'/verify/device','verify/device/index','',1),
(1602,1600,'核销规则','Rules','','verify:rule:list',2,'/verify/rule','verify/rule/index','',2),
(1603,1600,'核销日志','Logs','menu.verifyLog','verify:log:list',2,'/verify/log','verify/log/index','',3),
(1604,1600,'订单核销记录','Order Verify','menu.orderVerify','order:verify:list',2,'/order/verify','order/verify/index','',4);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(160101,1601,'新增设备','Add','verify:device:add',3,1),
(160201,1602,'新增规则','Add','verify:rule:add',3,1),
(160401,1604,'撤销核销','Revoke','order:verify:revoke',3,1);

-- ================= 遗留:1700 Trip / 结算 / 财务明细 =================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1701,1700,'Trip 管理','Trips','','order:trip:list',2,'/cops/trip','cops/trip/index','',1),
(1702,1700,'结算分账','Settlement Ledger','','finance:entry:list',2,'/cops/entry','cops/entry/index','',2),
(1703,1700,'资金总览','Finance Overview','menu.financeOverview','finance:overview:list',2,'/finance/overview','finance/overview/index','',3),
(1704,1700,'供应商结算','Supplier Settlement','menu.financeSettle','finance:ssettle:list',2,'/finance/ssettle','finance/ssettle/index','',4),
(1705,1700,'资金流水','Fund Flows','menu.financeFlow','finance:flow:list',2,'/finance/flow','finance/flow/index','',5);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(170401,1704,'确认结算','Confirm','finance:ssettle:confirm',3,1),
(170402,1704,'标记打款','Mark Paid','finance:ssettle:pay',3,2),
(170501,1705,'手动调账','Adjust','finance:flow:adjust',3,1);

-- ================= 遗留:1800 日志 =================
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`) VALUES
(1801,1800,'操作日志','Operation Logs','menu.logOperation','log:operation:list',2,'/log/operation','log/operation/index','',1),
(1802,1800,'接口日志','API Logs','menu.logApi','log:api:list',2,'/log/api','log/api/index','',2);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(180101,1801,'导出操作日志','Export','log:operation:export',3,1),
(180201,1802,'导出接口日志','Export','log:api:export',3,1);

-- ================= 超管角色授权全部菜单 =================
-- 注:菜单重构后 perm_key/ID 变化,非超管角色须在后台重新分配权限;超管在 hasAnyPermission 中 bypass。
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `sys_menu` WHERE `deleted_at` IS NULL;
