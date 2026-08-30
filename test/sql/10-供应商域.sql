-- ============================================================
-- 供应商域:供应商 / 供货商品 / 结算
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 供应商(覆盖 0~3 全部状态)
INSERT INTO `supplier_info` (`id`,`site_id`,`supplier_name`,`supplier_short_name`,`supplier_type`,`credit_code`,`business_license`,`contact_name`,`contact_phone`,`contact_email`,`share_rate`,`settle_type`,`bank_name`,`account_name`,`account_no`,`contract_file`,`status`,`coop_start_at`,`coop_end_at`,`remark`,`created_at`,`updated_at`) VALUES
(1001,4,'欧洲酒店批发中心-1','Euro Hotel Wholesale',1,'SUP35230322500','https://cdn.mtrip.test/prod/supplier/license_1001.jpg','Grace Costa','PgDpgdoS5xHNCKFYGHgHxCDCOPq1qtJnO4N6r1jXTPDimYoG47iRCA==','supplier1001@mtrip.test',12.00,2,'Societe Generale','欧洲酒店批发中心','903nbPgst1GbX7cSoygk18YVP4iHcXizrf6faqoE9gtT+PhrtL3CmVVkfKQ=','https://cdn.mtrip.test/prod/supplier/contract_1001.pdf',3,'2026-05-24 04:19:43','2027-08-30 04:19:43','测试数据','2026-05-21 04:19:43','2026-08-10 01:42:43'),
(1002,4,'环球景区代理-2','Global Attraction Agency',2,'SUP42971602101','https://cdn.mtrip.test/prod/supplier/license_1002.jpg','Alice Lefebvre','/Wg3IdpKYYHj7MNnoGaDdUIOvYgsZclp9NdEBrIagOp/ZaiAj6HdHA==','supplier1002@mtrip.test',8.00,2,'ING Bank','环球景区代理','xJGwPaIQvWZucmChYqpIeiuEbey83Plzcqpqu5zrAG4wTsZkP912vjBY1RE=','https://cdn.mtrip.test/prod/supplier/contract_1002.pdf',0,NULL,NULL,'测试数据','2026-05-17 04:19:43','2026-08-25 15:20:43'),
(1003,4,'综合旅游资源供应-3','Allied Travel Supply',3,'SUP61062015702','https://cdn.mtrip.test/prod/supplier/license_1003.jpg','Lea Bernard','UnCsRBil+8Xq9HgfMM20mvUY/0zcb++UwoZt9nhEgRs5aokxze9xsg==','supplier1003@mtrip.test',10.00,2,'Credit Agricole','综合旅游资源供应','/XkfL/oDCYMdWMtmlIp2TeQLjpk1Dp3f9At8/XYRteJogzapt2LRQojA3as=','https://cdn.mtrip.test/prod/supplier/contract_1003.pdf',1,'2026-05-14 04:19:43',NULL,'测试数据','2026-02-22 04:19:43','2026-08-27 04:14:43'),
(1004,4,'地中海度假资源-4','Med Resort Resources',1,'SUP29181959303','https://cdn.mtrip.test/prod/supplier/license_1004.jpg','Omar Petit','FguYZlhMecClmwefzwAgpzsm16Eu5uYK159x/LPByRYWZOEAju/Vzg==','supplier1004@mtrip.test',8.00,3,'ING Bank','地中海度假资源','u6uuGwPphfHbx+qGxnAbe6fLj1AjJipLuFxYf7pA165XzQZr3ZZXhHOPTZU=','https://cdn.mtrip.test/prod/supplier/contract_1004.pdf',1,'2026-06-11 04:19:43',NULL,'测试数据','2026-01-06 04:19:43','2026-08-24 00:18:43'),
(1005,4,'北欧景区直通车-5','Nordic Sight Direct',2,'SUP22903866104','https://cdn.mtrip.test/prod/supplier/license_1005.jpg','Felix Nguyen','JR6gVfu3v/cCKwHnsrTNmZ0VCPjQEkDamz6J67xX90NyaznK+XPYlA==','supplier1005@mtrip.test',5.00,3,'Societe Generale','北欧景区直通车','GGUkcG9hMXPjWC1GtEJ9DB2FhkJnYhhbxFKcWMq6cqlQQqH/yxkI7hMeCVA=','https://cdn.mtrip.test/prod/supplier/contract_1005.pdf',1,'2026-05-26 04:19:43',NULL,'测试数据','2025-08-16 04:19:43','2026-08-26 13:26:43');

