-- ============================================================
-- 物业关联历史
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 酒店物业关联历史
INSERT INTO `merchant_property_history` (`id`,`site_id`,`merchant_id`,`store_id`,`source_business_id`,`version`,`before_json`,`after_json`,`note`,`actor_id`,`actor_name`,`created_at`) VALUES
(1001,3,1001,2001,2001,1,NULL,'{"store_name": "Louvre Garden Hotel - Brussels 1号店", "city_key": "brussels", "country_code": "BE"}','测试数据初始化关联',101,'站点管理员','2026-08-19 13:45:43'),
(1002,3,1001,2002,2002,1,NULL,'{"store_name": "Louvre Garden Hotel - Brussels 2号店", "city_key": "brussels", "country_code": "BE"}','测试数据初始化关联',101,'站点管理员','2026-08-25 11:16:43'),
(1003,4,1002,2003,2003,1,NULL,'{"store_name": "Versailles Palace - Amsterdam 1号店", "city_key": "amsterdam", "country_code": "NL"}','测试数据初始化关联',101,'站点管理员','2026-08-17 17:26:43'),
(1004,4,1002,2004,2004,1,NULL,'{"store_name": "Versailles Palace - Brussels 2号店", "city_key": "brussels", "country_code": "BE"}','测试数据初始化关联',101,'站点管理员','2026-07-30 08:31:43'),
(1005,4,1003,2005,2005,1,NULL,'{"store_name": "Alpes Mountain Lodge - Amsterdam 1号店", "city_key": "amsterdam", "country_code": "NL"}','测试数据初始化关联',101,'站点管理员','2026-08-16 21:08:43'),
(1006,1,1004,2006,2006,1,NULL,'{"store_name": "Brussels Central Hotel - Nice 1号店", "city_key": "nice", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-08-01 12:55:43');
