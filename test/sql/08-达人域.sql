-- ============================================================
-- 达人域:合作方 / 申请 / 折扣码 / 佣金 / 反欺诈
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 带货达人/合作方(覆盖 1活跃 2待审 3暂停 4已拒绝)
INSERT INTO `affiliate_partner` (`id`,`site_id`,`name`,`handle`,`type`,`platform`,`followers`,`country`,`status`,`commission_rate`,`total_earnings`,`withdrawable`,`total_referrals`,`conversions`,`fraud_score`,`join_date`,`last_activity`,`created_at`,`updated_at`) VALUES
(1001,4,'Marie Travel-1','marie_travel0','influencer','Instagram',202986,'CN',1,5.00,435532,49465,2911,382,80,'2026-02-22 00:00:00','2026-08-26 07:10:11','2025-11-27 05:14:11','2026-09-11 00:09:11'),
(1002,4,'Wanderlust Diaries-2','wanderlust_diaries1','blogger','YouTube',168554,'CN',4,8.00,322484,45770,1250,266,85,'2026-07-05 00:00:00',NULL,'2026-04-02 05:14:11','2026-09-05 22:38:11'),
(1003,4,'Paris Insider-3','paris_insider2','kol','TikTok',41738,'FR',1,5.00,377777,79353,209,80,78,'2026-08-01 00:00:00','2026-09-12 01:24:11','2026-05-12 05:14:11','2026-09-06 18:33:11'),
(1004,4,'Euro Trip Deals-4','euro_trip_deals3','ota_partner','Website',455343,'GB',1,5.00,400694,67832,1730,330,20,'2025-12-06 00:00:00','2026-08-17 23:27:11','2026-07-24 05:14:11','2026-09-13 23:25:11'),
(1005,4,'Corporate Stays Ltd-5','corporate_stays4','corporate','LinkedIn',321834,'GB',3,8.00,351800,133897,83,640,88,'2026-01-16 00:00:00',NULL,'2026-06-23 05:14:11','2026-09-04 23:23:11'),
(1006,4,'Backpack Europe-6','backpack_europe5','influencer','Instagram',47968,'CN',4,10.00,492069,55108,1731,379,37,'2026-07-27 00:00:00',NULL,'2026-03-16 05:14:11','2026-09-02 08:13:11'),
(1007,4,'Luxury Escapes-7','luxury_escapes6','kol','YouTube',396219,'GB',2,10.00,366087,213295,1779,658,13,'2026-01-09 00:00:00',NULL,'2026-08-11 05:14:11','2026-09-02 01:30:11'),
(1008,4,'Family Holiday Tips-8','family_holiday7','blogger','Blog',77618,'CN',2,8.00,326584,107876,654,619,74,'2026-04-25 00:00:00',NULL,'2026-03-17 05:14:11','2026-09-12 20:48:11'),
(1009,4,'Marie Travel-9','marie_travel8','influencer','Instagram',313517,'GB',1,5.00,88393,47593,1646,587,88,'2025-12-30 00:00:00','2026-08-19 06:22:11','2026-05-02 05:14:11','2026-09-15 18:08:11'),
(1010,4,'Wanderlust Diaries-10','wanderlust_diaries9','blogger','YouTube',459305,'FR',3,15.00,184818,29678,1763,656,47,'2026-03-20 00:00:00',NULL,'2026-02-01 05:14:11','2026-09-09 10:25:11');

