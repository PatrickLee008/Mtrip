USE mtrip_system;
-- operator(102) 未获授权的权限键(用于切面负例冒烟)
SELECT m.perm_key
FROM sys_menu m
WHERE m.perm_key <> '' AND m.status = 1
  AND m.perm_key NOT IN (
    SELECT m2.perm_key
    FROM sys_role_menu rm
    JOIN sys_menu m2 ON m2.id = rm.menu_id
    JOIN sys_admin_role ar ON ar.role_id = rm.role_id
    WHERE ar.admin_id = 102 AND m2.perm_key <> ''
  )
LIMIT 10;
