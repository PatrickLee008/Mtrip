-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M1 预订闭环]:酒店评价(Guest Reviews & Ratings)
-- 需求出处:PRD 模块 4(详情页展示已核实住客评价与评分)、模块10(离店后催评)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `goods_review` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`      BIGINT UNSIGNED NOT NULL COMMENT '酒店商品ID',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `order_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID(每单限评一次)',
  `rating`        TINYINT      NOT NULL DEFAULT 5 COMMENT '评分1-5',
  `content`       VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '评价内容',
  `images`        JSON         NULL COMMENT '评价图片',
  `reply_content` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '商户/平台回复',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:0待审 1显示 2隐藏',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order` (`order_id`),
  KEY `idx_goods_status` (`site_id`, `goods_id`, `status`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='酒店评价表';
