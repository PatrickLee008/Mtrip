-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant PRD v1.0 / Module 8 促销与活动管理]:商户端新增两个页面入口
-- 设计源:Figma `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`(Promotions 页)
--         + 功能需求「参与平台活动」「监控促销与活动表现」
-- 库:mtrip_business;幂等(INSERT IGNORE + 授权 SELECT)
--
-- 说明:
--   1) 全新库由 database/seed/04-merchant-menu.sql 带出这四行,本文件只服务存量库,
--      两侧内容必须保持一致(根 AGENTS.md 硬约定 2:菜单种子 ↔ #[Permission] ↔ v-perm 三处同键)。
--   2) 页面:1005 效果分析(/promotions/analytics)、1006 平台活动(/campaigns);
--      按钮:100005 复制活动(mch:promotions:duplicate)、100601 响应邀请(mch:campaigns:respond)。
--   3) 授权口径与种子一致:内置角色按 account_scope 获授,商户自建角色需后台手工勾选。
-- ============================================================
USE `mtrip_business`;

-- ---- 1. 页面菜单 ----
INSERT IGNORE INTO `merchant_menu`
  (`id`, `parent_id`, `menu_name`, `menu_name_en`, `i18n_key`, `perm_key`, `menu_type`, `route_path`, `component`, `icon`, `sort`, `account_scope`)
VALUES
  (1005, 0, '效果分析', 'Promotion Performance', 'menu.promotionPerformance', 'mch:promotions:performance', 2, '/promotions/analytics', 'promotions/analytics/index', 'LineChartOutlined', 14, '1,2,3'),
  (1006, 0, '平台活动', 'Campaigns', 'menu.campaigns', 'mch:campaigns:list', 2, '/campaigns', 'campaigns/index', 'SoundOutlined', 15, '1,2,3');

-- ---- 2. 按钮权限 ----
INSERT IGNORE INTO `merchant_menu`
  (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`)
VALUES
  (100005, 1000, '复制活动', 'Duplicate Promotion', 'mch:promotions:duplicate', 3, 5, '1,2'),
  (100601, 1006, '响应邀请', 'Accept or Decline Invitation', 'mch:campaigns:respond', 3, 1, '1,2');

-- ---- 3. 内置角色授权(按 account_scope 匹配;商户自建角色不动) ----
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT r.`id`, m.`id`
FROM `merchant_role` r
JOIN `merchant_menu` m
  ON m.`id` IN (1005, 1006, 100005, 100601)
 AND m.`deleted_at` IS NULL
WHERE r.`is_builtin` = 1
  AND FIND_IN_SET(r.`account_type`, m.`account_scope`);
