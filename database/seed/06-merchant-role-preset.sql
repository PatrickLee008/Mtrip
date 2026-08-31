-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 种子数据 06:商户内置角色预设(商户运营人员 / 商户客服)
-- 库:mtrip_business
-- 依赖:必须在 seed/04-merchant-menu.sql 之后执行(菜单行需已存在才能授权)
--
-- 背景:04 号种子的内置角色只按 account_type 各给一个"管理员"(集团/商户/门店),
--       本脚本补齐 account_type=2 商户侧按职能划分的两个预设角色。
--       商户主账号 is_owner=1 登录时直接拥有本 account_type 全部权限,不占角色。
--
-- 幂等:按 (is_builtin=1, role_code) 判重插入,不硬编码自增 ID
--       —— 存量库里 ID 4/5 可能已被商户自建角色占用,硬编码会串号。
-- ============================================================
USE `mtrip_business`;

-- ---------- 角色本体 ----------
INSERT INTO `merchant_role` (`site_id`, `group_id`, `merchant_id`, `account_type`, `role_name`, `role_code`, `is_builtin`, `status`, `remark`)
SELECT 0, 0, 0, 2, '商户运营人员', 'merchant_ops', 1, 1, '平台内置:商品/客房/房价/营销/评价等日常运营,不含组织权限与收益结算'
WHERE NOT EXISTS (SELECT 1 FROM `merchant_role` `r` WHERE `r`.`is_builtin` = 1 AND `r`.`role_code` = 'merchant_ops');

INSERT INTO `merchant_role` (`site_id`, `group_id`, `merchant_id`, `account_type`, `role_name`, `role_code`, `is_builtin`, `status`, `remark`)
SELECT 0, 0, 0, 2, '商户客服', 'merchant_cs', 1, 1, '平台内置:订单核销/评价回复/通知,只读经营数据'
WHERE NOT EXISTS (SELECT 1 FROM `merchant_role` `r` WHERE `r`.`is_builtin` = 1 AND `r`.`role_code` = 'merchant_cs');

-- ---------- 商户运营人员授权 ----------
-- 含:工作台 / 门店(只读)/ 订单核销 / 商品 / 客房 / 房量与价格 / 通知 / 营销 / 评价 / 帮助
-- 不含:200-202 组织与权限、800 收益结算、1300 设置
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT `r`.`id`, `m`.`id`
FROM `merchant_role` `r`
JOIN `merchant_menu` `m`
  ON `m`.`deleted_at` IS NULL AND `m`.`status` = 1 AND FIND_IN_SET(2, `m`.`account_scope`)
 AND `m`.`id` IN (
   100,
   300,
   400, 40001,
   500, 50001, 50002, 50003,
   600, 60001, 60002, 60003, 60004,
   700, 70001, 70002, 70003,
   900, 90001,
   1000, 100001, 100002, 100003, 100004,
   1100, 110001, 110002,
   1200
 )
WHERE `r`.`is_builtin` = 1 AND `r`.`role_code` = 'merchant_ops';

-- ---------- 商户客服授权 ----------
-- 含:工作台 / 订单核销 / 通知 / 评价 / 帮助
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT `r`.`id`, `m`.`id`
FROM `merchant_role` `r`
JOIN `merchant_menu` `m`
  ON `m`.`deleted_at` IS NULL AND `m`.`status` = 1 AND FIND_IN_SET(2, `m`.`account_scope`)
 AND `m`.`id` IN (
   100,
   400, 40001,
   900, 90001,
   1100, 110001, 110002,
   1200
 )
WHERE `r`.`is_builtin` = 1 AND `r`.`role_code` = 'merchant_cs';
