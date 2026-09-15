USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_employee_property` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL COMMENT '站点ID',
  `admin_id`    BIGINT UNSIGNED NOT NULL COMMENT 'merchant_admin.id',
  `property_id` BIGINT UNSIGNED NOT NULL COMMENT 'merchant_store.id',
  `created_by`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分配人账号ID',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_property` (`admin_id`,`property_id`),
  KEY `idx_site_property` (`site_id`,`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户员工物业授权';

INSERT IGNORE INTO `merchant_menu`
  (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`,`account_scope`)
VALUES
  (20105,201,'分配物业','Assign Properties','mch:account:property-assign',3,5,'1,2');
