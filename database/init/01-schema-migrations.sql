-- MySQL 生产迁移执行账本。空库初始化与 scripts/db-migrate.sh 共用这一份定义。
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `mtrip_system`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

USE `mtrip_system`;

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version`       CHAR(14) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UTC 时间版本 YYYYMMDDHHMMSS',
  `description`   VARCHAR(190) NOT NULL COMMENT '迁移说明(来自文件名)',
  `script_path`   VARCHAR(255) NOT NULL COMMENT '仓库相对路径',
  `checksum`      CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SQL 文件 SHA-256',
  `status`        VARCHAR(16) NOT NULL COMMENT 'running/applied/failed',
  `attempt_id`    CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '本次执行唯一标识,防并发串改',
  `git_commit`    CHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '' COMMENT '发布提交',
  `applied_by`    VARCHAR(128) NOT NULL DEFAULT '' COMMENT '执行节点与用户',
  `started_at`    DATETIME(6) NOT NULL COMMENT '开始时间',
  `finished_at`   DATETIME(6) NULL COMMENT '完成或失败时间',
  `execution_ms`  INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '执行耗时毫秒',
  `error_message` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '失败摘要',
  PRIMARY KEY (`version`),
  UNIQUE KEY `uk_schema_migrations_path` (`script_path`),
  CONSTRAINT `chk_schema_migrations_status` CHECK (`status` IN ('running', 'applied', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='生产数据库迁移执行账本';
