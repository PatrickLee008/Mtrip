SET NAMES utf8mb4;
USE mtrip_system;

-- 终端用户管理 → 钱包流水:全平台 / 本站点 C 端钱包流水查询(GET /api/v1/admin/user/balance-logs)。
INSERT IGNORE INTO sys_menu
    (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, route_path, component, icon, sort)
VALUES
    (1016, 1000, '钱包流水', 'Wallet Ledger', 'user:wallet:list', 2,
     '/user/wallet', 'user/wallet/index', '', 16);

-- 能看用户目录的角色同时获得钱包流水;超管角色始终补齐。
INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT role_id, 1016
FROM sys_role_menu
WHERE menu_id = 1001;

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
VALUES (1, 1016);
