-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M1 预订闭环]:长住折扣梯度(可配置)
-- 需求出处:PRD 模块 2.1 Long-Stay Deals(按住宿夜数命中最高档,后台可配)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `marketing_longstay_tier` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `min_nights`    INT          NOT NULL DEFAULT 7 COMMENT '最低住宿夜数(含)',
  `discount_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '折扣率%(30.00=立减30%)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_nights` (`site_id`, `min_nights`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='长住折扣梯度表';
