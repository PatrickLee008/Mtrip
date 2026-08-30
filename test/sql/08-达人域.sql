-- ============================================================
-- 达人域:合作方 / 申请 / 折扣码 / 佣金 / 反欺诈
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 带货达人/合作方(覆盖 1活跃 2待审 3暂停 4已拒绝)
INSERT INTO `affiliate_partner` (`id`,`site_id`,`name`,`handle`,`type`,`platform`,`followers`,`country`,`status`,`commission_rate`,`total_earnings`,`withdrawable`,`total_referrals`,`conversions`,`fraud_score`,`join_date`,`last_activity`,`created_at`,`updated_at`) VALUES
(1001,4,'Marie Travel-1','marie_travel0','influencer','Instagram',455323,'FR',2,5.00,187813,40849,239,182,82,'2026-03-02 00:00:00',NULL,'2026-07-21 04:19:43','2026-08-20 08:24:43'),
(1002,4,'Wanderlust Diaries-2','wanderlust_diaries1','blogger','YouTube',150995,'FR',2,15.00,49779,7137,181,302,82,'2025-12-05 00:00:00',NULL,'2026-07-06 04:19:43','2026-08-19 05:31:43'),
(1003,4,'Paris Insider-3','paris_insider2','kol','TikTok',39050,'FR',1,5.00,294149,122493,2517,286,14,'2025-12-03 00:00:00','2026-08-14 17:55:43','2025-11-18 04:19:43','2026-08-22 06:07:43'),
(1004,4,'Euro Trip Deals-4','euro_trip_deals3','ota_partner','Website',189738,'US',1,10.00,496044,185886,1336,283,85,'2026-03-17 00:00:00','2026-07-31 17:10:43','2026-03-12 04:19:43','2026-08-21 05:00:43'),
(1005,4,'Corporate Stays Ltd-5','corporate_stays4','corporate','LinkedIn',265991,'GB',1,12.00,404948,130637,2461,86,81,'2026-06-26 00:00:00','2026-07-31 22:56:43','2026-07-25 04:19:43','2026-08-24 15:27:43'),
(1006,4,'Backpack Europe-6','backpack_europe5','influencer','Instagram',496916,'GB',4,10.00,375158,224673,2156,273,92,'2025-11-18 00:00:00',NULL,'2026-04-06 04:19:43','2026-08-16 09:15:43'),
(1007,4,'Luxury Escapes-7','luxury_escapes6','kol','YouTube',235613,'FR',2,5.00,410589,220088,755,745,24,'2026-01-16 00:00:00',NULL,'2026-01-12 04:19:43','2026-08-18 14:28:43'),
(1008,4,'Family Holiday Tips-8','family_holiday7','blogger','Blog',413209,'CN',3,15.00,402778,175178,1881,331,54,'2025-12-04 00:00:00',NULL,'2026-06-23 04:19:43','2026-08-17 06:25:43'),
(1009,4,'Marie Travel-9','marie_travel8','influencer','Instagram',349930,'FR',2,15.00,222472,113617,2979,738,0,'2026-03-19 00:00:00',NULL,'2025-12-31 04:19:43','2026-08-16 17:07:43'),
(1010,4,'Wanderlust Diaries-10','wanderlust_diaries9','blogger','YouTube',46218,'GB',2,12.00,239885,90190,1804,35,80,'2026-01-30 00:00:00',NULL,'2026-03-28 04:19:43','2026-08-29 00:36:43');

