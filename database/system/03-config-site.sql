-- ============================================================
-- 系统表 03:全局配置 / 多站点(文档模块5/6)
-- 库:mtrip_system
-- ============================================================
USE `mtrip_system`;

-- 全局系统配置表(key-value,按分组管理)
CREATE TABLE IF NOT EXISTS `sys_config` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_group` VARCHAR(50)  NOT NULL DEFAULT 'base' COMMENT '分组:base平台基础 security安全策略 upload上传限制 client客户端与日志',
  `config_key`   VARCHAR(100) NOT NULL COMMENT '配置键',
  `config_value` TEXT         NULL COMMENT '配置值',
  `value_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '值类型:1字符串 2数字 3布尔 4JSON',
  `config_name`  VARCHAR(100) NOT NULL DEFAULT '' COMMENT '配置项名称',
  `default_value` TEXT        NULL COMMENT '系统默认值(一键重置用)',
  `remark`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`),
  KEY `idx_config_group` (`config_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局系统配置表';

-- 站点表(树形:国家/区域/城市)
CREATE TABLE IF NOT EXISTS `sys_site` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键(即站点ID)',
  `parent_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '上级站点ID,0=根(全球)',
  `site_name`     VARCHAR(100) NOT NULL COMMENT '站点名称',
  `site_type`     TINYINT      NOT NULL DEFAULT 3 COMMENT '站点类型:1国家 2区域 3城市',
  `site_domain`   VARCHAR(200) NOT NULL DEFAULT '' COMMENT '站点域名(独立H5/后台域名)',
  `country_code`  VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '国家编码(ISO 3166,如 FR)',
  `timezone`      VARCHAR(50)  NOT NULL DEFAULT 'UTC' COMMENT '时区(如 Europe/Paris)',
  `currency`      VARCHAR(10)  NOT NULL DEFAULT 'EUR' COMMENT '默认货币单位(ISO 4217)',
  `language`      VARCHAR(10)  NOT NULL DEFAULT 'en-US' COMMENT '默认语言',
  `contact_name`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '站点联系人',
  `contact_email` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '联系邮箱',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `sort`          INT          NOT NULL DEFAULT 0 COMMENT '排序号',
  `remark`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT '站点备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站点表(树形层级)';

-- 站点差异化配置表(每站点独立参数,key-value)
CREATE TABLE IF NOT EXISTS `sys_site_config` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL COMMENT '所属站点ID',
  `config_group` VARCHAR(50)  NOT NULL DEFAULT 'local' COMMENT '分组:local本地化 page页面 operate运营 push推送',
  `config_key`   VARCHAR(100) NOT NULL COMMENT '配置键(如 vat_rate/site_logo/commission_rate)',
  `config_value` TEXT         NULL COMMENT '配置值',
  `config_name`  VARCHAR(100) NOT NULL DEFAULT '' COMMENT '配置项名称',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_site_key` (`site_id`, `config_key`),
  KEY `idx_config_group` (`config_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站点差异化配置表';
