SET NAMES utf8mb4;
USE mtrip_system;

-- 原页面及按钮的 ID、路由、权限不变，作为平台总览的子页面保留动态路由。
UPDATE sys_menu
SET parent_id = 1314
WHERE parent_id = 1300 AND menu_type = 2
  AND id IN (1301,1302,1303,1304,1305,1306,1307,1308,1309,1310,1311,1312,1313)
  AND deleted_at IS NULL;

-- 已具原配置页面权限的角色获得总览导航，不新增任何业务页面或操作权限。
INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT DISTINCT rm.role_id, 1314
FROM sys_role_menu rm
JOIN sys_menu m ON m.id = rm.menu_id
WHERE m.parent_id = 1314 AND m.menu_type = 2 AND m.deleted_at IS NULL;

-- 只有原目录已无其他启用子项时才隐藏，保留目录与原授权记录以便追溯。
UPDATE sys_menu AS directory
LEFT JOIN sys_menu AS child
  ON child.parent_id = directory.id AND child.status = 1 AND child.deleted_at IS NULL
SET directory.status = 2
WHERE directory.id = 1300 AND directory.deleted_at IS NULL AND child.id IS NULL;
