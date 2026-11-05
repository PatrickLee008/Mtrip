SET NAMES utf8mb4;
USE `mtrip_system`;

-- Empty values deliberately fail closed until an authorized platform operator
-- configures each site's limits through the existing site configuration screen.
INSERT IGNORE INTO sys_site_config (site_id, config_group, config_key, config_value, config_name)
SELECT s.id, 'operate', k.config_key, '', k.config_name
FROM sys_site s CROSS JOIN (
  SELECT 'merchant_promotion_max_percent' AS config_key, 'Merchant promotion maximum discount (%)' AS config_name
  UNION ALL SELECT 'merchant_promotion_max_amount', 'Merchant promotion maximum fixed discount'
  UNION ALL SELECT 'merchant_promotion_min_payable_percent', 'Merchant promotion minimum payable (%)'
) k WHERE s.deleted_at IS NULL;
