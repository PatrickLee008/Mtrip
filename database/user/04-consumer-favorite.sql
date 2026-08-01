-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M2 促销与用户资产]:收藏酒店(Saved Hotels)
-- 需求出处:PRD 模块 7(收藏列表/滑动删除/跨设备同步;可无限收藏)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `user_favorite` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `goods_id`   BIGINT UNSIGNED NOT NULL COMMENT '酒店商品ID',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_goods` (`user_id`, `goods_id`),
  KEY `idx_site_user` (`site_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户收藏酒店表';