-- 达人入驻申请(覆盖 1待审 2通过 3拒绝)
INSERT INTO `affiliate_application` (`id`,`site_id`,`name`,`handle`,`type`,`platform`,`followers`,`contact_email`,`contact_phone`,`audience`,`materials`,`status`,`reviewer_id`,`reviewer_name`,`review_note`,`partner_id`,`created_at`,`updated_at`) VALUES
(1001,4,'Chen Martin','applicant_1001','influencer','TikTok',98953,'applicant1001@mtrip.test','dR9uiESkSnXG2rf4K/v1Wl5Ns4AcMHs+shvfCYCF5KKEH7Kz4DD1cQ==','欧洲旅行爱好者',NULL,1,0,'','',0,'2026-07-20 06:15:43','2026-08-13 23:09:43'),
(1002,4,'Chen Weber','applicant_1002','blogger','YouTube',46177,'applicant1002@mtrip.test','kEyrSz99e/sc5QocvHdqdf300JQDP3X1rVZotJWk5YDhJvgStwE9Qw==','欧洲旅行爱好者',NULL,1,0,'','',0,'2026-07-31 19:03:43','2026-08-27 19:58:43'),
(1003,4,'Grace Haddad','applicant_1003','influencer','TikTok',21369,'applicant1003@mtrip.test','fN/ykjaU4cpqF0us7W6XOjpKTZ3BEY+fAD+otCJ80HNDNGGpqVnfZg==','欧洲旅行爱好者',NULL,1,0,'','',0,'2026-08-22 20:24:43','2026-08-29 01:40:43'),
(1004,4,'Bruno Robert','applicant_1004','influencer','Instagram',80038,'applicant1004@mtrip.test','szkQ2pIR9n/9OKWmiGV/rGpVnaRK5+ToibDvIuFWEHCxFiEThTKJxg==','欧洲旅行爱好者',NULL,2,104,'客服专员','资料齐全,通过',1004,'2026-07-20 00:31:43','2026-08-16 06:16:43'),
(1005,4,'Emma Garcia','applicant_1005','blogger','YouTube',42723,'applicant1005@mtrip.test','K3kH1zqkatIWvbfNv3lsiknMhP911htDqQ9e0XSrXAG5mjjxUQnQLQ==','欧洲旅行爱好者',NULL,3,104,'客服专员','粉丝质量不达标',0,'2026-07-02 22:32:43','2026-08-13 03:15:43'),
(1006,4,'Felix Silva','applicant_1006','kol','TikTok',114583,'applicant1006@mtrip.test','VTxkIWk1I7JuOMKX3YLIXobML8s4l/HIKDRA0UFVdS0/T15P7lLdQg==','欧洲旅行爱好者',NULL,2,104,'客服专员','资料齐全,通过',1006,'2026-07-26 04:18:43','2026-08-09 05:41:43');

-- 联盟计划配置
INSERT INTO `affiliate_program` (`id`,`site_id`,`kind`,`name`,`config`,`enabled`,`sort`,`created_at`,`updated_at`) VALUES
(1001,4,1,'酒店佣金规则','{"commission": {"affiliateType": "hotel", "rate": 10, "minBookingValue": 50}}',1,1,'2026-05-02 04:19:43','2026-05-02 04:19:43'),
(1002,4,2,'新客首单奖励','{"reward": {"trigger": "first_booking", "target": "new_user", "rewardType": "fixed", "rewardValue": 20}}',1,2,'2026-05-02 04:19:43','2026-05-02 04:19:43'),
(1003,4,3,'结算周期参数','{"setting": {"key": "settle_cycle_days", "value": 30}}',1,3,'2026-05-02 04:19:43','2026-05-02 04:19:43');

