-- ============================================================
-- 物业关联历史
-- 由 test/gen_testdata.py 自动生成,请勿手工编辑
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;


-- 酒店物业关联历史
INSERT INTO `merchant_property_history` (`id`,`site_id`,`merchant_id`,`store_id`,`source_business_id`,`version`,`before_json`,`after_json`,`note`,`actor_id`,`actor_name`,`created_at`) VALUES
(1001,3,1001,2001,2001,1,NULL,'{"store_name": "Saint-Germain Inn - Marseille 1号店", "city_key": "marseille", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-08-21 10:22:11'),
(1002,3,1001,2002,2002,1,NULL,'{"store_name": "Saint-Germain Inn - Bordeaux 2号店", "city_key": "bordeaux", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-08-30 14:10:11'),
(1003,4,1002,2003,2003,1,NULL,'{"store_name": "Louvre Garden Hotel - Lyon 1号店", "city_key": "lyon", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-08-21 12:45:11'),
(1004,4,1003,2004,2004,1,NULL,'{"store_name": "Eiffel Tower Attraction - Marseille 1号店", "city_key": "marseille", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-08-19 16:53:11'),
(1005,4,1003,2005,2005,1,NULL,'{"store_name": "Eiffel Tower Attraction - Bordeaux 2号店", "city_key": "bordeaux", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-09-05 00:42:11'),
(1006,4,1003,2006,2006,1,NULL,'{"store_name": "Eiffel Tower Attraction - Bordeaux 3号店", "city_key": "bordeaux", "country_code": "FR"}','测试数据初始化关联',101,'站点管理员','2026-09-07 00:23:11');
