-- ============================================================
-- 系统表 04:文件存储 / 文件库(文档模块7)
-- 库:mtrip_system
-- ============================================================
USE `mtrip_system`;

-- 存储配置表(多驱动:S3/R2/本地,密钥AES加密存储)
CREATE TABLE IF NOT EXISTS `sys_storage` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局存储',
  `driver`       VARCHAR(20)  NOT NULL DEFAULT 's3' COMMENT '存储驱动:s3/r2/local',
  `storage_name` VARCHAR(100) NOT NULL COMMENT '存储配置名称',
  `bucket`       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '存储桶名称',
  `region`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '地区节点',
  `access_key`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'AccessKey(AES加密)',
  `secret_key`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'SecretKey(AES加密)',
  `cdn_domain`   VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'CDN加速域名',
  `path_prefix`  VARCHAR(100) NOT NULL DEFAULT '' COMMENT '文件访问前缀',
  `expire_days`  INT          NOT NULL DEFAULT 0 COMMENT '文件过期时间(天),0=永久',
  `is_default`   TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认存储:0否 1是',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_driver` (`driver`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件存储配置表';

-- 文件库表(全部上传文件)
CREATE TABLE IF NOT EXISTS `sys_file` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `storage_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '存储配置ID',
  `file_name`   VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `file_path`   VARCHAR(500) NOT NULL COMMENT '存储路径/对象Key',
  `file_url`    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '访问URL',
  `file_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1图片 2文档 3视频 4其他',
  `mime_type`   VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'MIME类型',
  `file_size`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文件大小(字节)',
  `biz_type`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '关联业务(goods/merchant/avatar等)',
  `uploader_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '上传人ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_file_type` (`file_type`),
  KEY `idx_biz_type` (`biz_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件库表';
