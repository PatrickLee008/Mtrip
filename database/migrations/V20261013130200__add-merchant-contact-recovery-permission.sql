USE `mtrip_system`;
INSERT IGNORE INTO sys_menu (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES (30117, 301, '核验后更正登录联系方式', 'Correct Login Contacts After Review', 'merchant:list:contacts', 3, 17);
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 30117);
