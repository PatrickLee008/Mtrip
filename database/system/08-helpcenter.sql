-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 后续阶段]:帮助中心(全新)
-- 设计源:docs/redesign/super-admin-portal/modules/12-help-center.md
-- 库:mtrip_system(平台内容,由 system-service 管理)
-- ============================================================
USE `mtrip_system`;

-- FAQ 分类
CREATE TABLE IF NOT EXISTS `help_category` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`        VARCHAR(50)  NOT NULL COMMENT '分类名称',
  `icon`        VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '图标(emoji)',
  `description` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '描述',
  `sort`        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `visible`     TINYINT      NOT NULL DEFAULT 1 COMMENT '是否可见:0否 1是',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='帮助中心分类';

-- FAQ 文章
CREATE TABLE IF NOT EXISTS `help_article` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `title`       VARCHAR(200) NOT NULL COMMENT '标题',
  `category_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分类ID',
  `audience`    VARCHAR(20)  NOT NULL DEFAULT 'customer' COMMENT '受众:customer/merchant/affiliate/influencer/all',
  `content`     MEDIUMTEXT   NULL COMMENT '正文(富文本)',
  `attachments` JSON         NULL COMMENT '附件',
  `views`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '浏览量',
  `author`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '作者(快照)',
  `status`      TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1已发布 2草稿 3已归档',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='帮助中心 FAQ 文章';

-- 公告
CREATE TABLE IF NOT EXISTS `help_announcement` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `title`       VARCHAR(255) NOT NULL COMMENT '标题',
  `audience`    VARCHAR(20)  NOT NULL DEFAULT 'all' COMMENT '受众',
  `content`     TEXT         NULL COMMENT '正文',
  `priority`    TINYINT      NOT NULL DEFAULT 2 COMMENT '优先级:1高 2普通 3低',
  `start_time`  DATETIME     NULL DEFAULT NULL COMMENT '生效开始',
  `end_time`    DATETIME     NULL DEFAULT NULL COMMENT '生效结束',
  `status`      TINYINT      NOT NULL DEFAULT 4 COMMENT '状态:1生效 2待生效 3已过期 4草稿',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='帮助中心公告';

-- 搜索日志(搜索分析)
CREATE TABLE IF NOT EXISTS `help_search_log` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `keyword`      VARCHAR(100) NOT NULL COMMENT '搜索词',
  `result_count` INT          NOT NULL DEFAULT 0 COMMENT '命中结果数',
  `user_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户ID',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '搜索时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_keyword` (`keyword`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='帮助中心搜索日志';
