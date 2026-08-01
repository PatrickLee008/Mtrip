-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / Module 3]:后台可配置筛选项与排序项(Hotel Listing Filter & Sorting)
-- 需求出处:PRD 模块3(筛选/排序项后台可配:增删/改值/禁用/排序,无需发版)
-- 库:mtrip_business;C 端 /app/goods/filters 读取启用项渲染,list 按 filter_key/sort_key 落地过滤排序
-- ============================================================
USE `mtrip_business`;

-- 筛选项配置
CREATE TABLE IF NOT EXISTS `goods_filter_config` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局默认',
  `filter_key`     VARCHAR(50)  NOT NULL COMMENT '筛选键(后端白名单:price/star/amenity/breakfast/free_cancel/review_score)',
  `filter_name`    VARCHAR(100) NOT NULL COMMENT '显示名(中文)',
  `filter_name_en` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '显示名(英文)',
  `filter_type`    TINYINT      NOT NULL DEFAULT 2 COMMENT '类型:1范围 2多选 3布尔',
  `options`        JSON         NULL COMMENT '可选项([{value,label}],多选类型用)',
  `sort`           INT          NOT NULL DEFAULT 0 COMMENT '展示排序(小在前)',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_site_key` (`site_id`, `filter_key`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商品筛选项配置表';

-- 排序项配置
CREATE TABLE IF NOT EXISTS `goods_sort_config` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局默认',
  `sort_key`     VARCHAR(50)  NOT NULL COMMENT '排序键(后端白名单:default/price_asc/price_desc/star/rating/distance/sales)',
  `sort_name`    VARCHAR(100) NOT NULL COMMENT '显示名(中文)',
  `sort_name_en` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '显示名(英文)',
  `sort`         INT          NOT NULL DEFAULT 0 COMMENT '展示排序(小在前)',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_site_key` (`site_id`, `sort_key`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商品排序项配置表';

-- 全局默认筛选项(site_id=0)
INSERT IGNORE INTO `goods_filter_config` (`site_id`, `filter_key`, `filter_name`, `filter_name_en`, `filter_type`, `options`, `sort`, `status`) VALUES
(0, 'price',        '价格区间',   'Price Range',    1, NULL, 1, 1),
(0, 'star',         '星级',       'Star Rating',    2, '[{"value":3,"label":"3星"},{"value":4,"label":"4星"},{"value":5,"label":"5星"}]', 2, 1),
(0, 'amenity',      '设施',       'Amenities',      2, '[{"value":"wifi","label":"WiFi"},{"value":"parking","label":"停车"},{"value":"pool","label":"泳池"},{"value":"gym","label":"健身"}]', 3, 1),
(0, 'breakfast',    '含早餐',     'Breakfast',      3, NULL, 4, 1),
(0, 'free_cancel',  '免费取消',   'Free Cancellation', 3, NULL, 5, 1),
(0, 'review_score', '评分',       'Guest Rating',   1, NULL, 6, 1);

-- 全局默认排序项(site_id=0)
INSERT IGNORE INTO `goods_sort_config` (`site_id`, `sort_key`, `sort_name`, `sort_name_en`, `sort`, `status`) VALUES
(0, 'default',    '综合推荐',   'Recommended',   1, 1),
(0, 'price_asc',  '低价优先',   'Lowest Price',  2, 1),
(0, 'price_desc', '高价优先',   'Highest Price', 3, 1),
(0, 'star',       '星级高到低', 'Star Rating',   4, 1),
(0, 'rating',     '好评优先',   'Top Rated',     5, 1),
(0, 'distance',   '距离最近',   'Nearest',       6, 1);
