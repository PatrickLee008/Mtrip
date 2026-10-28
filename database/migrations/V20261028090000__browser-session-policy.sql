SET NAMES utf8mb4;
USE `mtrip_system`;

-- Preserve explicit custom values; migrate the old stock 120-minute setting once.
UPDATE `sys_config`
SET `config_value` = IF(`config_value` = '120' AND `default_value` = '120', '30', `config_value`),
    `default_value` = '30', `remark` = 'Admin/Merchant Web AccessToken: 5-120 minutes; silent refresh'
WHERE `config_key` = 'jwt_expire_minutes' AND `deleted_at` IS NULL;

UPDATE `sys_config` SET `remark` = 'Admin/Merchant Web absolute session lifetime: 1-30 days; rotation does not extend it'
WHERE `config_key` = 'jwt_refresh_days' AND `deleted_at` IS NULL;
