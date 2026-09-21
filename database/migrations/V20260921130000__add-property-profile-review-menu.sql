SET NAMES utf8mb4;
USE mtrip_system;

-- 独立物业资料审核页面；沿用既有审批权限并保留角色授权。
INSERT IGNORE INTO sys_menu
    (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, route_path, component, icon, sort)
VALUES
    (311, 300, '物业资料审核', 'Property Profile Review', 'merchant:property:content-list', 2,
     '/merchant/property-review', 'merchant/property-review/index', '', 11);

INSERT IGNORE INTO sys_menu
    (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES
    (30116, 311, '审核物业资料', 'Review Property Profile', 'merchant:property:content-audit', 3, 1);

UPDATE sys_menu
SET parent_id = 311, sort = 1
WHERE id = 30116 AND perm_key = 'merchant:property:content-audit';

-- 已有审批权限的角色自动获得新页面；超管角色始终补齐页面权限。
INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT role_id, 311
FROM sys_role_menu
WHERE menu_id = 30116;

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE id IN (311, 30116) AND deleted_at IS NULL;
