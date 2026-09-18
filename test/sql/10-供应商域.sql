-- ============================================================
-- 供应商域:供应商 / 供货商品 / 结算
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 供应商(覆盖 0~3 全部状态)
INSERT INTO `supplier_info` (`id`,`site_id`,`supplier_name`,`supplier_short_name`,`supplier_type`,`credit_code`,`business_license`,`contact_name`,`contact_phone`,`contact_email`,`share_rate`,`settle_type`,`bank_name`,`account_name`,`account_no`,`contract_file`,`status`,`coop_start_at`,`coop_end_at`,`remark`,`created_at`,`updated_at`) VALUES
(1001,4,'欧洲酒店批发中心-1','Euro Hotel Wholesale',1,'SUP62777873200','https://cdn.mtrip.test/prod/supplier/license_1001.jpg','Emma Costa','qlLCDaZ9lsMdzQGBhlw7SAAH9tOAU0sU+JxB2CSSTNWYX6OrF1Kfeg==','supplier1001@mtrip.test',5.00,3,'BNP Paribas','欧洲酒店批发中心','cjRzH5LWNqb7YieK2FetBeTMqWwElmhYn+PaqiMetYMzesZSX0wCRCa+RcU=','https://cdn.mtrip.test/prod/supplier/contract_1001.pdf',0,NULL,NULL,'测试数据','2025-12-19 05:14:11','2026-08-26 09:43:11'),
(1002,4,'环球景区代理-2','Global Attraction Agency',2,'SUP96268127901','https://cdn.mtrip.test/prod/supplier/license_1002.jpg','Omar Dubois','BJNamM9EENlHAzZnPJk0VZ3cfjuCI+BX+Wek+qvTyZXwxuOoTCa7Wg==','supplier1002@mtrip.test',12.00,1,'BNP Paribas','环球景区代理','8/hiPiezxvL20+n69E25QwhJDOpQ/zSBY8zU3Ya7tXa7qdRLrN0w7s18uyk=','https://cdn.mtrip.test/prod/supplier/contract_1002.pdf',1,'2026-06-10 05:14:11',NULL,'测试数据','2026-07-13 05:14:11','2026-08-26 16:19:11'),
(1003,4,'综合旅游资源供应-3','Allied Travel Supply',3,'SUP84923596602','https://cdn.mtrip.test/prod/supplier/license_1003.jpg','Omar Costa','Mj5ZoZrWccjx97NhULuwLII4iF2+dn40cfqo24cXzdEH84WnxejMPw==','supplier1003@mtrip.test',5.00,2,'Societe Generale','综合旅游资源供应','6L/0Un6EZfwePQVXZFAxWDLmnT7gnEMsYZKfPwpIES2d4j8acXucvet2t/k=','https://cdn.mtrip.test/prod/supplier/contract_1003.pdf',2,'2026-07-10 05:14:11',NULL,'测试数据','2026-01-23 05:14:11','2026-08-30 12:22:11'),
(1004,4,'地中海度假资源-4','Med Resort Resources',1,'SUP46290009403','https://cdn.mtrip.test/prod/supplier/license_1004.jpg','Hugo Petit','1nEMaVidG3/iC7jVxeq3QH44rJJJzUUqCQVB9KYG+BpxdAYFX8D/FA==','supplier1004@mtrip.test',8.00,3,'KBC Bank','地中海度假资源','pLhZKS6SrJiodAlrSpBnFcMtMOtZFNi2+Kcvhioz8Jd4Rcp8b4xiq8fi8pc=','https://cdn.mtrip.test/prod/supplier/contract_1004.pdf',1,'2026-02-18 05:14:11',NULL,'测试数据','2025-10-14 05:14:11','2026-08-26 12:22:11'),
(1005,4,'北欧景区直通车-5','Nordic Sight Direct',2,'SUP37539640704','https://cdn.mtrip.test/prod/supplier/license_1005.jpg','Karim Garcia','rQPpcYgl8qNgqnkTTZhuQJuayHXHdwdPeWrkHnUQN0C9M1hEKkqNtQ==','supplier1005@mtrip.test',10.00,2,'KBC Bank','北欧景区直通车','o3gMt2+V8OAeZVYKh1sj5fB7I8QIqfqbc4vTHW5lHWJmGkLq5i7BGPBAYWs=','https://cdn.mtrip.test/prod/supplier/contract_1005.pdf',0,NULL,NULL,'测试数据','2026-02-24 05:14:11','2026-09-08 21:31:11');

