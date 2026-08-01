-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / Module 6.1]:促销中心活动(Promotion Center)
-- 需求出处:PRD 模块6.1(内嵌 Web 促销落地页 + 活动 Banner + 从活动页领券 + Use Now 跳转)
-- 库:mtrip_business;C 端 /app/marketing/campaigns 读取展示,活动内关联可领优惠券
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `marketing_campaign` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `title`       VARCHAR(200) NOT NULL COMMENT '活动标题',
  `subtitle`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '副标题',
  `banner`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '活动头图',
  `landing_url` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '内嵌 Web 落地页URL',
  `coupon_ids`  JSON         NULL COMMENT '活动关联可领优惠券模板ID列表',
  `start_time`  DATETIME     NULL DEFAULT NULL COMMENT '展示开始',
  `end_time`    DATETIME     NULL DEFAULT NULL COMMENT '展示结束',
  `sort`        INT          NOT NULL DEFAULT 0 COMMENT '排序(小在前)',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0草稿 1上架 2下架',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='促销中心活动表';
