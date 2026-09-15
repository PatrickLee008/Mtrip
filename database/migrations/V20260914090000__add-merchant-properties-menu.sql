SET NAMES utf8mb4;
USE mtrip_business;

INSERT IGNORE INTO merchant_menu
  (id, parent_id, menu_name, menu_name_en, i18n_key, perm_key, menu_type, route_path, component, icon, sort, account_scope)
VALUES
  (1400, 0, '所有物业', 'All Properties', 'sidebar.allProperties', 'mch:properties:list', 2, '/properties', 'properties/index', 'HomeOutlined', 0, '1,2,3');

INSERT IGNORE INTO merchant_role_menu (role_id, menu_id)
SELECT role_id, 1400 FROM merchant_role_menu WHERE menu_id = 100;
