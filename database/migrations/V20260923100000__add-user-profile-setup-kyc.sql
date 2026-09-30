SET NAMES utf8mb4;

-- App「Set Up Profile」两步向导(Figma Onboarding:Set Up Profile Overlay 2516:14427 /
-- Create account 3 2485:8211 / Create account 4 2485:8355)落库字段。
--
--   第 1 步 Complete Your Profile:头像(沿用 avatar)/ 姓名(沿用 real_name)/ 生日 / 性别 / 常住城市 / 家庭住址
--   第 2 步 Identity Verification:国籍 / 证件姓名(real_name)/ NRC 或护照号(沿用 id_card)/ 证件正反面 / 自拍
--
-- real_name_status 新增 3 = 审核中:用户提交第 2 步后置 3,等后台审核改 1(通过)/ 2(失败)。
-- 家庭住址与 real_name / id_card 同级按 PII 处理,AES 加密落库,故给足 1024 长度。
-- 幂等:按 information_schema 判列是否存在。

USE `mtrip_business`;

ALTER TABLE `user_info`
  MODIFY COLUMN `real_name_status` TINYINT NOT NULL DEFAULT 0 COMMENT '实名认证状态:0未认证 1已认证 2认证失败 3审核中';

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'user_info' AND COLUMN_NAME = 'gender');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `user_info`
     ADD COLUMN `gender`         TINYINT       NOT NULL DEFAULT 0  COMMENT ''性别:0未填 1男 2女 3其他'' AFTER `id_card`,
     ADD COLUMN `birthday`       DATE          NULL DEFAULT NULL   COMMENT ''出生日期'' AFTER `gender`,
     ADD COLUMN `city`           VARCHAR(100)  NOT NULL DEFAULT '''' COMMENT ''常住城市'' AFTER `birthday`,
     ADD COLUMN `home_address`   VARCHAR(1024) NOT NULL DEFAULT '''' COMMENT ''家庭住址(加密)'' AFTER `city`,
     ADD COLUMN `profile_setup_at` DATETIME    NULL DEFAULT NULL   COMMENT ''资料向导第1步完成时间(空=未完善,App 据此弹窗)'' AFTER `home_address`,
     ADD COLUMN `nationality`    VARCHAR(10)   NOT NULL DEFAULT '''' COMMENT ''国籍(ISO 3166-1 alpha-2)'' AFTER `profile_setup_at`,
     ADD COLUMN `id_card_front`  VARCHAR(255)  NOT NULL DEFAULT '''' COMMENT ''证件正面图URL'' AFTER `nationality`,
     ADD COLUMN `id_card_back`   VARCHAR(255)  NOT NULL DEFAULT '''' COMMENT ''证件背面图URL'' AFTER `id_card_front`,
     ADD COLUMN `selfie_image`   VARCHAR(255)  NOT NULL DEFAULT '''' COMMENT ''自拍图URL'' AFTER `id_card_back`,
     ADD COLUMN `real_name_submit_at` DATETIME NULL DEFAULT NULL   COMMENT ''实名资料提交时间'' AFTER `selfie_image`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