-- 达人入驻申请(覆盖 1待审 2通过 3拒绝)
INSERT INTO `affiliate_application` (`id`,`site_id`,`name`,`handle`,`type`,`platform`,`followers`,`contact_email`,`contact_phone`,`audience`,`materials`,`status`,`reviewer_id`,`reviewer_name`,`review_note`,`partner_id`,`created_at`,`updated_at`) VALUES
(1001,4,'Alice Haddad','applicant_1001','influencer','TikTok',106380,'applicant1001@mtrip.test','2294tRdxokXCShdORJQrWGbdtPXIGpXQGCjQWH18nUTOpL972lEbbw==','欧洲旅行爱好者',NULL,3,104,'客服专员','粉丝质量不达标',0,'2026-09-02 17:16:11','2026-09-13 04:28:11'),
(1002,4,'Emma Petit','applicant_1002','blogger','Instagram',111851,'applicant1002@mtrip.test','IPsYiGsAhMSKUuOS4R/ybziGoHii+3JM6WMgJX+hBCxi6a9Bm7tSLA==','欧洲旅行爱好者',NULL,1,0,'','',0,'2026-09-13 02:18:11','2026-09-06 13:21:11'),
(1003,4,'Bruno Weber','applicant_1003','blogger','YouTube',165385,'applicant1003@mtrip.test','v6577uQ0Il+55hu8s/yeZMCZHCuyuqtVjI9LVIJWs/UXRCIPw7OnuQ==','欧洲旅行爱好者',NULL,3,104,'客服专员','粉丝质量不达标',0,'2026-08-17 16:56:11','2026-09-04 01:37:11'),
(1004,4,'Tomas Haddad','applicant_1004','blogger','Instagram',65613,'applicant1004@mtrip.test','cM5L6BMikeIbo3Z/oiNFGbg6VFmeIwk8qC0QVOgDsQJPgT148EoMeg==','欧洲旅行爱好者',NULL,2,104,'客服专员','资料齐全,通过',1004,'2026-09-09 00:54:11','2026-09-14 17:34:11'),
(1005,4,'Sophie Dubois','applicant_1005','kol','YouTube',19003,'applicant1005@mtrip.test','kbv7SDkuWmRc6yoBfdWDmy4INPt0rxgO5mlrPdxpbLM82LlLtZL15g==','欧洲旅行爱好者',NULL,2,104,'客服专员','资料齐全,通过',1005,'2026-09-09 16:14:11','2026-09-15 20:33:11'),
(1006,4,'Grace Nguyen','applicant_1006','blogger','TikTok',141766,'applicant1006@mtrip.test','0VtDZ/xKPn2YfGdrwjz7+jTwQN8XMbQ43LNglATpcnMIrXgpVmb9rA==','欧洲旅行爱好者',NULL,3,104,'客服专员','粉丝质量不达标',0,'2026-08-15 02:14:11','2026-09-12 20:04:11');

-- 联盟计划配置
INSERT INTO `affiliate_program` (`id`,`site_id`,`kind`,`name`,`config`,`enabled`,`sort`,`created_at`,`updated_at`) VALUES
(1001,4,1,'酒店佣金规则','{"commission": {"affiliateType": "hotel", "rate": 10, "minBookingValue": 50}}',1,1,'2026-05-19 05:14:11','2026-05-19 05:14:11'),
(1002,4,2,'新客首单奖励','{"reward": {"trigger": "first_booking", "target": "new_user", "rewardType": "fixed", "rewardValue": 20}}',1,2,'2026-05-19 05:14:11','2026-05-19 05:14:11'),
(1003,4,3,'结算周期参数','{"setting": {"key": "settle_cycle_days", "value": 30}}',1,3,'2026-05-19 05:14:11','2026-05-19 05:14:11');