-- 联盟折扣码
INSERT INTO `affiliate_code` (`id`,`site_id`,`code`,`partner_id`,`partner_name`,`partner_handle`,`promotion_type`,`discount_value`,`discount_display`,`referral_link`,`status`,`start_date`,`end_date`,`usage_limit`,`usage_count`,`per_user_limit`,`min_spend`,`eligible_merchants`,`merchant_count`,`bookings`,`conversions`,`revenue`,`commission`,`commission_rate`,`last_used_at`,`created_by`,`created_at`,`updated_at`) VALUES
(1001,4,'AFF01001',1001,'Marie Travel-1','marie_travel0','fixed',8.00,'15% OFF','https://mtrip.test/r/AFF01001',1,'2026-07-01 00:00:00','2026-11-28 00:00:00',1747,45,3,5000,'all',0,181,6,194264,13849,5.00,'2026-08-18 19:17:43','运营专员','2026-06-01 04:19:43','2026-08-25 14:36:43'),
(1002,4,'AFF01002',1002,'Wanderlust Diaries-2','wanderlust_diaries1','percentage',20.00,'20% OFF','https://mtrip.test/r/AFF01002',2,'2026-07-01 00:00:00','2026-11-28 00:00:00',1095,222,3,0,'all',0,477,110,6478,18097,15.00,'2026-08-13 04:50:43','运营专员','2026-06-01 04:19:43','2026-08-28 05:30:43'),
(1003,4,'AFF01003',1003,'Paris Insider-3','paris_insider2','fixed',10.00,'15% OFF','https://mtrip.test/r/AFF01003',1,'2026-07-01 00:00:00','2026-11-28 00:00:00',1043,81,3,0,'all',0,434,153,157643,3275,5.00,'2026-08-21 14:23:43','运营专员','2026-06-01 04:19:43','2026-08-27 22:41:43'),
(1004,4,'AFF01004',1004,'Euro Trip Deals-4','euro_trip_deals3','fixed',8.00,'8% OFF','https://mtrip.test/r/AFF01004',3,'2026-07-01 00:00:00','2026-11-28 00:00:00',1945,293,3,5000,'all',0,433,179,109636,16936,10.00,'2026-08-29 17:13:43','运营专员','2026-06-01 04:19:43','2026-08-20 16:24:43'),
(1005,4,'AFF01005',1005,'Corporate Stays Ltd-5','corporate_stays4','cashback',8.00,'8% OFF','https://mtrip.test/r/AFF01005',4,'2026-07-01 00:00:00','2026-11-28 00:00:00',981,191,3,5000,'all',0,197,129,294420,6194,12.00,'2026-08-11 11:21:43','运营专员','2026-06-01 04:19:43','2026-08-24 01:27:43'),
(1006,4,'AFF01006',1006,'Backpack Europe-6','backpack_europe5','cashback',20.00,'15% OFF','https://mtrip.test/r/AFF01006',2,'2026-07-01 00:00:00','2026-11-28 00:00:00',873,2,3,0,'all',0,331,102,8419,7014,10.00,'2026-08-18 06:29:43','运营专员','2026-06-01 04:19:43','2026-08-29 03:33:43'),
(1007,4,'AFF01007',1007,'Luxury Escapes-7','luxury_escapes6','percentage',10.00,'20% OFF','https://mtrip.test/r/AFF01007',1,'2026-07-01 00:00:00','2026-11-28 00:00:00',966,135,1,0,'all',0,448,79,261146,27358,5.00,'2026-08-28 08:59:43','运营专员','2026-06-01 04:19:43','2026-08-25 07:57:43'),
(1008,4,'AFF01008',1008,'Family Holiday Tips-8','family_holiday7','fixed',20.00,'15% OFF','https://mtrip.test/r/AFF01008',3,'2026-07-01 00:00:00','2026-11-28 00:00:00',303,299,3,5000,'all',0,19,63,101619,4073,15.00,'2026-08-25 18:16:43','运营专员','2026-06-01 04:19:43','2026-08-24 07:43:43'),
(1009,4,'AFF01009',1009,'Marie Travel-9','marie_travel8','percentage',20.00,'8% OFF','https://mtrip.test/r/AFF01009',2,'2026-07-01 00:00:00','2026-11-28 00:00:00',322,219,1,0,'all',0,142,166,102960,15501,15.00,'2026-08-16 05:26:43','运营专员','2026-06-01 04:19:43','2026-08-21 11:47:43'),
(1010,4,'AFF01010',1010,'Wanderlust Diaries-10','wanderlust_diaries9','percentage',8.00,'8% OFF','https://mtrip.test/r/AFF01010',2,'2026-07-01 00:00:00','2026-11-28 00:00:00',450,286,1,0,'all',0,97,40,216176,22476,12.00,'2026-08-21 01:33:43','运营专员','2026-06-01 04:19:43','2026-08-27 17:40:43'),
(1011,4,'AFF01011',1001,'Marie Travel-1','marie_travel0','percentage',20.00,'15% OFF','https://mtrip.test/r/AFF01011',1,'2026-07-01 00:00:00','2026-11-28 00:00:00',972,248,1,0,'all',0,448,141,136054,17491,5.00,'2026-08-18 20:39:43','运营专员','2026-06-01 04:19:43','2026-08-24 23:22:43'),
(1012,4,'AFF01012',1002,'Wanderlust Diaries-2','wanderlust_diaries1','fixed',8.00,'10% OFF','https://mtrip.test/r/AFF01012',4,'2026-07-01 00:00:00','2026-11-28 00:00:00',1836,158,1,0,'all',0,298,67,138594,28593,15.00,'2026-08-21 10:38:43','运营专员','2026-06-01 04:19:43','2026-08-21 21:12:43');

