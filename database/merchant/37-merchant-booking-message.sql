-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App M4 酒店预订管理 §9.2]:住客消息按钮权限
-- 需求源:docs/plans/实现方案-Merchant-M4-酒店预订管理.md §9.2(Message Guest 真实会话)
-- 库:mtrip_business;幂等(INSERT IGNORE)
-- 约定:#[Permission] 键与本文件 perm_key、前端 v-perm 三者完全一致
-- ============================================================
USE `mtrip_business`;

-- ---------- 1. 住客消息按钮权限(续 36-merchant-booking-menu 的 40002~40014) ----------
INSERT IGNORE INTO `merchant_menu` (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`) VALUES
(40015, 400, '发送住客消息', 'Message Guest', 'mch:order:message', 3, 15, '1,2,3');

-- ---------- 2. 内置角色授权新增按钮(不自动扩权给自建角色) ----------
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `merchant_menu` WHERE `id` = 40015 AND `deleted_at` IS NULL AND FIND_IN_SET(1, `account_scope`);
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 2, `id` FROM `merchant_menu` WHERE `id` = 40015 AND `deleted_at` IS NULL AND FIND_IN_SET(2, `account_scope`);
INSERT IGNORE INTO `merchant_role_menu` (`role_id`, `menu_id`)
SELECT 3, `id` FROM `merchant_menu` WHERE `id` = 40015 AND `deleted_at` IS NULL AND FIND_IN_SET(3, `account_scope`);