-- 供应商登录账号(口令统一 Supplier@123456)
INSERT INTO `supplier_admin` (`id`,`site_id`,`supplier_id`,`username`,`password`,`real_name`,`mobile`,`is_owner`,`status`,`last_login_at`,`created_at`,`updated_at`) VALUES
(1001,4,1001,'s1001','$2y$10$aTp2P01RWN3bQL4Fb/lnpOFH1LvAVc/VK3Gp5ZWqmObZje3wwzk9S','Grace Costa','aBSJstcrAFUt28ByCpM2ZXbSxkogphgQluTUH+N5fDNHmZ2ej9mI2Q==',1,2,NULL,'2026-05-21 04:19:43','2026-08-12 08:06:43'),
(1002,4,1002,'s1002','$2y$10$aTp2P01RWN3bQL4Fb/lnpOFH1LvAVc/VK3Gp5ZWqmObZje3wwzk9S','Alice Lefebvre','RRF3/JW3xNjRyKBil3AUX+aPcMgfhqWw5vUTMlitZhYPWOz6WV+z5A==',1,2,NULL,'2026-05-17 04:19:43','2026-08-09 07:24:43'),
(1003,4,1003,'s1003','$2y$10$aTp2P01RWN3bQL4Fb/lnpOFH1LvAVc/VK3Gp5ZWqmObZje3wwzk9S','Lea Bernard','c1SR3U+DUveEASufP73YVJZ51GKZGWVuz3Sq5oFbHXbicVPDb/x2dw==',1,1,'2026-08-20 18:50:43','2026-02-22 04:19:43','2026-08-29 13:41:43'),
(1004,4,1004,'s1004','$2y$10$aTp2P01RWN3bQL4Fb/lnpOFH1LvAVc/VK3Gp5ZWqmObZje3wwzk9S','Omar Petit','pFuZa/5aUw6AW0wSUgOkmnfcTnKCvq5qiQvohm0NbPFu4d1OGxMdNg==',1,1,'2026-08-24 23:00:43','2026-01-06 04:19:43','2026-08-28 10:09:43'),
(1005,4,1005,'s1005','$2y$10$aTp2P01RWN3bQL4Fb/lnpOFH1LvAVc/VK3Gp5ZWqmObZje3wwzk9S','Felix Nguyen','Omii8wtLn7tfwVFlmLNl4ThAZZNimBbq/Vzkt3N3nIsxbqtUiEF/MA==',1,1,'2026-08-14 14:41:43','2025-08-16 04:19:43','2026-08-28 07:02:43');
INSERT INTO `supplier_admin_role` (`admin_id`,`role_id`) VALUES
(1001,1),
(1002,1),
(1003,1),
(1004,1),
(1005,1);

