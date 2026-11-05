SET NAMES utf8mb4;

-- 促销中心活动分类(Consumer App PRD 模块 6.1「Support seasonal, weekly, monthly, and special event campaigns」,QA P_TC_005)。
--
--   marketing_campaign.campaign_type  活动类型:0 常规 1 季节 2 每周 3 每月 4 节日/特别活动。
--                                      后台「促销活动」编辑时选择;App 促销中心按类型分页签筛选。存量活动默认 0(常规)。
--
-- 幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'marketing_campaign' AND COLUMN_NAME = 'campaign_type');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `marketing_campaign` ADD COLUMN `campaign_type` TINYINT NOT NULL DEFAULT 0 COMMENT ''活动类型:0常规 1季节 2每周 3每月 4节日/特别活动'' AFTER `subtitle`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
