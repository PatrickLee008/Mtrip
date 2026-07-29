-- ============================================================
-- 系统表 06:客户端密钥 / 接口权限模板(文档模块12/13)
-- 库:mtrip_system
-- 字段与 backend/shared ClientSignMiddleware 严格对齐
-- ============================================================
USE `mtrip_system`;

-- 客户端接口权限模板表
CREATE TABLE IF NOT EXISTS `sys_client_perm_template` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,全局模板=0',
  `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称(如:全权限移动端模板)',
  `template_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '模板类型:1全局模板 2站点模板',
  `description`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '模板描述',
  `rule_mode`     TINYINT      NOT NULL DEFAULT 1 COMMENT '规则模式:1白名单(仅列表内可调) 2黑名单(列表内禁止)',
  `api_list`      JSON         NULL COMMENT '接口标识集合(支持前缀通配,如 /api/v1/hotel/*)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户端接口权限模板表';

-- 客户端密钥表(移动端 App/H5 接入鉴权)
CREATE TABLE IF NOT EXISTS `sys_client` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,全局客户端=0',
  `client_name`      VARCHAR(50)  NOT NULL COMMENT '客户端名称(如 Mtrip-Android)',
  `client_id`        VARCHAR(50)  NOT NULL COMMENT '客户端唯一标识 ClientId(禁止修改)',
  `client_secret`    VARCHAR(500) NOT NULL COMMENT 'ClientSecret(AES加密存储)',
  `client_type`      TINYINT      NOT NULL DEFAULT 1 COMMENT '客户端类型:1Android 2iOS 3H5',
  `perm_template_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '绑定接口权限模板ID,0=不限',
  `qps_limit`        INT          NOT NULL DEFAULT 50 COMMENT '接口QPS限流阈值,0=不限',
  `ip_whitelist`     VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '允许IP白名单(逗号分隔,空=不限)',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `expire_at`        DATETIME     NULL DEFAULT NULL COMMENT '过期时间,NULL=永不过期',
  `remark`           VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_client_id` (`client_id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_perm_template_id` (`perm_template_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户端密钥表';