-- 供应商登录账号(口令统一 Supplier@123456)
INSERT INTO `supplier_admin` (`id`,`site_id`,`supplier_id`,`username`,`password`,`real_name`,`mobile`,`is_owner`,`status`,`last_login_at`,`created_at`,`updated_at`) VALUES
(1001,4,1001,'s1001','$2y$10$g3wRLAVXMovLW45vEncRv.HDwyhJvxKMIH81w/rha13ZT59DbK8c6','Emma Costa','Im7Ij3PHx0aNqR1KBjHnWFaWr/gH/V2qTL8HY0AY2lGORigyJ//7eA==',1,2,NULL,'2025-12-19 05:14:11','2026-08-29 21:48:11'),
(1002,4,1002,'s1002','$2y$10$g3wRLAVXMovLW45vEncRv.HDwyhJvxKMIH81w/rha13ZT59DbK8c6','Omar Dubois','NI4TRiU26GLZ/gJDU+iAcW3zxAfUot9XTOVbRYOJCCo6DjGu1XK6BQ==',1,1,'2026-08-20 00:48:11','2026-07-13 05:14:11','2026-08-31 03:23:11'),
(1003,4,1003,'s1003','$2y$10$g3wRLAVXMovLW45vEncRv.HDwyhJvxKMIH81w/rha13ZT59DbK8c6','Omar Costa','YEOlHLaul3WXwmH2zw7qe/MZvQeLBDZKg4iuLtr3bEunLQTFE6TuCA==',1,2,NULL,'2026-01-23 05:14:11','2026-08-29 11:56:11'),
(1004,4,1004,'s1004','$2y$10$g3wRLAVXMovLW45vEncRv.HDwyhJvxKMIH81w/rha13ZT59DbK8c6','Hugo Petit','nrjEOYN9X05S20vbl9c1gid0/75XkTs6BwLBHmqcqeCRHLzQIduukQ==',1,1,'2026-09-01 12:05:11','2025-10-14 05:14:11','2026-08-30 03:50:11'),
(1005,4,1005,'s1005','$2y$10$g3wRLAVXMovLW45vEncRv.HDwyhJvxKMIH81w/rha13ZT59DbK8c6','Karim Garcia','OrJh+L6hGvVA0Nccm4o5nhs6DxovhRoFn90H0UEWYAlV9mEepoPkww==',1,2,NULL,'2026-02-24 05:14:11','2026-08-27 16:00:11');
INSERT INTO `supplier_admin_role` (`admin_id`,`role_id`) VALUES
(1001,1),
(1002,1),
(1003,1),
(1004,1),
(1005,1);

