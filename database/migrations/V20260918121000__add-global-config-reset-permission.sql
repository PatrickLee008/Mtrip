-- 补齐全局参数恢复默认权限，使后端注解、菜单种子和前端 v-perm 使用同一权限键。

SET NAMES utf8mb4;
USE mtrip_system;

INSERT IGNORE INTO sys_menu
    (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES
    (130102, 1301, '恢复默认', 'Reset', 'config:global:reset', 3, 2);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE perm_key = 'config:global:reset' AND deleted_at IS NULL;