-- 供货商品
INSERT INTO `supplier_goods` (`id`,`site_id`,`supplier_id`,`goods_id`,`goods_name`,`goods_type`,`supply_price`,`retail_price`,`sync_type`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(1001,4,1001,1001,'Louvre Garden Hotel - 标准双床房',1,98.00,132.30,1,1,'测试数据','2026-05-21 04:19:43','2026-08-13 16:39:43'),
(1002,4,1002,1002,'Versailles Palace - 快速通道票',2,130.00,175.50,2,1,'测试数据','2026-05-17 04:19:43','2026-08-16 09:26:43'),
(1003,4,1003,1003,'Alpes Mountain Lodge - 行政套房',1,261.00,352.35,2,1,'测试数据','2026-02-22 04:19:43','2026-08-24 23:26:43'),
(1004,4,1004,1004,'Brussels Central Hotel - 行政套房',1,187.00,252.45,2,2,'测试数据','2026-01-06 04:19:43','2026-08-30 02:33:43'),
(1005,4,1005,1005,'Seine Riverside Boutique - 行政套房',1,87.00,117.45,1,2,'测试数据','2025-08-16 04:19:43','2026-08-18 03:38:43'),
(1006,4,1001,1006,'Bordeaux Chateau Hotel - 行政套房',1,74.00,99.90,2,2,'测试数据','2026-05-21 04:19:43','2026-08-28 14:30:43'),
(1007,4,1002,1007,'Amsterdam Canal Hotel - 行政套房',1,66.00,89.10,1,1,'测试数据','2026-05-17 04:19:43','2026-08-28 04:39:43'),
(1008,4,1003,1008,'Bastille Design Hotel - 行政套房',1,56.00,75.60,1,1,'测试数据','2026-02-22 04:19:43','2026-08-18 04:01:43'),
(1009,4,1004,1009,'Eiffel Tower Attraction - 儿童票',2,186.00,251.10,1,1,'测试数据','2026-01-06 04:19:43','2026-08-24 03:49:43'),
(1010,4,1005,1010,'Provence Countryside Hotel - 行政套房',1,80.00,108.00,3,1,'测试数据','2025-08-16 04:19:43','2026-08-16 04:52:43'),
(1011,4,1001,1011,'Lyon Station Business Hotel - 家庭房',1,151.00,203.85,3,2,'测试数据','2026-05-21 04:19:43','2026-08-12 16:17:43'),
(1012,4,1002,1012,'Montmartre Art Hotel - 豪华大床房',1,196.00,264.60,3,1,'测试数据','2026-05-17 04:19:43','2026-08-18 13:11:43');

-- 供应商结算账单
INSERT INTO `supplier_settle` (`id`,`settle_no`,`site_id`,`supplier_id`,`settle_month`,`order_count`,`supply_amount`,`share_amount`,`settle_amount`,`status`,`audit_by`,`audit_time`,`pay_time`,`pay_voucher`,`remark`,`created_at`,`updated_at`) VALUES
(1001,'SS20260801001',4,1001,'2026-08',43,24050.00,2405.00,26455.00,3,103,'2026-08-29 07:55:43',NULL,'','测试数据','2026-07-13 05:39:43','2026-08-22 11:06:43'),
(1002,'SS20260701002',4,1002,'2026-07',68,74063.00,7406.30,81469.30,0,NULL,NULL,NULL,'','测试数据','2026-07-24 20:41:43','2026-08-22 03:57:43'),
(1003,'SS20260701003',4,1003,'2026-07',276,11545.00,1154.50,12699.50,0,NULL,NULL,NULL,'','测试数据','2026-07-09 00:58:43','2026-08-26 07:07:43'),
(1004,'SS20260601004',4,1004,'2026-06',186,69548.00,6954.80,76502.80,2,103,'2026-08-25 10:40:43','2026-08-23 10:34:43','https://cdn.mtrip.test/prod/voucher/ss1004.pdf','测试数据','2026-07-22 10:23:43','2026-08-19 11:27:43'),
(1005,'SS20260501005',4,1005,'2026-05',170,62406.00,6240.60,68646.60,0,NULL,NULL,NULL,'','测试数据','2026-07-24 07:30:43','2026-08-24 13:57:43'),
(1006,'SS20260401006',4,1001,'2026-04',156,30256.00,3025.60,33281.60,0,NULL,NULL,NULL,'','测试数据','2026-07-13 09:12:43','2026-08-26 23:51:43'),
(1007,'SS20260301007',4,1002,'2026-03',149,66225.00,6622.50,72847.50,3,103,'2026-08-22 20:36:43',NULL,'','测试数据','2026-07-01 20:45:43','2026-08-26 14:30:43'),
(1008,'SS20260201008',4,1003,'2026-02',112,7449.00,744.90,8193.90,1,103,'2026-08-25 14:47:43',NULL,'','测试数据','2026-08-07 02:29:43','2026-08-21 11:01:43');
