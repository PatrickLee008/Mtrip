USE `mtrip_system`;

INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
(130501,1305,'发送测试短信','Send Test SMS','config:sms:test',3,5);
