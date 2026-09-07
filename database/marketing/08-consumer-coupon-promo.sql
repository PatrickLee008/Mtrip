-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App / C-M6 定价促销 · C-M6.1 我的优惠券](2026-09 第1周)
--
-- 两件事:
--   1) 统一优惠券详情口径 —— `marketing_coupon` 补「适用房型」与「叠加规则」两列。
--      原表只有 `goods_scope`/`goods_ids`(商品级 = 酒店级),表达不了「仅某几个房型可用」;
--      也没有任何叠加规则字段,而 C 端券详情与结账都要展示「是否可与其他优惠叠加」。
--   2) 促销码兑换 —— `marketing_promo_code` 原本自带 discount_type/value,是「下单时直接抵扣」的模型,
--      与 C 端「兑换后进我的优惠券」对不上;这里补 `coupon_id` 指向要发放的券模板,
--      并新增兑换记录表以支撑「每人限兑」与「重复兑换」两条校验
--      (原表只有 `usage_count` 总量,没有按人的记录,`per_user_limit` 实际上无法生效)。
--
-- 库:mtrip_business
-- 幂等:全部先查 information_schema,已存在则跳过;可重复执行。
-- ============================================================
USE `mtrip_business`;

-- ---- 1. marketing_coupon.sku_ids:适用房型(为空 = 该酒店全部房型) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'sku_ids'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `sku_ids` JSON NULL COMMENT ''适用房型/票种ID列表(为空=不限房型)'' AFTER `goods_ids`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. marketing_coupon.stackable:叠加规则 ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'stackable'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `stackable` TINYINT NOT NULL DEFAULT 0 COMMENT ''叠加规则:0不可与其他优惠叠加 1可叠加'' AFTER `valid_days`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 3. marketing_promo_code.coupon_id:兑换后发放的券模板 ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_promo_code'
        AND COLUMN_NAME = 'coupon_id'
    ),
    'DO 0',
    'ALTER TABLE `marketing_promo_code` ADD COLUMN `coupon_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''兑换后发放的优惠券模板ID(0=未绑定券,C端不可兑换)'' AFTER `campaign_id`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 4. 促销码兑换记录(每人限兑 / 重复兑换校验的唯一依据) ----
CREATE TABLE IF NOT EXISTS `marketing_promo_code_redeem` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `promo_code_id` BIGINT UNSIGNED NOT NULL COMMENT '促销码ID',
  `code`          VARCHAR(50)  NOT NULL COMMENT '促销码(快照,便于运营按码检索)',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '兑换用户ID',
  `coupon_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '发放的券模板ID',
  `receive_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '生成的领券记录ID(marketing_coupon_receive.id)',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '兑换时间',
  PRIMARY KEY (`id`),
  KEY `idx_code_user` (`promo_code_id`, `user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='促销码兑换记录';
