-- ============================================================
-- 系统域:管理员 / 角色 / 日志 / 平台配置
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_system`;


-- 角色
INSERT INTO `sys_role` (`id`,`site_id`,`role_name`,`role_type`,`description`,`status`,`created_at`,`updated_at`) VALUES
(101,4,'站点管理员',2,'巴黎站点全权限',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,4,'运营专员',2,'商户入驻审核 + 订单运营',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(103,4,'财务专员',2,'结算、对账、提现审核',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(104,4,'客服专员',2,'终端用户、客服会话、帮助中心',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(105,0,'只读审计员',1,'全平台只读,用于审计',1,'2025-11-20 05:14:11','2025-11-20 05:14:11');

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
(101,4,'site_admin','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','站点管理员','DchfnZTu+NvLoAyo8Pe4o+qVnFBrzVV+ZrPtutsvggSK4YjHYUIIUg==','site_admin@mtrip.test','',0,1,0,'2026-09-12 15:08:11','10.0.0.139','巴黎站点管理员(用于验证站点隔离)','2025-11-20 05:14:11','2026-09-11 11:17:11'),
(102,4,'operator','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','运营专员','+gy8P8z8K+PlOg6dEQqSSrw8uwT3jCZa1HLnQTitsAASiYoAJd5j2Q==','operator@mtrip.test','',0,1,0,'2026-09-15 22:43:11','10.0.9.143','负责商户入驻审核','2025-11-20 05:14:11','2026-09-10 12:41:11'),
(103,4,'finance','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','财务专员','uzWmsnaLQCEqf5US3DPkA00553/lbDE+K4MriMTzISa3s1UtVsi+Qg==','finance@mtrip.test','',0,1,0,'2026-09-12 00:32:11','10.0.2.39','负责结算与提现审核','2025-11-20 05:14:11','2026-09-11 21:33:11'),
(104,4,'support','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','客服专员','9Crgh+31JUzc03oVp9DB7Pi0MQp2iAOPicIvJ0u4VsuQKM9fWo9Ylw==','support@mtrip.test','',0,1,0,'2026-09-13 21:55:11','10.0.5.18','负责终端用户与会话','2025-11-20 05:14:11','2026-09-15 11:03:11'),
(105,0,'auditor','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','只读审计员','c10C8mFSvJIDCSzL+WXqkRIsKSAp/fvK86g7Kf6qPLg/sDVG/P3I5A==','auditor@mtrip.test','',0,1,0,'2026-09-09 23:21:11','10.0.4.127','全平台只读','2025-11-20 05:14:11','2026-09-13 14:49:11'),
(106,3,'fr_admin','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','法国站点管理员','7uXsk8YtUL1pOHwGazsAkgzzuTPcmItMV07hegIx+c8rah0YLLeJgA==','fr_admin@mtrip.test','',0,1,0,'2026-09-14 20:13:11','10.0.8.120','法国站点(用于跨站点隔离对比)','2025-11-20 05:14:11','2026-09-13 12:14:11'),
(107,4,'disabled_admin','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','已禁用账号','5O0v/BqMfSesoSCwHa13RFdND07f2qlqBg1IuJ7LMLTG0wt+Hnbh5Q==','disabled_admin@mtrip.test','',0,2,0,NULL,'10.0.0.189','状态=2,用于验证禁用账号不可登录','2025-11-20 05:14:11','2026-09-12 20:56:11'),
(108,7,'mm_admin','$2y$10$1cynUqkfyTJgT5GOGIijdu7sCIK4vdLEL0HffZ.zXkVVjP/C8.D6u','缅甸站点管理员','pwMWcimxX8hG69qOn9CNjJlb1OQnRvf1ZUHZKnDfyasl0XnP5wjIaw==','mm_admin@mtrip.test','',0,1,0,'2026-09-13 09:38:11','10.0.5.28','仰光站点(MMK 货币,用于多币种/站点隔离验证)','2025-11-20 05:14:11','2026-09-13 03:59:11');

-- 账号 - 角色关联
INSERT INTO `sys_admin_role` (`admin_id`,`role_id`,`created_at`) VALUES
(101,101,'2025-11-20 05:14:11'),
(102,102,'2025-11-20 05:14:11'),
(103,103,'2025-11-20 05:14:11'),
(104,104,'2025-11-20 05:14:11'),
(105,105,'2025-11-20 05:14:11'),
(106,101,'2025-11-20 05:14:11'),
(107,101,'2025-11-20 05:14:11'),
(108,101,'2025-11-20 05:14:11');

-- 管理员登录日志(含失败/锁定,用于验证登录日志筛选)
INSERT INTO `sys_admin_login_log` (`id`,`admin_id`,`username`,`site_id`,`login_ip`,`user_agent`,`status`,`remark`,`created_at`) VALUES
(1001,101,'site_admin',4,'37.166.6.136','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-20 10:42:11'),
(1002,101,'site_admin',4,'192.75.206.193','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-24 19:38:11'),
(1003,107,'disabled_admin',4,'179.144.174.158','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',2,'密码错误','2026-09-09 10:59:11'),
(1004,105,'auditor',4,'64.138.16.100','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-10 00:19:11'),
(1005,104,'support',4,'158.210.18.21','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-09-15 19:48:11'),
(1006,101,'site_admin',4,'45.79.21.224','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-28 16:09:11'),
(1007,102,'operator',4,'207.8.171.142','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-17 22:26:11'),
(1008,107,'disabled_admin',4,'220.239.88.104','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-09-04 19:16:11'),
(1009,105,'auditor',4,'1.232.250.156','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',2,'密码错误','2026-09-04 03:20:11'),
(1010,108,'mm_admin',4,'135.238.214.8','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-26 19:37:11'),
(1011,105,'auditor',4,'122.149.237.226','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-21 18:20:11'),
(1012,101,'site_admin',4,'191.140.104.71','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-09-09 07:50:11'),
(1013,104,'support',4,'179.137.204.2','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-09-10 23:18:11'),
(1014,106,'fr_admin',4,'206.111.238.80','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-09-09 12:54:11'),
(1015,101,'site_admin',4,'51.23.188.82','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-18 13:43:11'),
(1016,103,'finance',4,'183.89.199.122','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-30 01:44:11'),
(1017,104,'support',4,'93.100.182.85','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',3,'账号锁定','2026-08-24 10:13:11'),
(1018,106,'fr_admin',4,'137.230.112.91','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-09-09 03:35:11'),
(1019,104,'support',4,'152.85.131.231','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-16 17:08:11'),
(1020,105,'auditor',4,'98.116.230.191','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-23 14:49:11'),
(1021,108,'mm_admin',4,'166.170.132.72','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-21 05:12:11'),
(1022,101,'site_admin',4,'78.242.101.194','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-28 13:02:11'),
(1023,106,'fr_admin',4,'5.158.119.54','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-29 13:58:11'),
(1024,104,'support',4,'17.155.194.217','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-08-21 15:43:11'),
(1025,105,'auditor',4,'220.197.41.172','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-09-15 10:16:11'),
(1026,108,'mm_admin',4,'180.91.151.100','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-08-22 02:55:11'),
(1027,108,'mm_admin',4,'32.175.35.195','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',2,'密码错误','2026-09-15 11:28:11'),
(1028,102,'operator',4,'218.193.137.139','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-09-14 09:11:11'),
(1029,106,'fr_admin',4,'100.221.227.133','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-29 14:10:11'),
(1030,107,'disabled_admin',4,'101.89.28.125','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-09-12 10:34:11'),
(1031,103,'finance',4,'177.238.139.228','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',4,'账号禁用','2026-08-19 03:15:11'),
(1032,104,'support',4,'15.45.240.84','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-09 12:20:11'),
(1033,107,'disabled_admin',4,'47.146.113.112','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-09-14 23:49:11'),
(1034,102,'operator',4,'154.192.193.114','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-29 07:09:11'),
(1035,108,'mm_admin',4,'194.43.144.190','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-18 05:44:11'),
(1036,106,'fr_admin',4,'148.112.32.96','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-28 10:11:11'),
(1037,104,'support',4,'55.197.154.50','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-29 20:30:11'),
(1038,107,'disabled_admin',4,'129.81.112.229','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-28 23:50:11'),
(1039,101,'site_admin',4,'195.97.59.152','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-23 15:26:11'),
(1040,101,'site_admin',4,'162.226.170.83','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',2,'密码错误','2026-09-07 13:59:11'),
(1041,104,'support',4,'116.204.174.89','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-16 07:33:11'),
(1042,107,'disabled_admin',4,'50.134.190.11','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-30 01:00:11'),
(1043,102,'operator',4,'216.179.217.13','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-21 20:08:11'),
(1044,103,'finance',4,'195.145.65.234','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-09-03 13:48:11'),
(1045,106,'fr_admin',4,'138.220.66.108','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-21 11:50:11'),
(1046,108,'mm_admin',4,'21.160.226.251','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-09-12 20:09:11'),
(1047,107,'disabled_admin',4,'105.251.111.111','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-21 17:22:11'),
(1048,106,'fr_admin',4,'222.7.63.230','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-27 05:15:11'),
(1049,103,'finance',4,'39.157.68.9','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-11 19:43:11'),
(1050,104,'support',4,'142.188.19.33','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-03 21:05:11'),
(1051,102,'operator',4,'211.149.236.24','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-11 17:17:11'),
(1052,103,'finance',4,'98.235.33.172','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-20 01:03:11'),
(1053,103,'finance',4,'130.129.201.149','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-08-18 05:08:11'),
(1054,105,'auditor',4,'30.35.132.175','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-29 14:32:11'),
(1055,107,'disabled_admin',4,'123.239.141.180','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-06 09:50:11'),
(1056,102,'operator',4,'152.194.134.204','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4',1,'登录成功','2026-08-16 17:21:11'),
(1057,102,'operator',4,'20.200.215.113','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-08-20 15:09:11'),
(1058,102,'operator',4,'87.87.138.5','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',1,'登录成功','2026-09-08 20:05:11'),
(1059,102,'operator',4,'69.219.68.228','Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0',1,'登录成功','2026-09-03 09:28:11'),
(1060,106,'fr_admin',4,'86.186.43.24','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',2,'密码错误','2026-08-29 08:36:11');

-- 系统操作日志
INSERT INTO `sys_operation_log` (`id`,`admin_id`,`admin_name`,`site_id`,`module`,`action`,`content`,`request_url`,`request_method`,`client_ip`,`user_agent`,`status_code`,`created_at`) VALUES
(1001,108,'缅甸站点管理员',4,'merchant','blacklist','{"target": 2176, "result": "ok"}','/api/merchant/blacklist','PUT','10.0.6.98','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-06 09:48:11'),
(1002,108,'缅甸站点管理员',4,'system','reset_pwd','{"target": 2350, "result": "ok"}','/api/system/reset_pwd','POST','10.0.0.157','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-10 00:09:11'),
(1003,107,'已禁用账号',4,'user','blacklist','{"target": 7820, "result": "ok"}','/api/user/blacklist','DELETE','10.0.8.222','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 16:06:11'),
(1004,106,'法国站点管理员',4,'system','add_admin','{"target": 5944, "result": "ok"}','/api/system/add_admin','PUT','10.0.6.188','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-10 13:38:11'),
(1005,103,'财务专员',4,'order','export','{"target": 3596, "result": "ok"}','/api/order/export','PUT','10.0.5.67','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 18:32:11'),
(1006,108,'缅甸站点管理员',4,'user','adjust_balance','{"target": 6672, "result": "ok"}','/api/user/adjust_balance','PUT','10.0.3.24','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 10:24:11'),
(1007,101,'站点管理员',4,'goods','off_shelf','{"target": 8118, "result": "ok"}','/api/goods/off_shelf','POST','10.0.2.27','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 14:54:11'),
(1008,108,'缅甸站点管理员',4,'order','export','{"target": 4864, "result": "ok"}','/api/order/export','DELETE','10.0.2.175','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 10:49:11'),
(1009,104,'客服专员',4,'system','edit_role','{"target": 8915, "result": "ok"}','/api/system/edit_role','PUT','10.0.1.209','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-20 10:06:11'),
(1010,101,'站点管理员',4,'order','cancel','{"target": 3135, "result": "ok"}','/api/order/cancel','PUT','10.0.0.196','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-09 15:57:11'),
(1011,108,'缅甸站点管理员',4,'finance','settle_confirm','{"target": 6517, "result": "ok"}','/api/finance/settle_confirm','PUT','10.0.7.225','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-08-25 21:25:11'),
(1012,104,'客服专员',4,'user','blacklist','{"target": 801, "result": "ok"}','/api/user/blacklist','PUT','10.0.9.217','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-22 03:13:11'),
(1013,107,'已禁用账号',4,'system','edit_role','{"target": 6446, "result": "ok"}','/api/system/edit_role','POST','10.0.3.186','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-16 13:09:11'),
(1014,104,'客服专员',4,'user','blacklist','{"target": 826, "result": "ok"}','/api/user/blacklist','PUT','10.0.4.254','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 12:13:11'),
(1015,108,'缅甸站点管理员',4,'merchant','audit','{"target": 1673, "result": "ok"}','/api/merchant/audit','POST','10.0.5.95','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-12 16:39:11'),
(1016,107,'已禁用账号',4,'merchant','suspend','{"target": 6262, "result": "ok"}','/api/merchant/suspend','DELETE','10.0.0.100','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-06 09:48:11'),
(1017,105,'只读审计员',4,'user','blacklist','{"target": 1232, "result": "ok"}','/api/user/blacklist','PUT','10.0.4.214','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-11 03:45:11'),
(1018,101,'站点管理员',4,'merchant','blacklist','{"target": 703, "result": "ok"}','/api/merchant/blacklist','PUT','10.0.7.217','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-11 14:50:11'),
(1019,101,'站点管理员',4,'system','add_admin','{"target": 580, "result": "ok"}','/api/system/add_admin','POST','10.0.1.20','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-09-08 06:24:11'),
(1020,105,'只读审计员',4,'finance','withdraw_pay','{"target": 7426, "result": "ok"}','/api/finance/withdraw_pay','POST','10.0.3.200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-12 22:04:11'),
(1021,102,'运营专员',4,'marketing','add_coupon','{"target": 2261, "result": "ok"}','/api/marketing/add_coupon','POST','10.0.0.91','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-02 10:03:11'),
(1022,101,'站点管理员',4,'user','freeze','{"target": 2443, "result": "ok"}','/api/user/freeze','POST','10.0.0.243','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-27 11:29:11'),
(1023,106,'法国站点管理员',4,'user','freeze','{"target": 5912, "result": "ok"}','/api/user/freeze','DELETE','10.0.5.78','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-08 21:51:11'),
(1024,101,'站点管理员',4,'order','cancel','{"target": 5024, "result": "ok"}','/api/order/cancel','PUT','10.0.6.151','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-15 17:12:11'),
(1025,102,'运营专员',4,'user','freeze','{"target": 2692, "result": "ok"}','/api/user/freeze','POST','10.0.8.111','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-06 05:17:11'),
(1026,103,'财务专员',4,'marketing','stop_coupon','{"target": 5279, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.7.209','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 15:25:11'),
(1027,105,'只读审计员',4,'goods','edit_stock','{"target": 1119, "result": "ok"}','/api/goods/edit_stock','DELETE','10.0.8.37','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-27 08:36:11'),
(1028,107,'已禁用账号',4,'goods','audit','{"target": 179, "result": "ok"}','/api/goods/audit','DELETE','10.0.6.186','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-15 03:36:11'),
(1029,101,'站点管理员',4,'marketing','add_coupon','{"target": 823, "result": "ok"}','/api/marketing/add_coupon','PUT','10.0.7.200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-23 17:30:11'),
(1030,105,'只读审计员',4,'system','add_admin','{"target": 8673, "result": "ok"}','/api/system/add_admin','PUT','10.0.9.107','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 07:06:11'),
(1031,107,'已禁用账号',4,'order','export','{"target": 3364, "result": "ok"}','/api/order/export','PUT','10.0.8.143','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-22 10:27:11'),
(1032,107,'已禁用账号',4,'system','reset_pwd','{"target": 3021, "result": "ok"}','/api/system/reset_pwd','POST','10.0.1.204','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 20:03:11'),
(1033,102,'运营专员',4,'system','edit_role','{"target": 6158, "result": "ok"}','/api/system/edit_role','POST','10.0.1.101','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-07 19:19:11'),
(1034,107,'已禁用账号',4,'user','adjust_balance','{"target": 8800, "result": "ok"}','/api/user/adjust_balance','DELETE','10.0.6.141','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-16 02:56:11'),
(1035,103,'财务专员',4,'merchant','impersonate','{"target": 5653, "result": "ok"}','/api/merchant/impersonate','DELETE','10.0.5.60','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-15 01:06:11'),
(1036,101,'站点管理员',4,'goods','off_shelf','{"target": 2281, "result": "ok"}','/api/goods/off_shelf','DELETE','10.0.2.52','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-09-11 12:46:11'),
(1037,102,'运营专员',4,'marketing','stop_coupon','{"target": 7634, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.8.73','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 10:28:11'),
(1038,106,'法国站点管理员',4,'marketing','add_coupon','{"target": 2295, "result": "ok"}','/api/marketing/add_coupon','PUT','10.0.3.36','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 21:57:11'),
(1039,105,'只读审计员',4,'finance','withdraw_pay','{"target": 3406, "result": "ok"}','/api/finance/withdraw_pay','DELETE','10.0.3.56','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-05 11:47:11'),
(1040,107,'已禁用账号',4,'system','reset_pwd','{"target": 2739, "result": "ok"}','/api/system/reset_pwd','POST','10.0.4.157','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-03 00:00:11'),
(1041,102,'运营专员',4,'merchant','blacklist','{"target": 9686, "result": "ok"}','/api/merchant/blacklist','POST','10.0.3.168','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 23:20:11'),
(1042,104,'客服专员',4,'goods','audit','{"target": 8480, "result": "ok"}','/api/goods/audit','PUT','10.0.5.150','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 03:29:11'),
(1043,103,'财务专员',4,'marketing','add_coupon','{"target": 3593, "result": "ok"}','/api/marketing/add_coupon','DELETE','10.0.1.112','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-09-07 06:11:11'),
(1044,102,'运营专员',4,'system','reset_pwd','{"target": 3193, "result": "ok"}','/api/system/reset_pwd','POST','10.0.2.116','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-15 15:02:11'),
(1045,105,'只读审计员',4,'marketing','stop_coupon','{"target": 7764, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.3.172','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-15 20:42:11'),
(1046,103,'财务专员',4,'goods','off_shelf','{"target": 1401, "result": "ok"}','/api/goods/off_shelf','DELETE','10.0.0.129','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-14 15:03:11'),
(1047,101,'站点管理员',4,'merchant','impersonate','{"target": 8766, "result": "ok"}','/api/merchant/impersonate','DELETE','10.0.4.221','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-08 21:16:11'),
(1048,108,'缅甸站点管理员',4,'goods','edit_stock','{"target": 6924, "result": "ok"}','/api/goods/edit_stock','POST','10.0.6.219','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-19 09:46:11'),
(1049,108,'缅甸站点管理员',4,'marketing','add_coupon','{"target": 267, "result": "ok"}','/api/marketing/add_coupon','DELETE','10.0.2.153','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 05:46:11'),
(1050,105,'只读审计员',4,'marketing','stop_coupon','{"target": 3863, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.9.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-22 09:09:11'),
(1051,108,'缅甸站点管理员',4,'finance','settle_confirm','{"target": 9608, "result": "ok"}','/api/finance/settle_confirm','DELETE','10.0.3.225','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-17 20:53:11'),
(1052,106,'法国站点管理员',4,'order','cancel','{"target": 8469, "result": "ok"}','/api/order/cancel','POST','10.0.9.50','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 04:35:11'),
(1053,103,'财务专员',4,'goods','edit_stock','{"target": 2527, "result": "ok"}','/api/goods/edit_stock','POST','10.0.3.250','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-08-24 02:03:11'),
(1054,105,'只读审计员',4,'finance','withdraw_pay','{"target": 8939, "result": "ok"}','/api/finance/withdraw_pay','PUT','10.0.9.216','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-11 21:27:11'),
(1055,105,'只读审计员',4,'marketing','stop_coupon','{"target": 304, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.6.57','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-25 16:56:11'),
(1056,108,'缅甸站点管理员',4,'marketing','stop_coupon','{"target": 9911, "result": "ok"}','/api/marketing/stop_coupon','POST','10.0.6.146','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-01 13:13:11'),
(1057,101,'站点管理员',4,'system','add_admin','{"target": 5973, "result": "ok"}','/api/system/add_admin','POST','10.0.2.193','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-18 00:19:11'),
(1058,107,'已禁用账号',4,'finance','settle_confirm','{"target": 2802, "result": "ok"}','/api/finance/settle_confirm','PUT','10.0.6.109','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-10 00:23:11'),
(1059,106,'法国站点管理员',4,'system','reset_pwd','{"target": 6076, "result": "ok"}','/api/system/reset_pwd','POST','10.0.2.147','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-09 00:46:11'),
(1060,104,'客服专员',4,'user','freeze','{"target": 682, "result": "ok"}','/api/user/freeze','PUT','10.0.6.129','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-10 01:07:11'),
(1061,105,'只读审计员',4,'marketing','stop_coupon','{"target": 5972, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.5.26','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-26 18:10:11'),
(1062,104,'客服专员',4,'system','add_admin','{"target": 6959, "result": "ok"}','/api/system/add_admin','POST','10.0.2.60','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 13:23:11'),
(1063,102,'运营专员',4,'user','freeze','{"target": 664, "result": "ok"}','/api/user/freeze','PUT','10.0.4.148','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-24 11:51:11'),
(1064,101,'站点管理员',4,'user','blacklist','{"target": 2081, "result": "ok"}','/api/user/blacklist','POST','10.0.6.198','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-23 11:04:11'),
(1065,101,'站点管理员',4,'goods','audit','{"target": 1066, "result": "ok"}','/api/goods/audit','POST','10.0.8.126','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-12 20:12:11'),
(1066,104,'客服专员',4,'marketing','stop_coupon','{"target": 3990, "result": "ok"}','/api/marketing/stop_coupon','PUT','10.0.4.204','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-14 23:01:11'),
(1067,101,'站点管理员',4,'system','reset_pwd','{"target": 8268, "result": "ok"}','/api/system/reset_pwd','PUT','10.0.4.110','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-07 17:01:11'),
(1068,108,'缅甸站点管理员',4,'finance','settle_confirm','{"target": 1974, "result": "ok"}','/api/finance/settle_confirm','POST','10.0.3.148','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-20 04:10:11'),
(1069,107,'已禁用账号',4,'merchant','blacklist','{"target": 3965, "result": "ok"}','/api/merchant/blacklist','DELETE','10.0.2.210','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-16 14:55:11'),
(1070,108,'缅甸站点管理员',4,'user','adjust_balance','{"target": 9123, "result": "ok"}','/api/user/adjust_balance','PUT','10.0.0.54','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-29 12:44:11'),
(1071,103,'财务专员',4,'order','export','{"target": 5437, "result": "ok"}','/api/order/export','POST','10.0.8.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-26 18:24:11'),
(1072,107,'已禁用账号',4,'system','reset_pwd','{"target": 4948, "result": "ok"}','/api/system/reset_pwd','POST','10.0.4.156','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-03 04:05:11'),
(1073,102,'运营专员',4,'goods','off_shelf','{"target": 3872, "result": "ok"}','/api/goods/off_shelf','PUT','10.0.0.93','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-07 20:33:11'),
(1074,105,'只读审计员',4,'marketing','add_coupon','{"target": 9064, "result": "ok"}','/api/marketing/add_coupon','POST','10.0.8.244','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-27 05:29:11'),
(1075,105,'只读审计员',4,'user','blacklist','{"target": 7676, "result": "ok"}','/api/user/blacklist','PUT','10.0.9.32','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',500,'2026-09-04 22:07:11'),
(1076,104,'客服专员',4,'user','adjust_balance','{"target": 1810, "result": "ok"}','/api/user/adjust_balance','PUT','10.0.6.209','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-08-28 21:19:11'),
(1077,101,'站点管理员',4,'finance','withdraw_pay','{"target": 7457, "result": "ok"}','/api/finance/withdraw_pay','POST','10.0.5.204','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-04 03:51:11'),
(1078,106,'法国站点管理员',4,'marketing','add_coupon','{"target": 5825, "result": "ok"}','/api/marketing/add_coupon','POST','10.0.1.58','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-07 19:55:11'),
(1079,105,'只读审计员',4,'goods','audit','{"target": 6567, "result": "ok"}','/api/goods/audit','POST','10.0.0.95','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',403,'2026-08-19 16:50:11'),
(1080,105,'只读审计员',4,'user','blacklist','{"target": 7318, "result": "ok"}','/api/user/blacklist','PUT','10.0.2.150','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',200,'2026-09-02 02:27:11');

-- 接口访问日志
INSERT INTO `sys_api_access_log` (`id`,`site_id`,`client_pk_id`,`client_id`,`client_name`,`client_type`,`api_path`,`request_method`,`request_headers`,`request_params`,`response_code`,`response_body`,`cost_ms`,`device_info`,`client_ip`,`created_at`) VALUES
(1001,4,0,'mtrip_ios','Mtrip App',2,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',257,'iPhone 15','221.183.52.48','2026-09-11 11:05:11'),
(1002,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 2}',200,'{"code": 0}',421,'iPhone 15','210.168.124.182','2026-09-09 02:09:11'),
(1003,1,0,'mtrip_h5','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',511,'Web','75.127.59.236','2026-09-10 18:24:11'),
(1004,1,0,'mtrip_ios','Mtrip App',1,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',1022,'iPhone 15','73.189.63.247','2026-09-08 01:33:11'),
(1005,3,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',810,'iPhone 15','207.23.171.215','2026-09-14 09:12:11'),
(1006,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',1121,'Web','60.21.147.238','2026-09-14 01:29:11'),
(1007,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',759,'iPhone 15','166.202.92.171','2026-09-04 20:18:11'),
(1008,3,0,'mtrip_ios','Mtrip App',2,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',503,'Web','121.2.115.246','2026-09-04 13:26:11'),
(1009,3,0,'mtrip_ios','Mtrip App',2,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',402,'Pixel 8','22.57.155.235','2026-09-12 22:17:11'),
(1010,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',136,'iPhone 15','197.85.182.153','2026-09-02 19:03:11'),
(1011,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',383,'Web','54.249.53.103','2026-09-13 04:02:11'),
(1012,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',225,'Web','156.220.38.100','2026-09-13 20:26:11'),
(1013,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',711,'iPhone 15','93.50.85.15','2026-09-12 22:59:11'),
(1014,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 8}',200,'{"code": 0}',324,'Pixel 8','138.81.159.122','2026-09-06 06:02:11'),
(1015,1,0,'mtrip_h5','Mtrip App',1,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',268,'Pixel 8','41.170.101.144','2026-09-04 15:13:11'),
(1016,3,0,'mtrip_android','Mtrip App',2,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',424,'iPhone 15','54.32.27.5','2026-09-14 07:21:11'),
(1017,3,0,'mtrip_android','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',997,'iPhone 15','28.120.7.229','2026-09-02 16:08:11'),
(1018,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 16}',200,'{"code": 0}',897,'Pixel 8','27.96.110.43','2026-09-08 15:06:11'),
(1019,3,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',362,'Pixel 8','185.51.210.165','2026-09-03 00:35:11'),
(1020,1,0,'mtrip_h5','Mtrip App',2,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 15}',200,'{"code": 0}',1003,'iPhone 15','88.205.243.62','2026-09-05 04:03:11'),
(1021,3,0,'mtrip_android','Mtrip App',1,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',993,'iPhone 15','28.107.115.209','2026-09-09 03:23:11'),
(1022,4,0,'mtrip_android','Mtrip App',2,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',1159,'Pixel 8','94.241.190.233','2026-09-14 11:27:11'),
(1023,3,0,'mtrip_h5','Mtrip App',2,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 15}',200,'{"code": 0}',1163,'Web','38.21.197.165','2026-09-15 12:14:11'),
(1024,1,0,'mtrip_android','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',974,'iPhone 15','48.138.255.60','2026-09-09 02:06:11'),
(1025,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',202,'Web','169.59.228.185','2026-09-15 00:03:11'),
(1026,4,0,'mtrip_android','Mtrip App',2,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',1027,'iPhone 15','176.176.205.53','2026-09-09 11:16:11'),
(1027,4,0,'mtrip_android','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',128,'Pixel 8','21.107.106.187','2026-09-08 02:41:11'),
(1028,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',464,'Pixel 8','117.28.119.61','2026-09-11 19:33:11'),
(1029,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',217,'Web','139.33.16.239','2026-09-11 12:02:11'),
(1030,4,0,'mtrip_ios','Mtrip App',2,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 11}',200,'{"code": 0}',256,'iPhone 15','219.156.97.208','2026-09-13 22:42:11'),
(1031,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',184,'iPhone 15','179.68.17.235','2026-09-15 15:27:11'),
(1032,1,0,'mtrip_h5','Mtrip App',2,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',1115,'iPhone 15','194.136.152.13','2026-09-07 01:46:11'),
(1033,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',435,'Pixel 8','158.52.31.17','2026-09-05 16:44:11'),
(1034,4,0,'mtrip_android','Mtrip App',2,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 2}',200,'{"code": 0}',504,'Pixel 8','48.135.163.164','2026-09-10 04:51:11'),
(1035,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',569,'Web','27.90.75.5','2026-09-13 15:16:11'),
(1036,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',687,'iPhone 15','74.6.145.166','2026-09-10 10:55:11'),
(1037,1,0,'mtrip_h5','Mtrip App',1,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',273,'iPhone 15','83.190.83.179','2026-09-03 09:20:11'),
(1038,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',1056,'iPhone 15','4.9.39.160','2026-09-05 17:56:11'),
(1039,3,0,'mtrip_ios','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',614,'iPhone 15','80.83.15.226','2026-09-04 20:01:11'),
(1040,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',978,'Web','173.80.79.252','2026-09-04 12:13:11'),
(1041,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 15}',500,'{"code": 0}',1074,'iPhone 15','185.17.157.173','2026-09-05 17:45:11'),
(1042,4,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',226,'Pixel 8','69.179.96.212','2026-09-14 13:11:11'),
(1043,3,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',648,'Pixel 8','50.219.192.241','2026-09-13 01:22:11'),
(1044,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',16,'iPhone 15','211.106.120.215','2026-09-08 14:32:11'),
(1045,4,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',326,'iPhone 15','33.150.81.199','2026-09-05 02:29:11'),
(1046,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 19}',200,'{"code": 0}',688,'iPhone 15','142.217.4.73','2026-09-04 21:43:11'),
(1047,1,0,'mtrip_android','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 3}',200,'{"code": 0}',375,'Pixel 8','39.85.82.126','2026-09-03 05:35:11'),
(1048,3,0,'mtrip_ios','Mtrip App',2,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',432,'Pixel 8','43.23.99.224','2026-09-07 15:53:11'),
(1049,4,0,'mtrip_ios','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',332,'Pixel 8','150.201.111.213','2026-09-14 15:36:11'),
(1050,3,0,'mtrip_android','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',173,'Web','194.229.106.182','2026-09-03 08:04:11'),
(1051,4,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 1}',404,'{"code": 0}',821,'Web','120.190.200.208','2026-09-15 01:07:11'),
(1052,4,0,'mtrip_h5','Mtrip App',3,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',260,'Web','118.18.247.88','2026-09-15 20:32:11'),
(1053,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 17}',200,'{"code": 0}',337,'Pixel 8','205.218.68.130','2026-09-10 14:50:11'),
(1054,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',596,'Pixel 8','20.60.137.17','2026-09-01 15:56:11'),
(1055,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 1}',401,'{"code": 0}',70,'Pixel 8','195.255.52.92','2026-09-14 21:33:11'),
(1056,1,0,'mtrip_ios','Mtrip App',1,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 11}',200,'{"code": 0}',677,'Pixel 8','178.168.177.7','2026-09-13 21:42:11'),
(1057,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/finance/settle','POST','{"Accept":"application/json"}','{"page": 10}',200,'{"code": 0}',649,'Pixel 8','167.41.48.53','2026-09-12 14:16:11'),
(1058,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',1153,'iPhone 15','83.156.123.191','2026-09-04 02:48:11'),
(1059,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 1}',200,'{"code": 0}',519,'Pixel 8','39.118.128.56','2026-09-09 05:52:11'),
(1060,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/merchant/list','POST','{"Accept":"application/json"}','{"page": 13}',200,'{"code": 0}',1141,'iPhone 15','159.39.14.228','2026-09-03 16:38:11'),
(1061,3,0,'mtrip_h5','Mtrip App',3,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 14}',200,'{"code": 0}',1112,'Pixel 8','161.3.1.22','2026-09-03 22:03:11'),
(1062,3,0,'mtrip_ios','Mtrip App',3,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',1070,'Web','215.187.47.216','2026-09-13 02:36:11'),
(1063,1,0,'mtrip_android','Mtrip App',1,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',411,'Web','213.34.224.242','2026-09-02 18:36:11'),
(1064,4,0,'mtrip_ios','Mtrip App',1,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 7}',200,'{"code": 0}',1097,'Pixel 8','207.218.132.148','2026-09-08 00:11:11'),
(1065,1,0,'mtrip_h5','Mtrip App',3,'/api/v1/user/list','GET','{"Accept":"application/json"}','{"page": 8}',200,'{"code": 0}',119,'iPhone 15','205.17.7.37','2026-09-11 05:29:11'),
(1066,1,0,'mtrip_android','Mtrip App',2,'/api/v1/goods/list','POST','{"Accept":"application/json"}','{"page": 4}',200,'{"code": 0}',164,'iPhone 15','1.66.248.214','2026-09-02 15:36:11'),
(1067,3,0,'mtrip_android','Mtrip App',3,'/api/v1/coupon/list','GET','{"Accept":"application/json"}','{"page": 6}',200,'{"code": 0}',761,'Pixel 8','93.225.143.248','2026-09-03 09:27:11'),
(1068,1,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',47,'Web','200.250.157.87','2026-09-05 13:59:11'),
(1069,1,0,'mtrip_h5','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',120,'Pixel 8','129.35.231.91','2026-09-10 14:47:11'),
(1070,1,0,'mtrip_ios','Mtrip App',2,'/api/v1/order/list','GET','{"Accept":"application/json"}','{"page": 3}',200,'{"code": 0}',392,'Web','143.131.180.98','2026-09-11 08:48:11'),
(1071,4,0,'mtrip_h5','Mtrip App',1,'/api/v1/coupon/list','POST','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',332,'Pixel 8','28.223.183.157','2026-09-09 06:36:11'),
(1072,1,0,'mtrip_android','Mtrip App',3,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 19}',404,'{"code": 0}',76,'iPhone 15','15.162.175.247','2026-09-03 16:22:11'),
(1073,3,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 20}',200,'{"code": 0}',201,'Pixel 8','20.130.237.110','2026-09-06 11:32:11'),
(1074,3,0,'mtrip_ios','Mtrip App',1,'/api/v1/goods/list','GET','{"Accept":"application/json"}','{"page": 9}',200,'{"code": 0}',52,'Web','93.232.154.63','2026-09-06 01:49:11'),
(1075,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 18}',200,'{"code": 0}',710,'iPhone 15','207.151.44.9','2026-09-02 18:29:11'),
(1076,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 2}',200,'{"code": 0}',502,'Pixel 8','182.51.147.139','2026-09-08 11:42:11'),
(1077,3,0,'mtrip_android','Mtrip App',2,'/api/v1/finance/settle','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',671,'Pixel 8','110.97.160.230','2026-09-09 11:25:11'),
(1078,4,0,'mtrip_android','Mtrip App',2,'/api/v1/user/list','POST','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',490,'iPhone 15','215.23.7.128','2026-09-03 19:02:11'),
(1079,3,0,'mtrip_h5','Mtrip App',1,'/api/v1/order/list','POST','{"Accept":"application/json"}','{"page": 2}',200,'{"code": 0}',640,'iPhone 15','141.53.235.85','2026-09-06 14:06:11'),
(1080,1,0,'mtrip_ios','Mtrip App',3,'/api/v1/merchant/list','GET','{"Accept":"application/json"}','{"page": 12}',200,'{"code": 0}',323,'Web','54.150.150.219','2026-09-14 03:41:11');

-- 存储配置
INSERT INTO `sys_storage` (`id`,`site_id`,`driver`,`storage_name`,`bucket`,`region`,`access_key`,`secret_key`,`cdn_domain`,`path_prefix`,`expire_days`,`is_default`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'s3','AWS S3 主存储','mtrip-assets','eu-west-3','C0S2+HHVqUnGHm7G0C5Jjoa6X6IWcWF+c89o80duJgKUESsoYYBDCIYz78mEOQ==','n7yAB3dG+N7RXtKzgU0y66g3V/EOJAEL+UeSaqNgyvJtwUa0blVNL/Nw2WPzmcnor5Eg','https://cdn.mtrip.test','prod/',0,1,1,'主存储(密钥已 AES 加密)','2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,0,'local','本地存储(测试)','','','','','','uploads/',0,0,1,'本地磁盘存储','2025-11-20 05:14:11','2025-11-20 05:14:11');

-- 支付渠道
INSERT INTO `sys_pay_channel` (`id`,`site_id`,`channel_name`,`channel_code`,`api_key`,`merchant_no`,`webhook_url`,`fee_rate`,`min_amount`,`max_amount`,`currencies`,`split_enabled`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'Stripe','stripe','E0YWOSgm3CyiVPwdc0OxiUMxGnuKt95Jz9++97RhcTZP1V6j9awSprJqvISIIe3Ws1GpJ/1p','acct_1Ptest','https://api.mtrip.test/webhook/stripe',2.90,1.00,0.00,'["EUR", "USD", "GBP"]',1,1,'Stripe 测试渠道','2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,0,'PayPal','paypal','Nw7/3fQOcBFT9tPGreEUm4PwqBVAqsYFv+hhqZGga47b8PbQIptzhSdS1Lac7OIrqbs0Y58=','paypal_merchant_test','https://api.mtrip.test/webhook/paypal',3.40,1.00,0.00,'["EUR", "USD"]',0,1,'PayPal 测试渠道','2025-11-20 05:14:11','2025-11-20 05:14:11');

-- 短信渠道与模板
INSERT INTO `sys_sms_channel` (`id`,`site_id`,`provider_name`,`provider_code`,`api_key`,`account_sid`,`sign_name`,`region_whitelist`,`code_expire_sec`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'Twilio','twilio','fh3Cum4agbF5YuHkyMIIZYz//WgATEDhdTDAu1LR5yxSVYYVBTlnpI8ikqJ8FT3EDec=','ACexample0001','Mtrip','["FR", "NL", "BE"]',300,1,'国际短信主渠道','2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,0,'MessageBird','messagebird','uUtDFCZoYk76G2A0tq6ER0fL8AxobXMUZ0Hql7ASGXQuojIats8ag/05cDx2CNoe','','Mtrip',NULL,300,2,'备用渠道(当前停用)','2025-11-20 05:14:11','2025-11-20 05:14:11');
INSERT INTO `sys_sms_template` (`id`,`site_id`,`channel_id`,`template_name`,`template_type`,`content`,`variables`,`status`,`created_at`,`updated_at`) VALUES
(101,0,101,'注册验证码',1,'Your Mtrip verification code is {code}, valid for 5 minutes.','["code"]',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,0,101,'订单确认通知',2,'Your booking {order_no} is confirmed. Check-in: {date}.','["order_no", "date"]',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(103,0,101,'退款完成通知',3,'Refund for order {order_no} has been processed.','["order_no"]',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(104,0,101,'商户审核结果通知',4,'Your merchant application has been {result}.','["result"]',1,'2025-11-20 05:14:11','2025-11-20 05:14:11');

-- 地图配置 / 客户端密钥 / 权限模板
INSERT INTO `sys_map_config` (`id`,`site_id`,`provider`,`api_key`,`map_language`,`default_zoom`,`geocode_enabled`,`locate_enabled`,`region_limit`,`status`,`created_at`,`updated_at`) VALUES
(101,0,'google','ipGhYk3GyiYNANh2yKZf0pR8OdGA8XXASPGBXQGdKuiZKukD3nTSJrGcfJCIWtID','en',12,1,1,'["FR", "NL", "BE"]',1,'2025-11-20 05:14:11','2025-11-20 05:14:11');
INSERT INTO `sys_client_perm_template` (`id`,`site_id`,`template_name`,`template_type`,`description`,`rule_mode`,`api_list`,`status`,`created_at`,`updated_at`) VALUES
(101,0,'C 端默认白名单',1,'仅开放商品浏览与下单相关接口',1,'["/api/v1/goods/*", "/api/v1/order/create", "/api/v1/user/profile"]',1,'2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,0,'内部调试全放行',1,'调试用,禁用状态',2,'[]',2,'2025-11-20 05:14:11','2025-11-20 05:14:11');
INSERT INTO `sys_client` (`id`,`site_id`,`client_name`,`client_id`,`client_secret`,`client_type`,`perm_template_id`,`qps_limit`,`ip_whitelist`,`status`,`expire_at`,`remark`,`created_at`,`updated_at`) VALUES
(101,0,'Mtrip Android','mtrip_android','hooTiJQnXxjWT/qtlWnmQAYLVYOWznx1DPCIDZTV/31ry8PRLY7jgSBzm5skQHhU0aPGEkIf',1,101,50,'',1,NULL,'Android 客户端','2025-11-20 05:14:11','2025-11-20 05:14:11'),
(102,0,'Mtrip iOS','mtrip_ios','7rJ1u77093LKS8XQ2Me+evb05+txcW0tLelODLvI4TDcpBPD09xCsLBDxNgwbLMte/c=',2,101,50,'',1,NULL,'iOS 客户端','2025-11-20 05:14:11','2025-11-20 05:14:11'),
(103,0,'Mtrip H5','mtrip_h5','dpuCk3N0boyL5pfFShbOOzUBrjWody0sAhAumSrDyUmGKW28Qy0eLE5ojqcVEjttzq79OmrXnZDivSGvHTcSXKT9YKWJZ9BuXynM1w==',3,101,20,'',1,NULL,'H5 客户端(client-app .env.production 实际密钥)','2025-11-20 05:14:11','2025-11-20 05:14:11');

-- 站点差异化配置(站点 4 巴黎)
INSERT INTO `sys_site_config` (`id`,`site_id`,`config_group`,`config_key`,`config_value`,`config_name`,`created_at`,`updated_at`) VALUES
(101,4,'operate','hotel_commission_rate','0.12','酒店类目佣金率','2026-02-28 05:14:11','2026-02-28 05:14:11'),
(102,4,'operate','ticket_commission_rate','0.08','门票类目佣金率','2026-02-28 05:14:11','2026-02-28 05:14:11'),
(103,4,'page','home_banner_count','5','首页 Banner 数量','2026-02-28 05:14:11','2026-02-28 05:14:11');

-- 特性开关(站点 4 覆盖全局默认)
INSERT INTO `sys_feature_flag` (`id`,`site_id`,`flag_key`,`label`,`description`,`enabled`,`sort`,`created_at`,`updated_at`) VALUES
(101,4,'flash_sale','限时秒杀','巴黎站开启秒杀活动',1,1,'2026-02-28 05:14:11','2026-02-28 05:14:11'),
(102,4,'multi_currency','多币种展示','巴黎站开启多币种',1,2,'2026-02-28 05:14:11','2026-02-28 05:14:11'),
(103,4,'dynamic_pricing','动态定价','巴黎站关闭动态定价',0,3,'2026-02-28 05:14:11','2026-02-28 05:14:11');

-- App 主题
INSERT INTO `app_theme` (`id`,`site_id`,`theme_name`,`description`,`thumbnail`,`assets`,`is_default`,`priority`,`start_time`,`end_time`,`status`,`created_at`,`updated_at`) VALUES
(101,4,'巴黎夏日主题','夏季活动主题','https://cdn.mtrip.test/theme/summer.png','{"splash": "", "logo": "", "homeHeader": "", "navAccent": "#ff7a45"}',0,10,'2026-08-17 05:14:11','2026-11-15 05:14:11',1,'2026-06-18 05:14:11','2026-08-17 05:14:11'),
(102,4,'巴黎冬季节日主题','未启用的主题','','{"navAccent": "#1677ff"}',0,5,NULL,NULL,2,'2026-06-18 05:14:11','2026-06-18 05:14:11');

-- 文件库
INSERT INTO `sys_file` (`id`,`site_id`,`storage_id`,`file_name`,`file_path`,`file_url`,`file_type`,`mime_type`,`file_size`,`biz_type`,`uploader_id`,`created_at`,`updated_at`) VALUES
(1001,4,101,'merchant_license_1.jpg','prod/merchant/2026/license_1.jpg','https://cdn.mtrip.test/prod/merchant/license_1.jpg',1,'image/jpeg',682718,'merchant',101,'2026-07-31 18:51:11','2026-07-19 03:31:11'),
(1002,4,101,'merchant_license_2.jpg','prod/merchant/2026/license_2.jpg','https://cdn.mtrip.test/prod/merchant/license_2.jpg',1,'image/jpeg',687139,'merchant',101,'2026-08-25 09:01:11','2026-08-23 13:39:11'),
(1003,4,101,'merchant_license_3.jpg','prod/merchant/2026/license_3.jpg','https://cdn.mtrip.test/prod/merchant/license_3.jpg',1,'image/jpeg',177401,'merchant',101,'2026-07-08 13:16:11','2026-07-21 17:13:11'),
(1004,4,101,'merchant_license_4.jpg','prod/merchant/2026/license_4.jpg','https://cdn.mtrip.test/prod/merchant/license_4.jpg',1,'image/jpeg',1625704,'merchant',101,'2026-07-31 00:46:11','2026-07-08 08:25:11'),
(1005,4,101,'merchant_license_5.jpg','prod/merchant/2026/license_5.jpg','https://cdn.mtrip.test/prod/merchant/license_5.jpg',1,'image/jpeg',1675228,'merchant',101,'2026-07-30 12:40:11','2026-07-15 10:04:11'),
(1006,4,101,'merchant_license_6.jpg','prod/merchant/2026/license_6.jpg','https://cdn.mtrip.test/prod/merchant/license_6.jpg',1,'image/jpeg',1693972,'merchant',101,'2026-08-17 13:09:11','2026-07-02 19:19:11');
