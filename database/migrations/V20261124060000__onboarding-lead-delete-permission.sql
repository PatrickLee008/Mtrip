SET NAMES utf8mb4;
USE `mtrip_system`;

INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(20509,205,'永久删除入驻线索（仅超管）','Permanently Delete Lead (Super Admin Only)','merchant:onboarding:delete',3,9);
-- Ordinary roles are never granted this permission automatically. The API also requires isSuper.
INSERT IGNORE INTO sys_role_menu (role_id,menu_id) VALUES (1,20509);
