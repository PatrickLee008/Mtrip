SET NAMES utf8mb4;
USE mtrip_system;

-- M18 配置总览；仅新增页面，不改变现有配置、按钮权限或其他角色授权。
INSERT IGNORE INTO sys_menu
  (id, parent_id, menu_name, menu_name_en, i18n_key, perm_key, menu_type, route_path, component, icon, sort)
VALUES
  (1314, 1300, '平台配置总览', 'Platform Configuration', 'platformConfig.title', 'config:overview:list',
   2, '/config/overview', 'config/overview/index', '', 0);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 1, id FROM sys_menu WHERE id = 1314 AND deleted_at IS NULL;
