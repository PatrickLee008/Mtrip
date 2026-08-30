-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量:存储渠道支持阿里云 OSS + 公共资源文件类型补充
-- 库:mtrip_system
-- ============================================================
USE `mtrip_system`;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_storage' AND COLUMN_NAME='endpoint')=0,
 'ALTER TABLE sys_storage ADD COLUMN endpoint VARCHAR(200) NOT NULL DEFAULT '''' COMMENT ''对象存储 Endpoint,如 oss-cn-hangzhou.aliyuncs.com'' AFTER region', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `sys_storage` MODIFY COLUMN `driver` VARCHAR(20) NOT NULL DEFAULT 's3' COMMENT '存储驱动:s3/r2/local/aliyun';
ALTER TABLE `sys_file` MODIFY COLUMN `file_type` TINYINT NOT NULL DEFAULT 1 COMMENT '类型:1图片 2文档 3视频 4其他 5音频';

CREATE TABLE IF NOT EXISTS `sys_file_dir` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `biz_type`    VARCHAR(50)  NOT NULL DEFAULT 'public_resource' COMMENT '业务类型',
  `dir_name`    VARCHAR(100) NOT NULL COMMENT '目录名称',
  `dir_path`    VARCHAR(500) NOT NULL COMMENT '完整目录路径',
  `parent_path` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '父目录路径',
  `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT '排序值',
  `created_by`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '创建人ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_biz_parent` (`site_id`, `biz_type`, `parent_path`),
  KEY `idx_site_biz_path` (`site_id`, `biz_type`, `dir_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='文件目录表';