-- 联盟折扣码
INSERT INTO `affiliate_code` (`id`,`site_id`,`code`,`partner_id`,`partner_name`,`partner_handle`,`promotion_type`,`discount_value`,`discount_display`,`referral_link`,`status`,`start_date`,`end_date`,`usage_limit`,`usage_count`,`per_user_limit`,`min_spend`,`eligible_merchants`,`merchant_count`,`bookings`,`conversions`,`revenue`,`commission`,`commission_rate`,`last_used_at`,`created_by`,`created_at`,`updated_at`) VALUES
(1001,4,'AFF01001',1001,'Marie Travel-1','marie_travel0','cashback',10.00,'8% OFF','https://mtrip.test/r/AFF01001',1,'2026-07-18 00:00:00','2026-12-15 00:00:00',421,211,3,5000,'all',0,38,186,94009,10720,5.00,'2026-08-28 04:46:11','运营专员','2026-06-18 05:14:11','2026-09-06 17:22:11'),
(1002,4,'AFF01002',1002,'Wanderlust Diaries-2','wanderlust_diaries1','percentage',20.00,'20% OFF','https://mtrip.test/r/AFF01002',1,'2026-07-18 00:00:00','2026-12-15 00:00:00',211,283,2,5000,'all',0,121,161,173904,4907,8.00,'2026-09-07 02:38:11','运营专员','2026-06-18 05:14:11','2026-09-12 08:39:11'),
(1003,4,'AFF01003',1003,'Paris Insider-3','paris_insider2','fixed',8.00,'10% OFF','https://mtrip.test/r/AFF01003',4,'2026-07-18 00:00:00','2026-12-15 00:00:00',636,135,2,0,'all',0,60,110,36703,13564,5.00,'2026-09-08 20:33:11','运营专员','2026-06-18 05:14:11','2026-09-07 21:58:11'),
(1004,4,'AFF01004',1004,'Euro Trip Deals-4','euro_trip_deals3','cashback',15.00,'10% OFF','https://mtrip.test/r/AFF01004',1,'2026-07-18 00:00:00','2026-12-15 00:00:00',435,276,1,0,'all',0,5,52,289177,14573,5.00,'2026-09-15 21:12:11','运营专员','2026-06-18 05:14:11','2026-09-11 11:15:11'),
(1005,4,'AFF01005',1005,'Corporate Stays Ltd-5','corporate_stays4','fixed',10.00,'10% OFF','https://mtrip.test/r/AFF01005',3,'2026-07-18 00:00:00','2026-12-15 00:00:00',1480,236,1,5000,'all',0,76,35,81438,10755,8.00,'2026-09-07 18:42:11','运营专员','2026-06-18 05:14:11','2026-09-12 19:50:11'),
(1006,4,'AFF01006',1006,'Backpack Europe-6','backpack_europe5','fixed',8.00,'15% OFF','https://mtrip.test/r/AFF01006',2,'2026-07-18 00:00:00','2026-12-15 00:00:00',362,286,1,0,'all',0,116,147,241433,6957,10.00,'2026-09-11 04:13:11','运营专员','2026-06-18 05:14:11','2026-09-07 23:48:11'),
(1007,4,'AFF01007',1007,'Luxury Escapes-7','luxury_escapes6','percentage',20.00,'15% OFF','https://mtrip.test/r/AFF01007',1,'2026-07-18 00:00:00','2026-12-15 00:00:00',183,146,3,0,'all',0,240,144,139909,10904,10.00,'2026-08-27 02:52:11','运营专员','2026-06-18 05:14:11','2026-09-09 15:14:11'),
(1008,4,'AFF01008',1008,'Family Holiday Tips-8','family_holiday7','percentage',20.00,'20% OFF','https://mtrip.test/r/AFF01008',1,'2026-07-18 00:00:00','2026-12-15 00:00:00',153,44,2,0,'all',0,58,108,131421,3794,8.00,'2026-08-30 22:06:11','运营专员','2026-06-18 05:14:11','2026-09-11 09:31:11'),
(1009,4,'AFF01009',1009,'Marie Travel-9','marie_travel8','cashback',10.00,'10% OFF','https://mtrip.test/r/AFF01009',3,'2026-07-18 00:00:00','2026-12-15 00:00:00',450,191,2,0,'all',0,424,115,283476,24810,5.00,'2026-08-26 19:27:11','运营专员','2026-06-18 05:14:11','2026-09-12 04:06:11'),
(1010,4,'AFF01010',1010,'Wanderlust Diaries-10','wanderlust_diaries9','fixed',8.00,'20% OFF','https://mtrip.test/r/AFF01010',3,'2026-07-18 00:00:00','2026-12-15 00:00:00',1850,111,3,5000,'all',0,86,191,103648,2758,15.00,'2026-08-30 15:52:11','运营专员','2026-06-18 05:14:11','2026-09-12 17:39:11'),
(1011,4,'AFF01011',1001,'Marie Travel-1','marie_travel0','fixed',8.00,'15% OFF','https://mtrip.test/r/AFF01011',2,'2026-07-18 00:00:00','2026-12-15 00:00:00',835,233,3,5000,'all',0,310,99,114798,3674,5.00,'2026-09-03 15:49:11','运营专员','2026-06-18 05:14:11','2026-09-07 21:58:11'),
(1012,4,'AFF01012',1002,'Wanderlust Diaries-2','wanderlust_diaries1','cashback',20.00,'15% OFF','https://mtrip.test/r/AFF01012',1,'2026-07-18 00:00:00','2026-12-15 00:00:00',1880,212,2,5000,'all',0,375,132,55866,18972,8.00,'2026-09-05 19:40:11','运营专员','2026-06-18 05:14:11','2026-09-13 12:25:11');

