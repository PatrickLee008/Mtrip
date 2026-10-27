SET NAMES utf8mb4;
USE `mtrip_business`;

INSERT IGNORE INTO `merchant_menu`
  (`id`, `parent_id`, `menu_name`, `menu_name_en`, `perm_key`, `menu_type`, `sort`, `account_scope`)
VALUES (20106, 201, '删除员工', 'Delete Staff', 'mch:account:delete', 3, 6, '1,2');
