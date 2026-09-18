-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 商户端菜单结构调整(Room Types 改名 + Hotel Profile 入口)
-- 需求源:用户 2026-09-16 菜单调整(Stores/Goods 移出侧边栏、Operations 仅选中物业时显示、
--         新增 HOTEL MANAGEMENT 分组)
-- 库:mtrip_business;幂等(守卫式 UPDATE)
--
-- 说明:
--   1) 侧边栏分组(HOTEL MANAGEMENT / Operations 的显示条件、Hotel Profile 动态入口)
--      在 merchant-web/src/layouts/components/SideMenu.vue + src/config/menuSections.ts 实现;
--      本文件只同步数据库里的菜单名。
--   2) Stores(300)/Goods(500)按用户要求「只从侧边栏移除」:menu 行、权限与路由全部保留
--      (工作台「View All Properties」与「所有物业」列表对非酒店物业的 Manage 按钮仍跳 /store),
--      侧边栏的隐藏名单见 SideMenu.vue 的 HIDDEN_PATHS。
--   3) Hotel Profile 复用既有 /properties/:id/profile 路由(无独立 menu 行),
--      与 /dashboard、/properties 一样由前端直接挂入口,避免菜单树再注册一条重复路由。
--   4) 不动 merchant_menu.module_key:房型(600)/房量与价格(700)已是 hotel,保证 All Properties
--      与非酒店物业视图下不出现;Booking Management(400)保持公共,由前端按「是否选中物业」收起。
-- ============================================================
USE `mtrip_business`;

-- ---------- 客房管理 → 房型管理(路由/权限/授权不变,仅改展示名) ----------
UPDATE `merchant_menu` SET
  `menu_name` = '房型管理',
  `menu_name_en` = 'Room Types'
WHERE `id` = 600 AND `perm_key` = 'mch:rooms:list';
