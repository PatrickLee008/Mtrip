-- ============================================================
-- 种子数据 01:超级管理员账号 + 超管角色
-- 库:mtrip_system
-- 初始账号:admin / Admin@123456(bcrypt,首次登录后请立即修改)
-- ============================================================
USE `mtrip_system`;

-- 超级管理员账号(id=1,is_super=1 代码侧跳过权限校验)
INSERT INTO `sys_admin` (`id`, `site_id`, `username`, `password`, `real_name`, `is_super`, `status`, `remark`)
VALUES (1, 0, 'admin', '$2y$10$DfhIX9Mb7a0xXAP/zTZ3SOZiNzgCysHlU2z.C1KXAOJV/qma2dJAy', '超级管理员', 1, 1, '系统内置超管,不可删除')
ON DUPLICATE KEY UPDATE `username` = `username`;

-- 超管角色(id=1,全局角色)
INSERT INTO `sys_role` (`id`, `site_id`, `role_name`, `role_type`, `description`, `status`)
VALUES (1, 0, '超级管理员', 1, '系统内置角色,拥有全部权限,不可删除', 1)
ON DUPLICATE KEY UPDATE `role_name` = `role_name`;

-- 账号-角色关联
INSERT INTO `sys_admin_role` (`admin_id`, `role_id`)
SELECT 1, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sys_admin_role` WHERE `admin_id` = 1 AND `role_id` = 1);
