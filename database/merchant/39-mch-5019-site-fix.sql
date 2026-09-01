SET NAMES utf8mb4;
USE `mtrip_business`;

-- MCH-5019 was created by the super-admin onboarding form before that form sent
-- a required siteId. Move its existing, verified hotel chain from platform scope
-- (site_id=0) to the explicitly confirmed global business site (site_id=1).
START TRANSACTION;

SET @merchant_id := (SELECT `id` FROM `merchant_info` WHERE `merchant_code` = 'MCH-5019' LIMIT 1);
SET @application_id := (SELECT `id` FROM `merchant_application` WHERE `merchant_code` = 'MCH-5019' LIMIT 1);
SET @goods_id := (SELECT `id` FROM `goods_info` WHERE `merchant_id` = @merchant_id AND `goods_type` = 1 AND `deleted_at` IS NULL ORDER BY `id` LIMIT 1);

UPDATE `merchant_application` SET `site_id` = 1 WHERE `id` = @application_id AND `site_id` = 0;
UPDATE `merchant_application_business` SET `site_id` = 1 WHERE `application_id` = @application_id AND `site_id` = 0;
UPDATE `merchant_application_note` SET `site_id` = 1 WHERE `application_id` = @application_id AND `site_id` = 0;
UPDATE `merchant_info` SET `site_id` = 1 WHERE `id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_store` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_admin` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_access_code_log` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_activity_log` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_property_history` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_document_event` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `merchant_verify_document` SET `site_id` = 1
WHERE (`merchant_id` = @merchant_id OR `application_id` = @application_id) AND `site_id` = 0;
UPDATE `merchant_verify_timeline` SET `site_id` = 1
WHERE (`merchant_id` = @merchant_id OR `application_id` = @application_id) AND `site_id` = 0;
UPDATE `goods_info` SET `site_id` = 1 WHERE `merchant_id` = @merchant_id AND `site_id` = 0;
UPDATE `hotel_room_type` SET `site_id` = 1 WHERE `goods_id` = @goods_id AND `site_id` = 0;
UPDATE `hotel_room_type_revision` SET `site_id` = 1
WHERE (`merchant_id` = @merchant_id OR `goods_id` = @goods_id) AND `site_id` = 0;

COMMIT;
