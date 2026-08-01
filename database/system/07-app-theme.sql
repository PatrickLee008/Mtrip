-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M3 运营与风控]:动态 App 主题(Dynamic Theme)
-- 需求出处:PRD 模块 15(后台可配主题,按时段/优先级自动生效,无生效主题回退默认)
-- 库:mtrip_system(App 全局配置域,由 system-service 管理)
-- 生效判定:status=1 且 (start_time 空或<=now) 且 (end_time 空或>=now),取 priority 最高;
--          无命中回退 is_default=1 的默认主题
-- ============================================================
USE `mtrip_system`;

CREATE TABLE IF NOT EXISTS `app_theme` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `theme_name`  VARCHAR(100) NOT NULL COMMENT '主题名称',
  `description` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '主题描述',
  `thumbnail`   VARCHAR(255) NOT NULL DEFAULT '' COMMENT '缩略图',
  `assets`      JSON         NULL COMMENT '主题资源(splash/logo/homeHeader/navIcons/… 键值)',
  `is_default`  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认主题:0否 1是(无生效主题时回退)',
  `priority`    INT          NOT NULL DEFAULT 0 COMMENT '优先级(多主题同时生效取最高)',
  `start_time`  DATETIME     NULL DEFAULT NULL COMMENT '生效开始',
  `end_time`    DATETIME     NULL DEFAULT NULL COMMENT '生效结束',
  `status`      TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1启用 2停用',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_status` (`site_id`, `status`),
  KEY `idx_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='动态App主题表';

-- 默认 mTrip 主题(全局)——无其它生效主题时回退
INSERT IGNORE INTO `app_theme` (`id`, `site_id`, `theme_name`, `description`, `is_default`, `priority`, `status`, `assets`)
VALUES (1, 0, 'Default mTrip Theme', 'mTrip 默认主题', 1, 0, 1,
  '{"splash":"","logo":"","homeHeader":"","navAccent":"#1677ff"}');