-- 佣金流水 / 提现 / 反欺诈案件
INSERT INTO `affiliate_commission_log` (`id`,`site_id`,`partner_id`,`code_id`,`order_id`,`amount`,`commission_rate`,`status`,`created_at`,`updated_at`) VALUES
(1001,4,1001,1001,0,14687,5.00,1,'2026-08-03 21:02:43','2026-08-19 12:04:43'),
(1002,4,1002,1002,0,8858,15.00,2,'2026-07-19 21:12:43','2026-08-27 10:29:43'),
(1003,4,1003,1003,0,3483,5.00,1,'2026-08-29 21:44:43','2026-08-23 04:03:43'),
(1004,4,1004,1004,0,1658,10.00,2,'2026-07-25 14:26:43','2026-08-27 22:55:43'),
(1005,4,1005,1005,0,15622,12.00,1,'2026-07-31 00:11:43','2026-08-27 18:03:43'),
(1006,4,1006,1006,0,11196,10.00,1,'2026-08-10 15:49:43','2026-08-28 07:00:43'),
(1007,4,1007,1007,0,9153,5.00,1,'2026-07-06 11:19:43','2026-08-19 23:05:43'),
(1008,4,1008,1008,0,19374,15.00,3,'2026-08-16 23:16:43','2026-08-29 10:28:43'),
(1009,4,1009,1009,0,5770,15.00,3,'2026-08-28 08:48:43','2026-08-24 21:17:43'),
(1010,4,1010,1010,0,9880,12.00,1,'2026-07-30 10:02:43','2026-08-24 04:39:43'),
(1011,4,1001,1011,0,2775,5.00,2,'2026-08-04 14:19:43','2026-08-29 15:45:43'),
(1012,4,1002,1012,0,13301,15.00,1,'2026-08-29 02:00:43','2026-08-19 22:12:43');
INSERT INTO `affiliate_withdraw` (`id`,`site_id`,`partner_id`,`amount`,`status`,`bank_info`,`operator_id`,`paid_at`,`remark`,`created_at`,`updated_at`) VALUES
(1001,4,1001,45383,3,'oZbKtBtGBN1mExotsbT6Pgp4qe9qg0eYl2hRXxFxysLh0BcdvaG7+4YkV7Y=',103,'2026-08-21 23:07:43','测试数据','2026-08-05 22:29:43','2026-08-27 20:12:43'),
(1002,4,1002,64013,2,'uUEx1TgPtMIvMDMU/hslMVX3BwcmObgI9mQuAYEiL2uSfMhmR2EaaV9a/RM=',103,NULL,'测试数据','2026-07-16 07:21:43','2026-08-27 04:33:43'),
(1003,4,1003,43558,1,'zn+UYlmVzDNsoWgWd5hA/vC5QTS1q6bz4j5pZ42+zTDFXnKXQQOMaX+B7Hw=',0,NULL,'测试数据','2026-08-02 03:49:43','2026-08-26 07:28:43'),
(1004,4,1004,33547,4,'8MMEIrR6YaUQfXLyboDbBAp2VkBAg6UVL4vJsSJszjyYfLAB+wEjcNsr7ho=',103,NULL,'测试数据','2026-08-18 01:47:43','2026-08-26 16:34:43'),
(1005,4,1005,35359,2,'fH2LrdgKKEynKbZw3OvNIuQygLjxbvgtvR++SmM/oP56Tgi0RsE4Kp/+nm8=',103,NULL,'测试数据','2026-08-08 00:57:43','2026-08-27 16:21:43'),
(1006,4,1006,64785,2,'QBe3tKV0USDtxIRrArR0GnHLDO30EPhGfm5MiUz84uq/DAZVyEZcdML0bI0=',103,NULL,'测试数据','2026-08-13 08:55:43','2026-08-29 00:54:43');
INSERT INTO `affiliate_fraud_flag` (`id`,`site_id`,`partner_id`,`partner_name`,`handle`,`fraud_score`,`risk_level`,`suspicious_activity`,`evidence_summary`,`investigation_status`,`reviewer`,`detection_date`,`created_at`,`updated_at`) VALUES
(1001,4,1001,'Marie Travel-1','marie_travel0',82,1,'优惠券套现','近 7 天订单集中在同一 IP 段',2,'运营专员','2026-08-23 00:00:00','2026-08-14 04:46:43','2026-08-29 09:25:43'),
(1002,4,1002,'Wanderlust Diaries-2','wanderlust_diaries1',80,1,'虚假流量','近 7 天订单集中在同一 IP 段',2,'运营专员','2026-08-12 00:00:00','2026-08-06 03:33:43','2026-08-26 04:59:43'),
(1003,4,1003,'Paris Insider-3','paris_insider2',58,2,'虚假流量','近 7 天订单集中在同一 IP 段',2,'运营专员','2026-08-25 00:00:00','2026-08-09 04:29:43','2026-08-26 15:25:43'),
(1004,4,1004,'Euro Trip Deals-4','euro_trip_deals3',62,2,'虚假流量','近 7 天订单集中在同一 IP 段',3,'运营专员','2026-08-28 00:00:00','2026-08-29 19:16:43','2026-08-28 04:13:43'),
(1005,4,1005,'Corporate Stays Ltd-5','corporate_stays4',94,1,'异常集中下单','近 7 天订单集中在同一 IP 段',1,'运营专员','2026-08-04 00:00:00','2026-08-14 08:06:43','2026-08-27 18:24:43');