-- 佣金流水 / 提现 / 反欺诈案件
INSERT INTO `affiliate_commission_log` (`id`,`site_id`,`partner_id`,`code_id`,`order_id`,`amount`,`commission_rate`,`status`,`created_at`,`updated_at`) VALUES
(1001,4,1001,1001,0,1296,5.00,3,'2026-07-31 18:53:11','2026-09-11 00:45:11'),
(1002,4,1002,1002,0,11233,8.00,3,'2026-08-22 05:53:11','2026-09-09 03:54:11'),
(1003,4,1003,1003,0,1179,5.00,2,'2026-09-12 17:24:11','2026-09-16 02:01:11'),
(1004,4,1004,1004,0,1911,5.00,1,'2026-08-13 13:34:11','2026-09-12 17:56:11'),
(1005,4,1005,1005,0,13058,8.00,1,'2026-07-30 19:51:11','2026-09-13 06:10:11'),
(1006,4,1006,1006,0,13036,10.00,1,'2026-07-29 01:41:11','2026-09-13 14:48:11'),
(1007,4,1007,1007,0,6621,10.00,1,'2026-08-28 06:59:11','2026-09-11 06:07:11'),
(1008,4,1008,1008,0,14735,8.00,1,'2026-07-29 22:20:11','2026-09-12 07:31:11'),
(1009,4,1009,1009,0,6465,5.00,3,'2026-08-27 21:54:11','2026-09-12 00:45:11'),
(1010,4,1010,1010,0,13267,15.00,1,'2026-08-15 08:38:11','2026-09-15 08:55:11'),
(1011,4,1001,1011,0,19078,5.00,1,'2026-08-20 20:34:11','2026-09-11 10:46:11'),
(1012,4,1002,1012,0,14398,8.00,1,'2026-09-09 11:50:11','2026-09-05 17:03:11');
INSERT INTO `affiliate_withdraw` (`id`,`site_id`,`partner_id`,`amount`,`status`,`bank_info`,`operator_id`,`paid_at`,`remark`,`created_at`,`updated_at`) VALUES
(1001,4,1001,67379,2,'qAkXehOcmWWIDuv4ROxY3ewGKn3IyIkGRq3jn+sbKIWDPgXoRCThXQSYxus=',103,NULL,'测试数据','2026-08-18 06:44:11','2026-09-12 19:42:11'),
(1002,4,1002,35746,3,'PFb+fgyMCFovvZTx8FSSE9XOnPRD9WRNVDx0uyxY/nI5USI8S2sEI8JrtU8=',103,'2026-09-05 20:57:11','测试数据','2026-08-12 09:36:11','2026-09-10 19:39:11'),
(1003,4,1003,39940,4,'WwS1uZq3U6XZK2xKESx5LGP4spPYTywELnLCmnuzq3VrhyRxVxoIqwFk0rY=',103,NULL,'测试数据','2026-08-24 14:36:11','2026-09-13 19:18:11'),
(1004,4,1004,96178,2,'zPek8BClXLwBBmzGq8KmC745GAI8Zc3L20j/3ZDuHywzCHBh89K57ZUozkk=',103,NULL,'测试数据','2026-08-28 20:37:11','2026-09-10 10:38:11'),
(1005,4,1005,53228,2,'s3eUhxpzrYHefRnupasmf2+5rkvEUMMadMSh4NJUb3AkB5BJznButrGlBks=',103,NULL,'测试数据','2026-08-26 09:51:11','2026-09-13 01:13:11'),
(1006,4,1006,40355,1,'i512vJ6JzVxS319Dl2EOxKzaRUIXCiYD0LwaXI6olywRjHIbHgxtRrvJLho=',0,NULL,'测试数据','2026-08-18 02:32:11','2026-09-13 16:33:11');
INSERT INTO `affiliate_fraud_flag` (`id`,`site_id`,`partner_id`,`partner_name`,`handle`,`fraud_score`,`risk_level`,`suspicious_activity`,`evidence_summary`,`investigation_status`,`reviewer`,`detection_date`,`created_at`,`updated_at`) VALUES
(1001,4,1001,'Marie Travel-1','marie_travel0',47,2,'异常集中下单','近 7 天订单集中在同一 IP 段',1,'运营专员','2026-09-04 00:00:00','2026-08-22 18:38:11','2026-09-15 16:18:11'),
(1002,4,1002,'Wanderlust Diaries-2','wanderlust_diaries1',68,2,'优惠券套现','近 7 天订单集中在同一 IP 段',3,'运营专员','2026-08-27 00:00:00','2026-08-16 23:02:11','2026-09-12 10:03:11'),
(1003,4,1003,'Paris Insider-3','paris_insider2',72,1,'优惠券套现','近 7 天订单集中在同一 IP 段',1,'运营专员','2026-09-08 00:00:00','2026-09-06 00:00:11','2026-09-11 21:40:11'),
(1004,4,1004,'Euro Trip Deals-4','euro_trip_deals3',47,2,'优惠券套现','近 7 天订单集中在同一 IP 段',1,'运营专员','2026-09-14 00:00:00','2026-09-05 13:54:11','2026-09-12 18:52:11'),
(1005,4,1005,'Corporate Stays Ltd-5','corporate_stays4',47,2,'异常集中下单','近 7 天订单集中在同一 IP 段',3,'运营专员','2026-08-17 00:00:00','2026-09-08 06:03:11','2026-09-10 09:29:11');
