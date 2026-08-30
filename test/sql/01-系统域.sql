-- ============================================================
-- 系统域:管理员 / 角色 / 日志 / 平台配置
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_system`;


-- 角色
INSERT INTO `sys_role` (`id`,`site_id`,`role_name`,`role_type`,`description`,`status`,`created_at`,`updated_at`) VALUES
(101,4,'站点管理员',2,'巴黎站点全权限',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,4,'运营专员',2,'商户入驻审核 + 订单运营',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(103,4,'财务专员',2,'结算、对账、提现审核',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(104,4,'客服专员',2,'终端用户、客服会话、帮助中心',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(105,0,'只读审计员',1,'全平台只读,用于审计',1,'2025-11-03 04:19:43','2025-11-03 04:19:43');

-- 角色 - 菜单权限(按 sys_menu 的 ID 段批量授予,避免依赖具体菜单 ID)
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 101, m.id FROM `sys_menu` m WHERE m.deleted_at IS NULL AND ((m.id BETWEEN 100 AND 199) OR (m.id BETWEEN 10000 AND 19999) OR (m.id BETWEEN 200 AND 299) OR (m.id BETWEEN 20000 AND 29999) OR (m.id BETWEEN 300 AND 399) OR (m.id BETWEEN 30000 AND 39999) OR (m.id BETWEEN 400 AND 499) OR (m.id BETWEEN 40000 AND 49999) OR (m.id BETWEEN 500 AND 599) OR (m.id BETWEEN 50000 AND 59999) OR (m.id BETWEEN 600 AND 699) OR (m.id BETWEEN 60000 AND 69999) OR (m.id BETWEEN 700 AND 799) OR (m.id BETWEEN 70000 AND 79999) OR (m.id BETWEEN 800 AND 899) OR (m.id BETWEEN 80000 AND 89999) OR (m.id BETWEEN 900 AND 999) OR (m.id BETWEEN 90000 AND 99999) OR (m.id BETWEEN 1000 AND 1099) OR (m.id BETWEEN 100000 AND 109999) OR (m.id BETWEEN 1100 AND 1199) OR (m.id BETWEEN 110000 AND 119999) OR (m.id BETWEEN 1200 AND 1299) OR (m.id BETWEEN 120000 AND 129999) OR (m.id BETWEEN 1300 AND 1399) OR (m.id BETWEEN 130000 AND 139999) OR (m.id BETWEEN 1400 AND 1499) OR (m.id BETWEEN 140000 AND 149999) OR (m.id BETWEEN 1500 AND 1599) OR (m.id BETWEEN 150000 AND 159999) OR (m.id BETWEEN 1600 AND 1699) OR (m.id BETWEEN 160000 AND 169999) OR (m.id BETWEEN 1700 AND 1799) OR (m.id BETWEEN 170000 AND 179999) OR (m.id BETWEEN 1800 AND 1899) OR (m.id BETWEEN 180000 AND 189999) OR (m.id = 100));
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 102, m.id FROM `sys_menu` m WHERE m.deleted_at IS NULL AND ((m.id BETWEEN 200 AND 299) OR (m.id BETWEEN 20000 AND 29999) OR (m.id BETWEEN 300 AND 399) OR (m.id BETWEEN 30000 AND 39999) OR (m.id BETWEEN 400 AND 499) OR (m.id BETWEEN 40000 AND 49999) OR (m.id BETWEEN 1500 AND 1599) OR (m.id BETWEEN 150000 AND 159999) OR (m.id BETWEEN 1600 AND 1699) OR (m.id BETWEEN 160000 AND 169999) OR (m.id BETWEEN 900 AND 999) OR (m.id BETWEEN 90000 AND 99999) OR (m.id BETWEEN 1700 AND 1799) OR (m.id BETWEEN 170000 AND 179999) OR (m.id = 100));
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 103, m.id FROM `sys_menu` m WHERE m.deleted_at IS NULL AND ((m.id BETWEEN 400 AND 499) OR (m.id BETWEEN 40000 AND 49999) OR (m.id BETWEEN 1700 AND 1799) OR (m.id BETWEEN 170000 AND 179999) OR (m.id BETWEEN 900 AND 999) OR (m.id BETWEEN 90000 AND 99999) OR (m.id BETWEEN 1400 AND 1499) OR (m.id BETWEEN 140000 AND 149999) OR (m.id = 100));
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 104, m.id FROM `sys_menu` m WHERE m.deleted_at IS NULL AND ((m.id BETWEEN 400 AND 499) OR (m.id BETWEEN 40000 AND 49999) OR (m.id BETWEEN 1000 AND 1099) OR (m.id BETWEEN 100000 AND 109999) OR (m.id BETWEEN 1100 AND 1199) OR (m.id BETWEEN 110000 AND 119999) OR (m.id BETWEEN 900 AND 999) OR (m.id BETWEEN 90000 AND 99999) OR (m.id = 100));
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 105, m.id FROM `sys_menu` m WHERE m.deleted_at IS NULL AND ((m.id BETWEEN 100 AND 199) OR (m.id BETWEEN 10000 AND 19999) OR (m.id BETWEEN 200 AND 299) OR (m.id BETWEEN 20000 AND 29999) OR (m.id BETWEEN 300 AND 399) OR (m.id BETWEEN 30000 AND 39999) OR (m.id BETWEEN 400 AND 499) OR (m.id BETWEEN 40000 AND 49999) OR (m.id BETWEEN 500 AND 599) OR (m.id BETWEEN 50000 AND 59999) OR (m.id BETWEEN 600 AND 699) OR (m.id BETWEEN 60000 AND 69999) OR (m.id BETWEEN 700 AND 799) OR (m.id BETWEEN 70000 AND 79999) OR (m.id BETWEEN 800 AND 899) OR (m.id BETWEEN 80000 AND 89999) OR (m.id BETWEEN 900 AND 999) OR (m.id BETWEEN 90000 AND 99999) OR (m.id BETWEEN 1000 AND 1099) OR (m.id BETWEEN 100000 AND 109999) OR (m.id BETWEEN 1100 AND 1199) OR (m.id BETWEEN 110000 AND 119999) OR (m.id BETWEEN 1200 AND 1299) OR (m.id BETWEEN 120000 AND 129999) OR (m.id BETWEEN 1300 AND 1399) OR (m.id BETWEEN 130000 AND 139999) OR (m.id BETWEEN 1400 AND 1499) OR (m.id BETWEEN 140000 AND 149999) OR (m.id BETWEEN 1500 AND 1599) OR (m.id BETWEEN 150000 AND 159999) OR (m.id BETWEEN 1600 AND 1699) OR (m.id BETWEEN 160000 AND 169999) OR (m.id BETWEEN 1700 AND 1799) OR (m.id BETWEEN 170000 AND 179999) OR (m.id BETWEEN 1800 AND 1899) OR (m.id BETWEEN 180000 AND 189999) OR (m.id = 100));

-- 管理员账号(口令统一 Admin@123456)
INSERT INTO `sys_admin` (`id`,`site_id`,`username`,`password`,`real_name`,`mobile`,`email`,`avatar`,`is_super`,`status`,`login_fail_count`,`last_login_at`,`last_login_ip`,`remark`,`created_at`,`updated_at`) VALUES
(101,4,'site_admin','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','站点管理员','cR1r/Also5UptMATPE+lwNfd6Rbvn5hgb2Es4PeR/FngSI/JQPbuGg==','site_admin@mtrip.test','',0,1,0,'2026-08-26 14:13:43','10.0.0.139','巴黎站点管理员(用于验证站点隔离)','2025-11-03 04:19:43','2026-08-25 10:22:43'),
(102,4,'operator','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','运营专员','nmPOiBKu8XK3AhCqzN4Wf2x7RHCslw5KpvCvCVHUAJwXhPV86STsMQ==','operator@mtrip.test','',0,1,0,'2026-08-29 21:48:43','10.0.9.143','负责商户入驻审核','2025-11-03 04:19:43','2026-08-24 11:46:43'),
(103,4,'finance','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','财务专员','PDgJrpPIpWQkJ3SZ2e/P1H+7KR/tkXV/MKAFK406a90LNjBaE6bRwA==','finance@mtrip.test','',0,1,0,'2026-08-25 23:37:43','10.0.2.39','负责结算与提现审核','2025-11-03 04:19:43','2026-08-25 20:38:43'),
(104,4,'support','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','客服专员','yJksESmR1haumjE+6E9nd/0uK+xj9qY6LN+KhuKX4Iw1Org5VFLdQg==','support@mtrip.test','',0,1,0,'2026-08-27 21:00:43','10.0.5.18','负责终端用户与会话','2025-11-03 04:19:43','2026-08-29 10:08:43'),
(105,0,'auditor','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','只读审计员','1rChiVTHxkYtxuTzgGh15ZPbWpaPjwmhrURrVDlQLJmac/NItkdE0Q==','auditor@mtrip.test','',0,1,0,'2026-08-23 22:26:43','10.0.4.127','全平台只读','2025-11-03 04:19:43','2026-08-27 13:54:43'),
(106,3,'fr_admin','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','法国站点管理员','FNqC7mn4v6t1GAT4xT9KojNECkkaPwWXH5kfrxn+YjP6XsoImuaDeA==','fr_admin@mtrip.test','',0,1,0,'2026-08-28 19:18:43','10.0.8.120','法国站点(用于跨站点隔离对比)','2025-11-03 04:19:43','2026-08-27 11:19:43'),
(107,4,'disabled_admin','$2y$10$HWyNFAv6xauIjHf1HoXSQegzi67YUu7Q/kQlYFQTLWVbvnabBvWk.','已禁用账号','jDGa1r5Jq154Rmv2SOqdaSpohXGpmQFPoFDVAR6bVEBV3tPt0a18Lg==','disabled_admin@mtrip.test','',0,2,0,NULL,'10.0.0.189','状态=2,用于验证禁用账号不可登录','2025-11-03 04:19:43','2026-08-26 20:01:43');

-- 账号 - 角色关联
INSERT INTO `sys_admin_role` (`admin_id`,`role_id`,`created_at`) VALUES
(101,101,'2025-11-03 04:19:43'),
(102,102,'2025-11-03 04:19:43'),
(103,103,'2025-11-03 04:19:43'),
(104,104,'2025-11-03 04:19:43'),
(105,105,'2025-11-03 04:19:43'),
(106,101,'2025-11-03 04:19:43'),
(107,101,'2025-11-03 04:19:43');

-- 管理员登录日志(含失败/锁定,用于验证登录日志筛选)
INSERT INTO `sys_admin_login_log` (`id`,`admin_id`,`username`,`site_id`,`login_ip`,`user_agent`,`status`,`remark`,`created_at`) VALUES
(1001,103,'finance',4,'148.190.55.249','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-24 03:04:43'),
(1002,101,'site_admin',4,'37.166.6.136','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-03 09:47:43'),
(1003,107,'disabled_admin',4,'141.75.206.193','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-07 18:43:43'),
(1004,104,'support',4,'179.144.174.158','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',2,'密码错误','2026-08-23 10:04:43'),
(1005,103,'finance',4,'64.138.16.100','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-23 23:24:43'),
(1006,102,'operator',4,'158.210.18.21','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-08-29 18:53:43'),
(1007,101,'site_admin',4,'45.79.21.224','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-11 15:14:43'),
(1008,101,'site_admin',4,'207.8.171.142','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-07-31 21:31:43'),
(1009,104,'support',4,'220.239.88.104','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-18 18:21:43'),
(1010,103,'finance',4,'1.232.250.156','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',2,'密码错误','2026-08-18 02:25:43'),
(1011,105,'auditor',4,'135.238.214.8','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-09 18:42:43'),
(1012,107,'disabled_admin',4,'86.242.149.119','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-04 17:25:43'),
(1013,101,'site_admin',4,'191.140.104.71','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-23 06:55:43'),
(1014,102,'operator',4,'179.137.204.2','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-24 22:23:43'),
(1015,103,'finance',4,'206.111.238.80','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-23 11:59:43'),
(1016,101,'site_admin',4,'51.23.188.82','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-01 12:48:43'),
(1017,107,'disabled_admin',4,'38.89.199.122','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-13 00:49:43'),
(1018,106,'fr_admin',4,'190.97.185.51','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-08-19 10:34:43'),
(1019,105,'auditor',4,'184.172.171.39','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-15 20:57:43'),
(1020,106,'fr_admin',4,'158.118.165.152','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-21 17:55:43'),
(1021,101,'site_admin',4,'38.195.116.116','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-06 04:30:43'),
(1022,104,'support',4,'106.118.170.217','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-21 04:26:43'),
(1023,101,'site_admin',4,'7.154.242.180','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',3,'账号锁定','2026-08-05 20:43:43'),
(1024,105,'auditor',4,'86.9.158.237','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-22 22:03:43'),
(1025,105,'auditor',4,'52.32.155.98','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-04 14:48:43'),
(1026,103,'finance',4,'220.197.41.172','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-29 09:21:43'),
(1027,105,'auditor',4,'47.91.151.100','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-05 02:00:43'),
(1028,104,'support',4,'32.175.35.195','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',2,'密码错误','2026-08-29 10:33:43'),
(1029,101,'site_admin',4,'218.193.137.139','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-28 08:16:43'),
(1030,103,'finance',4,'100.221.227.133','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-12 13:15:43'),
(1031,105,'auditor',4,'133.201.89.15','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-02 14:12:43'),
(1032,105,'auditor',4,'41.188.238.134','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-21 07:22:43'),
(1033,101,'site_admin',4,'187.28.45.193','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',3,'账号锁定','2026-08-19 23:06:43'),
(1034,105,'auditor',4,'105.4.24.47','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',2,'密码错误','2026-08-20 09:33:43'),
(1035,102,'operator',4,'9.83.204.18','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-01 08:55:43'),
(1036,104,'support',4,'126.44.246.121','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-06 08:01:43'),
(1037,106,'fr_admin',4,'190.242.191.93','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-11 21:15:43'),
(1038,103,'finance',4,'153.26.114.43','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-23 15:32:43'),
(1039,103,'finance',4,'143.131.197.12','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-13 22:33:43'),
(1040,105,'auditor',4,'202.238.85.248','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-29 12:26:43'),
(1041,107,'disabled_admin',4,'130.59.208.195','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',3,'账号锁定','2026-08-28 14:39:43'),
(1042,105,'auditor',4,'184.226.170.83','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-08-21 13:04:43'),
(1043,106,'fr_admin',4,'116.204.174.89','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-07-30 06:38:43'),
(1044,104,'support',4,'50.134.190.11','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-13 00:05:43'),
(1045,101,'site_admin',4,'216.179.217.13','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-04 19:13:43'),
(1046,107,'disabled_admin',4,'43.145.65.234','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-17 12:53:43'),
(1047,103,'finance',4,'138.220.66.108','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-04 10:55:43'),
(1048,104,'support',4,'21.160.226.251','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-26 19:14:43'),
(1049,104,'support',4,'105.251.111.111','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-04 16:27:43'),
(1050,103,'finance',4,'222.7.63.230','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-10 04:20:43'),
(1051,107,'disabled_admin',4,'89.77.157.189','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-26 03:07:43'),
(1052,102,'operator',4,'50.43.188.242','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-25 23:54:43'),
(1053,103,'finance',4,'196.212.149.248','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-27 21:11:43'),
(1054,103,'finance',4,'157.1.195.118','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',2,'密码错误','2026-08-09 01:25:43'),
(1055,102,'operator',4,'195.74.55.23','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',3,'账号锁定','2026-08-08 07:34:43'),
(1056,106,'fr_admin',4,'149.37.9.26','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-02 05:00:43'),
(1057,101,'site_admin',4,'30.35.132.175','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-12 13:37:43'),
(1058,106,'fr_admin',4,'178.11.245.171','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-07-31 11:50:43'),
(1059,103,'finance',4,'205.95.155.153','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-07 00:53:43'),
(1060,107,'disabled_admin',4,'98.134.203.242','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-04 00:34:43');

-- 系统操作日志
INSERT INTO `sys_operation_log` (`id`,`admin_id`,`admin_name`,`site_id`,`module`,`action`,`content`,`request_url`,`request_method`,`client_ip`,`user_agent`,`status_code`,`created_at`) VALUES
(1001,104,'客服专员',4,'merchant','impersonate','{"target": 7185, "result": "ok"}','/api/merchant/impersonate','DELETE','10.0.7.23','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-07-31 01:12:43'),
(1002,102,'运营专员',4,'user','adjust_balance','{"target": 4422, "result": "ok"}','/api/user/adjust_balance','POST','10.0.3.253','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-07-31 19:10:43'),
(1003,103,'财务专员',4,'merchant','impersonate','{"target": 7032, "result": "ok"}','/api/merchant/impersonate','POST','10.0.6.214','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 17:56:43'),
(1004,101,'站点管理员',4,'marketing','add_coupon','{"target": 1538, "result": "ok"}','/api/marketing/add_coupon','DELETE','10.0.9.32','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-08-12 14:11:43'),
(1005,104,'客服专员',4,'finance','withdraw_pay','{"target": 9745, "result": "ok"}','/api/finance/withdraw_pay','PUT','10.0.4.155','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-10 05:51:43'),
(1006,101,'站点管理员',4,'order','cancel','{"target": 2080, "result": "ok"}','/api/order/cancel','POST','10.0.2.24','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-17 12:41:43'),
(1007,105,'只读审计员',4,'system','edit_role','{"target": 7067, "result": "ok"}','/api/system/edit_role','POST','10.0.9.247','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 16:59:43'),
(1008,104,'客服专员',4,'finance','settle_confirm','{"target": 9382, "result": "ok"}','/api/finance/settle_confirm','POST','10.0.2.57','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 19:56:43'),
(1009,103,'财务专员',4,'goods','edit_stock','{"target": 4488, "result": "ok"}','/api/goods/edit_stock','DELETE','10.0.7.105','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 01:27:43'),
(1010,103,'财务专员',4,'marketing','stop_coupon','{"target": 9432, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.7.19','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 16:44:43'),
(1011,103,'财务专员',4,'user','adjust_balance','{"target": 3911, "result": "ok"}','/api/user/adjust_balance','DELETE','10.0.8.120','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-13 23:36:43'),
(1012,105,'只读审计员',4,'finance','withdraw_pay','{"target": 5474, "result": "ok"}','/api/finance/withdraw_pay','POST','10.0.8.78','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 06:27:43'),
(1013,102,'运营专员',4,'system','add_admin','{"target": 2190, "result": "ok"}','/api/system/add_admin','POST','10.0.3.80','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-06 02:59:43'),
(1014,103,'财务专员',4,'order','refund_audit','{"target": 6196, "result": "ok"}','/api/order/refund_audit','POST','10.0.7.166','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-14 21:36:43'),
(1015,102,'运营专员',4,'order','export','{"target": 801, "result": "ok"}','/api/order/export','PUT','10.0.9.217','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-05 02:18:43'),
(1016,105,'只读审计员',4,'system','edit_role','{"target": 8917, "result": "ok"}','/api/system/edit_role','DELETE','10.0.8.102','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-05 15:24:43'),
(1017,106,'法国站点管理员',4,'merchant','suspend','{"target": 9984, "result": "ok"}','/api/merchant/suspend','PUT','10.0.8.21','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-23 02:57:43'),
(1018,107,'已禁用账号',4,'goods','off_shelf','{"target": 8782, "result": "ok"}','/api/goods/off_shelf','POST','10.0.0.221','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-26 23:57:43'),
(1019,105,'只读审计员',4,'goods','off_shelf','{"target": 1851, "result": "ok"}','/api/goods/off_shelf','PUT','10.0.8.24','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 14:40:43'),
(1020,104,'客服专员',4,'finance','settle_confirm','{"target": 6463, "result": "ok"}','/api/finance/settle_confirm','PUT','10.0.9.107','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-03 10:00:43'),
(1021,103,'财务专员',4,'merchant','blacklist','{"target": 2688, "result": "ok"}','/api/merchant/blacklist','POST','10.0.0.117','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-09 12:18:43'),
(1022,103,'财务专员',4,'marketing','add_coupon','{"target": 7507, "result": "ok"}','/api/marketing/add_coupon','PUT','10.0.2.195','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-12 03:17:43'),
(1023,101,'站点管理员',4,'merchant','suspend','{"target": 1277, "result": "ok"}','/api/merchant/suspend','POST','10.0.3.183','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-16 06:34:43'),
(1024,104,'客服专员',4,'system','edit_role','{"target": 3728, "result": "ok"}','/api/system/edit_role','POST','10.0.4.110','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 05:18:43'),
(1025,102,'运营专员',4,'merchant','suspend','{"target": 426, "result": "ok"}','/api/merchant/suspend','PUT','10.0.9.192','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 22:36:43'),
(1026,101,'站点管理员',4,'merchant','suspend','{"target": 390, "result": "ok"}','/api/merchant/suspend','DELETE','10.0.3.158','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-12 05:29:43'),
(1027,106,'法国站点管理员',4,'user','freeze','{"target": 5795, "result": "ok"}','/api/user/freeze','PUT','10.0.8.176','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',500,'2026-08-20 11:28:43'),
(1028,103,'财务专员',4,'order','cancel','{"target": 2389, "result": "ok"}','/api/order/cancel','POST','10.0.9.215','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-20 17:52:43'),
(1029,101,'站点管理员',4,'system','reset_pwd','{"target": 391, "result": "ok"}','/api/system/reset_pwd','PUT','10.0.0.235','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-27 23:07:43'),
(1030,101,'站点管理员',4,'system','edit_role','{"target": 574, "result": "ok"}','/api/system/edit_role','PUT','10.0.5.46','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-15 14:30:43'),
(1031,105,'只读审计员',4,'goods','edit_stock','{"target": 8461, "result": "ok"}','/api/goods/edit_stock','PUT','10.0.1.160','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 05:11:43'),
(1032,105,'只读审计员',4,'system','reset_pwd','{"target": 4612, "result": "ok"}','/api/system/reset_pwd','POST','10.0.6.219','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-17 04:59:43'),
(1033,107,'已禁用账号',4,'merchant','audit','{"target": 535, "result": "ok"}','/api/merchant/audit','DELETE','10.0.2.166','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 19:48:43'),
(1034,102,'运营专员',4,'user','blacklist','{"target": 5734, "result": "ok"}','/api/user/blacklist','DELETE','10.0.9.203','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-10 19:37:43'),
(1035,104,'客服专员',4,'system','reset_pwd','{"target": 9384, "result": "ok"}','/api/system/reset_pwd','PUT','10.0.5.169','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 11:55:43'),
(1036,105,'只读审计员',4,'order','refund_audit','{"target": 9125, "result": "ok"}','/api/order/refund_audit','PUT','10.0.4.197','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-10 05:45:43'),
(1037,105,'只读审计员',4,'user','blacklist','{"target": 6447, "result": "ok"}','/api/user/blacklist','POST','10.0.1.185','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-04 16:55:43'),
(1038,102,'运营专员',4,'marketing','stop_coupon','{"target": 8968, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.9.32','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-07-31 01:54:43'),
(1039,103,'财务专员',4,'user','freeze','{"target": 4851, "result": "ok"}','/api/user/freeze','PUT','10.0.9.158','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-06 15:44:43'),
(1040,101,'站点管理员',4,'merchant','audit','{"target": 1357, "result": "ok"}','/api/merchant/audit','PUT','10.0.1.204','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-06 23:36:43'),
(1041,107,'已禁用账号',4,'goods','edit_stock','{"target": 5219, "result": "ok"}','/api/goods/edit_stock','POST','10.0.5.224','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 19:00:43'),
(1042,106,'法国站点管理员',4,'merchant','suspend','{"target": 2054, "result": "ok"}','/api/merchant/suspend','POST','10.0.2.195','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-07 16:13:43'),
(1043,107,'已禁用账号',4,'finance','withdraw_pay','{"target": 8345, "result": "ok"}','/api/finance/withdraw_pay','PUT','10.0.5.225','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-08 06:46:43'),
(1044,106,'法国站点管理员',4,'order','export','{"target": 6116, "result": "ok"}','/api/order/export','POST','10.0.6.57','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-06 11:05:43'),
(1045,104,'客服专员',4,'goods','off_shelf','{"target": 4865, "result": "ok"}','/api/goods/off_shelf','POST','10.0.3.56','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 10:52:43'),
(1046,105,'只读审计员',4,'system','reset_pwd','{"target": 6231, "result": "ok"}','/api/system/reset_pwd','DELETE','10.0.2.16','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 15:09:43'),
(1047,103,'财务专员',4,'order','cancel','{"target": 1199, "result": "ok"}','/api/order/cancel','DELETE','10.0.0.49','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-27 05:24:43'),
(1048,102,'运营专员',4,'order','refund_audit','{"target": 3082, "result": "ok"}','/api/order/refund_audit','DELETE','10.0.6.95','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-14 02:34:43'),
(1049,102,'运营专员',4,'marketing','add_coupon','{"target": 3593, "result": "ok"}','/api/marketing/add_coupon','DELETE','10.0.1.112','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-08-21 05:16:43'),
(1050,101,'站点管理员',4,'system','reset_pwd','{"target": 3193, "result": "ok"}','/api/system/reset_pwd','POST','10.0.2.116','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 14:07:43'),
(1051,103,'财务专员',4,'marketing','stop_coupon','{"target": 7764, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.3.172','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 19:47:43'),
(1052,102,'运营专员',4,'goods','off_shelf','{"target": 1401, "result": "ok"}','/api/goods/off_shelf','DELETE','10.0.0.129','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 14:08:43'),
(1053,101,'站点管理员',4,'merchant','impersonate','{"target": 8766, "result": "ok"}','/api/merchant/impersonate','DELETE','10.0.4.221','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-22 20:21:43'),
(1054,106,'法国站点管理员',4,'goods','edit_stock','{"target": 8151, "result": "ok"}','/api/goods/edit_stock','PUT','10.0.3.103','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-03 08:51:43'),
(1055,104,'客服专员',4,'marketing','add_coupon','{"target": 267, "result": "ok"}','/api/marketing/add_coupon','DELETE','10.0.2.153','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-11 04:51:43'),
(1056,103,'财务专员',4,'marketing','stop_coupon','{"target": 3863, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.9.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-05 08:14:43'),
(1057,104,'客服专员',4,'finance','settle_confirm','{"target": 9608, "result": "ok"}','/api/finance/settle_confirm','DELETE','10.0.3.225','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-07-31 19:58:43'),
(1058,105,'只读审计员',4,'order','cancel','{"target": 6017, "result": "ok"}','/api/order/cancel','DELETE','10.0.3.171','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-08 03:41:43'),
(1059,106,'法国站点管理员',4,'merchant','blacklist','{"target": 2892, "result": "ok"}','/api/merchant/blacklist','POST','10.0.2.59','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',500,'2026-08-28 05:12:43'),
(1060,105,'只读审计员',4,'order','refund_audit','{"target": 6646, "result": "ok"}','/api/order/refund_audit','DELETE','10.0.9.80','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 09:26:43'),
(1061,102,'运营专员',4,'goods','audit','{"target": 3999, "result": "ok"}','/api/goods/audit','DELETE','10.0.5.186','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-22 04:52:43'),
(1062,103,'财务专员',4,'order','refund_audit','{"target": 6481, "result": "ok"}','/api/order/refund_audit','PUT','10.0.5.192','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-10 20:54:43'),
(1063,104,'客服专员',4,'system','add_admin','{"target": 8575, "result": "ok"}','/api/system/add_admin','POST','10.0.8.13','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 23:31:43'),
(1064,102,'运营专员',4,'finance','settle_confirm','{"target": 8118, "result": "ok"}','/api/finance/settle_confirm','POST','10.0.6.44','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-08-20 15:52:43'),
(1065,102,'运营专员',4,'goods','off_shelf','{"target": 2444, "result": "ok"}','/api/goods/off_shelf','DELETE','10.0.8.94','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-07-30 22:43:43'),
(1066,102,'运营专员',4,'finance','withdraw_pay','{"target": 2320, "result": "ok"}','/api/finance/withdraw_pay','PUT','10.0.1.58','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-07 14:47:43'),
(1067,102,'运营专员',4,'user','blacklist','{"target": 2243, "result": "ok"}','/api/user/blacklist','POST','10.0.7.79','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 01:03:43'),
(1068,101,'站点管理员',4,'marketing','stop_coupon','{"target": 9938, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.3.109','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-22 17:23:43'),
(1069,107,'已禁用账号',4,'system','edit_role','{"target": 766, "result": "ok"}','/api/system/edit_role','POST','10.0.0.75','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-11 05:02:43'),
(1070,107,'已禁用账号',4,'marketing','stop_coupon','{"target": 9052, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.2.237','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-05 20:46:43'),
(1071,103,'财务专员',4,'marketing','add_coupon','{"target": 3254, "result": "ok"}','/api/marketing/add_coupon','POST','10.0.1.61','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-12 17:12:43'),
(1072,106,'法国站点管理员',4,'goods','audit','{"target": 6157, "result": "ok"}','/api/goods/audit','POST','10.0.3.85','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-04 21:55:43'),
(1073,102,'运营专员',4,'merchant','suspend','{"target": 8995, "result": "ok"}','/api/merchant/suspend','DELETE','10.0.0.130','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-20 14:35:43'),
(1074,104,'客服专员',4,'user','adjust_balance','{"target": 3545, "result": "ok"}','/api/user/adjust_balance','PUT','10.0.1.139','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-02 14:12:43'),
(1075,102,'运营专员',4,'user','freeze','{"target": 9414, "result": "ok"}','/api/user/freeze','DELETE','10.0.3.217','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-26 10:56:43'),
(1076,102,'运营专员',4,'marketing','stop_coupon','{"target": 2997, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.1.242','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-04 18:50:43'),
(1077,107,'已禁用账号',4,'system','edit_role','{"target": 881, "result": "ok"}','/api/system/edit_role','POST','10.0.3.124','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-14 22:47:43'),
(1078,103,'财务专员',4,'order','export','{"target": 3888, "result": "ok"}','/api/order/export','DELETE','10.0.0.10','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 09:40:43'),
(1079,102,'运营专员',4,'finance','withdraw_pay','{"target": 4170, "result": "ok"}','/api/finance/withdraw_pay','DELETE','10.0.0.111','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 18:01:43'),
(1080,102,'运营专员',4,'marketing','add_coupon','{"target": 7807, "result": "ok"}','/api/marketing/add_coupon','POST','10.0.5.174','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-04 19:38:43');

-- 接口访问日志
INSERT INTO `sys_api_access_log` (`id`,`site_id`,`client_pk_id`,`client_id`,`client_name`,`client_type`,`api_path`,`request_method`,`request_headers`,`request_params`,`response_code`,`response_body`,`cost_ms`,`device_info`,`client_ip`,`created_at`) VALUES
(1001,1,0,'mtrip_h5','Mtrip App',2,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',581,'iPhone 15','111.63.125.90','2026-08-27 00:24:43'),
(1002,3,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 15}',200,'{"code": 0}',536,'Pixel 8','117.57.175.204','2026-08-29 16:16:43'),
(1003,3,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 8}',200,'{"code": 0}',539,'iPhone 15','77.137.20.76','2026-08-24 01:18:43'),
(1004,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 15}',401,'{"code": 0}',661,'Pixel 8','150.110.64.117','2026-08-28 04:40:43'),
(1005,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',657,'Web','92.52.95.72','2026-08-21 00:05:43'),
(1006,3,0,'mtrip_android','Mtrip App',2,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',421,'iPhone 15','210.168.124.182','2026-08-23 01:14:43'),
(1007,1,0,'mtrip_h5','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',511,'Web','75.127.59.236','2026-08-24 17:29:43'),
(1008,1,0,'mtrip_ios','Mtrip App',1,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',1022,'iPhone 15','73.189.63.247','2026-08-22 00:38:43'),
(1009,3,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',810,'iPhone 15','207.23.171.215','2026-08-28 08:17:43'),
(1010,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',1121,'Web','60.21.147.238','2026-08-28 00:34:43'),
(1011,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',759,'iPhone 15','166.202.92.171','2026-08-18 19:23:43'),
(1012,3,0,'mtrip_ios','Mtrip App',2,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',503,'Web','121.2.115.246','2026-08-18 12:31:43'),
(1013,3,0,'mtrip_ios','Mtrip App',2,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',402,'Pixel 8','22.57.155.235','2026-08-26 21:22:43'),
(1014,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',136,'iPhone 15','197.85.182.153','2026-08-16 18:08:43'),
(1015,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',383,'Web','54.249.53.103','2026-08-27 03:07:43'),
(1016,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',225,'Web','156.220.38.100','2026-08-27 19:31:43'),
(1017,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',711,'iPhone 15','93.50.85.15','2026-08-26 22:04:43'),
(1018,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 8}',200,'{"code": 0}',324,'Pixel 8','138.81.159.122','2026-08-20 05:07:43'),
(1019,1,0,'mtrip_h5','Mtrip App',1,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',268,'Pixel 8','41.170.101.144','2026-08-18 14:18:43'),
(1020,3,0,'mtrip_android','Mtrip App',2,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',424,'iPhone 15','54.32.27.5','2026-08-28 06:26:43'),
(1021,3,0,'mtrip_android','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',997,'iPhone 15','28.120.7.229','2026-08-16 15:13:43'),
(1022,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 16}',200,'{"code": 0}',897,'Pixel 8','27.96.110.43','2026-08-22 14:11:43'),
(1023,3,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',362,'Pixel 8','185.51.210.165','2026-08-16 23:40:43'),
(1024,1,0,'mtrip_h5','Mtrip App',2,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 15}',200,'{"code": 0}',1003,'iPhone 15','88.205.243.62','2026-08-19 03:08:43'),
(1025,3,0,'mtrip_android','Mtrip App',1,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',993,'iPhone 15','28.107.115.209','2026-08-23 02:28:43'),
(1026,4,0,'mtrip_android','Mtrip App',2,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',1159,'Pixel 8','94.241.190.233','2026-08-28 10:32:43'),
(1027,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 15}',200,'{"code": 0}',1163,'Web','38.21.197.165','2026-08-29 11:19:43'),
(1028,1,0,'mtrip_android','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',974,'iPhone 15','48.138.255.60','2026-08-23 01:11:43'),
(1029,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',202,'Web','169.59.228.185','2026-08-28 23:08:43'),
(1030,4,0,'mtrip_android','Mtrip App',2,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',1027,'iPhone 15','176.176.205.53','2026-08-23 10:21:43'),
(1031,4,0,'mtrip_android','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',128,'Pixel 8','21.107.106.187','2026-08-22 01:46:43'),
(1032,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',464,'Pixel 8','117.28.119.61','2026-08-25 18:38:43'),
(1033,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',217,'Web','139.33.16.239','2026-08-25 11:07:43'),
(1034,4,0,'mtrip_ios','Mtrip App',2,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 11}',200,'{"code": 0}',256,'iPhone 15','219.156.97.208','2026-08-27 21:47:43'),
(1035,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',184,'iPhone 15','179.68.17.235','2026-08-29 14:32:43'),
(1036,1,0,'mtrip_h5','Mtrip App',2,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',1115,'iPhone 15','194.136.152.13','2026-08-21 00:51:43'),
(1037,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',435,'Pixel 8','158.52.31.17','2026-08-19 15:49:43'),
(1038,4,0,'mtrip_android','Mtrip App',2,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 2}',200,'{"code": 0}',504,'Pixel 8','48.135.163.164','2026-08-24 03:56:43'),
(1039,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',569,'Web','27.90.75.5','2026-08-27 14:21:43'),
(1040,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',687,'iPhone 15','74.6.145.166','2026-08-24 10:00:43'),
(1041,1,0,'mtrip_h5','Mtrip App',1,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',273,'iPhone 15','83.190.83.179','2026-08-17 08:25:43'),
(1042,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',1056,'iPhone 15','4.9.39.160','2026-08-19 17:01:43'),
(1043,3,0,'mtrip_ios','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',614,'iPhone 15','80.83.15.226','2026-08-18 19:06:43'),
(1044,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',978,'Web','173.80.79.252','2026-08-18 11:18:43'),
(1045,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 15}',500,'{"code": 0}',1074,'iPhone 15','185.17.157.173','2026-08-19 16:50:43'),
(1046,4,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',226,'Pixel 8','69.179.96.212','2026-08-28 12:16:43'),
(1047,3,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',648,'Pixel 8','50.219.192.241','2026-08-27 00:27:43'),
(1048,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',16,'iPhone 15','211.106.120.215','2026-08-22 13:37:43'),
(1049,4,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',326,'iPhone 15','33.150.81.199','2026-08-19 01:34:43'),
(1050,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 19}',200,'{"code": 0}',688,'iPhone 15','142.217.4.73','2026-08-18 20:48:43'),
(1051,1,0,'mtrip_android','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 3}',200,'{"code": 0}',375,'Pixel 8','39.85.82.126','2026-08-17 04:40:43'),
(1052,3,0,'mtrip_ios','Mtrip App',2,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',432,'Pixel 8','43.23.99.224','2026-08-21 14:58:43'),
(1053,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',332,'Pixel 8','150.201.111.213','2026-08-28 14:41:43'),
(1054,3,0,'mtrip_android','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',173,'Web','194.229.106.182','2026-08-17 07:09:43'),
(1055,4,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 1}',404,'{"code": 0}',821,'Web','120.190.200.208','2026-08-29 00:12:43'),
(1056,4,0,'mtrip_h5','Mtrip App',3,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',260,'Web','118.18.247.88','2026-08-29 19:37:43'),
(1057,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',337,'Pixel 8','205.218.68.130','2026-08-24 13:55:43'),
(1058,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',596,'Pixel 8','20.60.137.17','2026-08-15 15:01:43'),
(1059,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 1}',401,'{"code": 0}',70,'Pixel 8','195.255.52.92','2026-08-28 20:38:43'),
(1060,1,0,'mtrip_ios','Mtrip App',1,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 11}',200,'{"code": 0}',677,'Pixel 8','178.168.177.7','2026-08-27 20:47:43'),
(1061,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',649,'Pixel 8','167.41.48.53','2026-08-26 13:21:43'),
(1062,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',1153,'iPhone 15','83.156.123.191','2026-08-18 01:53:43'),
(1063,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',519,'Pixel 8','39.118.128.56','2026-08-23 04:57:43'),
(1064,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',1141,'iPhone 15','159.39.14.228','2026-08-17 15:43:43'),
(1065,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',1112,'Pixel 8','161.3.1.22','2026-08-17 21:08:43'),
(1066,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',1070,'Web','215.187.47.216','2026-08-27 01:41:43'),
(1067,1,0,'mtrip_android','Mtrip App',1,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',411,'Web','213.34.224.242','2026-08-16 17:41:43'),
(1068,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 7}',200,'{"code": 0}',1097,'Pixel 8','207.218.132.148','2026-08-21 23:16:43'),
(1069,1,0,'mtrip_h5','Mtrip App',3,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 8}',200,'{"code": 0}',119,'iPhone 15','205.17.7.37','2026-08-25 04:34:43'),
(1070,1,0,'mtrip_android','Mtrip App',2,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',164,'iPhone 15','1.66.248.214','2026-08-16 14:41:43'),
(1071,3,0,'mtrip_android','Mtrip App',3,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',761,'Pixel 8','93.225.143.248','2026-08-17 08:32:43'),
(1072,1,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',47,'Web','200.250.157.87','2026-08-19 13:04:43'),
(1073,1,0,'mtrip_h5','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',120,'Pixel 8','129.35.231.91','2026-08-24 13:52:43'),
(1074,1,0,'mtrip_ios','Mtrip App',2,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 3}',200,'{"code": 0}',392,'Web','143.131.180.98','2026-08-25 07:53:43'),
(1075,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',332,'Pixel 8','28.223.183.157','2026-08-23 05:41:43'),
(1076,1,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 19}',404,'{"code": 0}',76,'iPhone 15','15.162.175.247','2026-08-17 15:27:43'),
(1077,3,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',201,'Pixel 8','20.130.237.110','2026-08-20 10:37:43'),
(1078,3,0,'mtrip_ios','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',52,'Web','93.232.154.63','2026-08-20 00:54:43'),
(1079,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',710,'iPhone 15','207.151.44.9','2026-08-16 17:34:43'),
(1080,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 2}',200,'{"code": 0}',502,'Pixel 8','182.51.147.139','2026-08-22 10:47:43');

-- 存储配置
INSERT INTO `sys_storage` (`id`,`site_id`,`driver`,`storage_name`,`bucket`,`region`,`access_key`,`secret_key`,`cdn_domain`,`path_prefix`,`expire_days`,`is_default`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'s3','AWS S3 主存储','mtrip-assets','eu-west-3','2kJ4IYTdmx1hCpE44LgOcZW+r5zAv9gDnmyRZM5ftL2CMcQSOjT5NVe+bRUzrg==','bHLmShdgmu+qmDVP6YmFkKE3dU1/P1FO/WSJd1VOSd7Sru5ql0yTJCivqIhfU8WepcMI','https://cdn.mtrip.test','prod/',0,1,1,'主存储(密钥已 AES 加密)','2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,0,'local','本地存储(测试)','','','','','','uploads/',0,0,1,'本地磁盘存储','2025-11-03 04:19:43','2025-11-03 04:19:43');

-- 支付渠道
INSERT INTO `sys_pay_channel` (`id`,`site_id`,`channel_name`,`channel_code`,`api_key`,`merchant_no`,`webhook_url`,`fee_rate`,`min_amount`,`max_amount`,`currencies`,`split_enabled`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'Stripe','stripe','F/JG3MaIbRD5In/eX9RY9SLgC6cXRLdnB+dwQzqF9VkE53ua2M+S8ItsmEJjOCG6dVT81Lil','acct_1Ptest','https://api.mtrip.test/webhook/stripe',2.90,1.00,0.00,'["EUR", "USD", "GBP"]',1,1,'Stripe 测试渠道','2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,0,'PayPal','paypal','tetsxEfBHvMb2pz2GiJe0/EuvwF/uCkUKn9uebfT9S2YnfJt2l8+fIVAHHPt2h9JNMjc7Xk=','paypal_merchant_test','https://api.mtrip.test/webhook/paypal',3.40,1.00,0.00,'["EUR", "USD"]',0,1,'PayPal 测试渠道','2025-11-03 04:19:43','2025-11-03 04:19:43');

-- 短信渠道与模板
INSERT INTO `sys_sms_channel` (`id`,`site_id`,`provider_name`,`provider_code`,`api_key`,`account_sid`,`sign_name`,`region_whitelist`,`code_expire_sec`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'Twilio','twilio','5C1Y1Snslv9c/L03AadtfQ91cHG8WBHufor4SyTX3AReoe3MsXBuBSpj78cBVHzoCI4=','ACexample0001','Mtrip','["FR", "NL", "BE"]',300,1,'国际短信主渠道','2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,0,'MessageBird','messagebird','quKVrQQE/w1B5WGsOMZtdqSMuBxXcRChVpsEMn8QuvV6zgT2oWNduoLipPCa14nu','','Mtrip',NULL,300,2,'备用渠道(当前停用)','2025-11-03 04:19:43','2025-11-03 04:19:43');
INSERT INTO `sys_sms_template` (`id`,`site_id`,`channel_id`,`template_name`,`template_type`,`content`,`variables`,`status`,`created_at`,`updated_at`) VALUES
(101,0,101,'注册验证码',1,'Your Mtrip verification code is {code}, valid for 5 minutes.','["code"]',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,0,101,'订单确认通知',2,'Your booking {order_no} is confirmed. Check-in: {date}.','["order_no", "date"]',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(103,0,101,'退款完成通知',3,'Refund for order {order_no} has been processed.','["order_no"]',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(104,0,101,'商户审核结果通知',4,'Your merchant application has been {result}.','["result"]',1,'2025-11-03 04:19:43','2025-11-03 04:19:43');

-- 地图配置 / 客户端密钥 / 权限模板
INSERT INTO `sys_map_config` (`id`,`site_id`,`provider`,`api_key`,`map_language`,`default_zoom`,`geocode_enabled`,`locate_enabled`,`region_limit`,`status`,`created_at`,`updated_at`) VALUES
(101,0,'google','1DuAisigx+mFHFNlVnOXAdASLnWmD+W1O0URLRnqkwApL3YvkMmQUrfiU7N4LLX2','en',12,1,1,'["FR", "NL", "BE"]',1,'2025-11-03 04:19:43','2025-11-03 04:19:43');
INSERT INTO `sys_client_perm_template` (`id`,`site_id`,`template_name`,`template_type`,`description`,`rule_mode`,`api_list`,`status`,`created_at`,`updated_at`) VALUES
(101,0,'C 端默认白名单',1,'仅开放商品浏览与下单相关接口',1,'["/api/v1/goods/*", "/api/v1/order/create", "/api/v1/user/profile"]',1,'2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,0,'内部调试全放行',1,'调试用,禁用状态',2,'[]',2,'2025-11-03 04:19:43','2025-11-03 04:19:43');
INSERT INTO `sys_client` (`id`,`site_id`,`client_name`,`client_id`,`client_secret`,`client_type`,`perm_template_id`,`qps_limit`,`ip_whitelist`,`status`,`expire_at`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'Mtrip Android','mtrip_android','EQLKz1uE11fa1czRAMgyZKE6RVpAcqHcDCky8agmWRBmTyP2uGrtIFoFXnr2Zcs1gqYjAr/3',1,101,50,'',1,NULL,'Android 客户端','2025-11-03 04:19:43','2025-11-03 04:19:43'),
(102,0,'Mtrip iOS','mtrip_ios','12QjeZuPaHuYWIaiCM147ZeBg0wleSNxIbh4Kn+dS28173sl5iySYuQWqV4sOSeRXQg=',2,101,50,'',1,NULL,'iOS 客户端','2025-11-03 04:19:43','2025-11-03 04:19:43'),
(103,0,'Mtrip H5','mtrip_h5','00cwYsKen3wd8j8YLfQ2feklI/ZIqOpx2KkrcEjYk29uS1jKU8JA4Kot+zMeJvyNag==',3,101,20,'',2,NULL,'H5(已停用)','2025-11-03 04:19:43','2025-11-03 04:19:43');

-- 站点差异化配置(站点 4 巴黎)
INSERT INTO `sys_site_config` (`id`,`site_id`,`config_group`,`config_key`,`config_value`,`config_name`,`created_at`,`updated_at`) VALUES
(101,4,'operate','hotel_commission_rate','0.12','酒店类目佣金率','2026-02-11 04:19:43','2026-02-11 04:19:43'),
(102,4,'operate','ticket_commission_rate','0.08','门票类目佣金率','2026-02-11 04:19:43','2026-02-11 04:19:43'),
(103,4,'page','home_banner_count','5','首页 Banner 数量','2026-02-11 04:19:43','2026-02-11 04:19:43');

-- 特性开关(站点 4 覆盖全局默认)
INSERT INTO `sys_feature_flag` (`id`,`site_id`,`flag_key`,`label`,`description`,`enabled`,`sort`,`created_at`,`updated_at`) VALUES
(101,4,'flash_sale','限时秒杀','巴黎站开启秒杀活动',1,1,'2026-02-11 04:19:43','2026-02-11 04:19:43'),
(102,4,'multi_currency','多币种展示','巴黎站开启多币种',1,2,'2026-02-11 04:19:43','2026-02-11 04:19:43'),
(103,4,'dynamic_pricing','动态定价','巴黎站关闭动态定价',0,3,'2026-02-11 04:19:43','2026-02-11 04:19:43');

-- App 主题
INSERT INTO `app_theme` (`id`,`site_id`,`theme_name`,`description`,`thumbnail`,`assets`,`is_default`,`priority`,`start_time`,`end_time`,`status`,`created_at`,`updated_at`) VALUES
(101,4,'巴黎夏日主题','夏季活动主题','https://cdn.mtrip.test/theme/summer.png','{"splash": "", "logo": "", "homeHeader": "", "navAccent": "#ff7a45"}',0,10,'2026-07-31 04:19:43','2026-10-29 04:19:43',1,'2026-06-01 04:19:43','2026-07-31 04:19:43'),
(102,4,'巴黎冬季节日主题','未启用的主题','','{"navAccent": "#1677ff"}',0,5,NULL,NULL,2,'2026-06-01 04:19:43','2026-06-01 04:19:43');

-- 文件库
INSERT INTO `sys_file` (`id`,`site_id`,`storage_id`,`file_name`,`file_path`,`file_url`,`file_type`,`mime_type`,`file_size`,`biz_type`,`uploader_id`,`created_at`,`updated_at`) VALUES
(1001,4,101,'merchant_license_1.jpg','prod/merchant/2026/license_1.jpg','https://cdn.mtrip.test/prod/merchant/license_1.jpg',1,'image/jpeg',293949,'merchant',101,'2026-07-26 20:48:43','2026-06-03 07:15:43'),
(1002,4,101,'merchant_license_2.jpg','prod/merchant/2026/license_2.jpg','https://cdn.mtrip.test/prod/merchant/license_2.jpg',1,'image/jpeg',1642780,'merchant',101,'2026-07-19 21:52:43','2026-08-05 11:21:43'),
(1003,4,101,'merchant_license_3.jpg','prod/merchant/2026/license_3.jpg','https://cdn.mtrip.test/prod/merchant/license_3.jpg',1,'image/jpeg',1436507,'merchant',101,'2026-07-05 10:30:43','2026-07-01 13:12:43'),
(1004,4,101,'merchant_license_4.jpg','prod/merchant/2026/license_4.jpg','https://cdn.mtrip.test/prod/merchant/license_4.jpg',1,'image/jpeg',169804,'merchant',101,'2026-07-09 15:21:43','2026-07-14 20:21:43'),
(1005,4,101,'merchant_license_5.jpg','prod/merchant/2026/license_5.jpg','https://cdn.mtrip.test/prod/merchant/license_5.jpg',1,'image/jpeg',1884021,'merchant',101,'2026-08-24 06:19:43','2026-06-27 18:07:43'),
(1006,4,101,'merchant_license_6.jpg','prod/merchant/2026/license_6.jpg','https://cdn.mtrip.test/prod/merchant/license_6.jpg',1,'image/jpeg',1001242,'merchant',101,'2026-07-07 16:30:43','2026-06-02 21:37:43');