-- 供货商品
INSERT INTO `supplier_goods` (`id`,`site_id`,`supplier_id`,`goods_id`,`goods_name`,`goods_type`,`supply_price`,`retail_price`,`sync_type`,`status`,`remark`,`created_at`,`updated_at`) VALUES
(1001,4,1001,1001,'Saint-Germain Inn - 成人票',2,97.00,130.95,1,1,'测试数据','2025-12-19 05:14:11','2026-08-29 07:36:11'),
(1002,4,1002,1002,'Eiffel Tower Attraction - 快速通道票',2,274.00,369.90,3,1,'测试数据','2026-07-13 05:14:11','2026-09-07 17:37:11'),
(1003,4,1003,1003,'Versailles Palace - 快速通道票',2,173.00,233.55,1,2,'测试数据','2026-01-23 05:14:11','2026-09-06 12:05:11'),
(1004,4,1004,1004,'Seine River Cruise Pier - 家庭套票',2,149.00,201.15,3,1,'测试数据','2025-10-14 05:14:11','2026-08-27 02:37:11'),
(1005,4,1005,1005,'Disneyland Paris - 快速通道票',2,97.00,130.95,1,1,'测试数据','2026-02-24 05:14:11','2026-09-12 16:32:11'),
(1006,4,1001,1006,'Alpes Mountain Lodge - 儿童票',2,79.00,106.65,1,1,'测试数据','2025-12-19 05:14:11','2026-09-15 11:04:11'),
(1007,4,1002,1007,'Saint-Germain Inn - 家庭套票',2,195.00,263.25,3,1,'测试数据','2026-07-13 05:14:11','2026-09-11 20:30:11'),
(1008,4,1003,1008,'Eiffel Tower Attraction - 家庭套票',2,294.00,396.90,3,1,'测试数据','2026-01-23 05:14:11','2026-09-05 04:10:11'),
(1009,4,1004,1009,'Versailles Palace - 儿童票',2,251.00,338.85,3,1,'测试数据','2025-10-14 05:14:11','2026-09-14 20:00:11'),
(1010,4,1005,1010,'Seine River Cruise Pier - 成人票',2,269.00,363.15,2,1,'测试数据','2026-02-24 05:14:11','2026-08-28 10:42:11'),
(1011,4,1001,1011,'Disneyland Paris - 儿童票',2,294.00,396.90,1,1,'测试数据','2025-12-19 05:14:11','2026-09-02 21:24:11'),
(1012,4,1002,1012,'Alpes Mountain Lodge - 成人票',2,113.00,152.55,2,1,'测试数据','2026-07-13 05:14:11','2026-09-12 20:44:11');

-- 供应商结算账单
INSERT INTO `supplier_settle` (`id`,`settle_no`,`site_id`,`supplier_id`,`settle_month`,`order_count`,`supply_amount`,`share_amount`,`settle_amount`,`status`,`audit_by`,`audit_time`,`pay_time`,`pay_voucher`,`remark`,`created_at`,`updated_at`) VALUES
(1001,'SS20260901001',4,1001,'2026-09',126,37981.00,3798.10,41779.10,1,103,'2026-08-28 09:39:11',NULL,'','测试数据','2026-08-26 03:22:11','2026-09-11 01:55:11'),
(1002,'SS20260801002',4,1002,'2026-08',188,30714.00,3071.40,33785.40,1,103,'2026-09-12 13:00:11',NULL,'','测试数据','2026-08-03 13:36:11','2026-09-07 23:58:11'),
(1003,'SS20260701003',4,1003,'2026-07',220,35518.00,3551.80,39069.80,1,103,'2026-09-13 16:32:11',NULL,'','测试数据','2026-07-24 02:54:11','2026-09-06 11:42:11'),
(1004,'SS20260601004',4,1004,'2026-06',271,32902.00,3290.20,36192.20,2,103,'2026-09-08 23:22:11','2026-09-09 06:00:11','https://cdn.mtrip.test/prod/voucher/ss1004.pdf','测试数据','2026-08-13 17:07:11','2026-09-14 08:22:11'),
(1005,'SS20260501005',4,1005,'2026-05',222,54111.00,5411.10,59522.10,0,NULL,NULL,NULL,'','测试数据','2026-07-19 12:28:11','2026-09-08 18:35:11'),
(1006,'SS20260401006',4,1001,'2026-04',292,65426.00,6542.60,71968.60,2,103,'2026-09-09 01:23:11','2026-09-09 10:23:11','https://cdn.mtrip.test/prod/voucher/ss1006.pdf','测试数据','2026-08-14 14:07:11','2026-09-11 23:55:11'),
(1007,'SS20260301007',4,1002,'2026-03',299,73533.00,7353.30,80886.30,2,103,'2026-09-07 23:25:11','2026-09-14 04:48:11','https://cdn.mtrip.test/prod/voucher/ss1007.pdf','测试数据','2026-08-02 11:51:11','2026-09-15 15:51:11'),
(1008,'SS20260201008',4,1003,'2026-02',47,8709.00,870.90,9579.90,3,103,'2026-08-30 23:51:11',NULL,'','测试数据','2026-08-13 03:57:11','2026-09-13 08:18:11');
