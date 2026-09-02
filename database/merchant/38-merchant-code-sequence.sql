-- ============================================================
-- 商户业务编号全局序列
-- 库:mtrip_business
-- merchant_application 与 merchant_info 是独立自增表，不能用任一表主键
-- 直接生成跨表唯一的 MCH-XXXX。
-- ============================================================

SET NAMES utf8mb4;
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_code_sequence` (
  `id` TINYINT UNSIGNED NOT NULL,
  `next_value` BIGINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '下一个待分配序号',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商户业务编号全局序列';

SET @merchant_code_next := (
  SELECT COALESCE(MAX(`code_number`), 0) + 1
  FROM (
    SELECT CAST(SUBSTRING(`merchant_code`, 5) AS UNSIGNED) AS `code_number`
    FROM `merchant_application`
    WHERE `merchant_code` REGEXP '^MCH-[0-9]+$'
    UNION ALL
    SELECT CAST(SUBSTRING(`merchant_code`, 5) AS UNSIGNED) AS `code_number`
    FROM `merchant_info`
    WHERE `merchant_code` REGEXP '^MCH-[0-9]+$'
  ) AS `merchant_codes`
);

INSERT INTO `merchant_code_sequence` (`id`, `next_value`)
VALUES (1, GREATEST(1, @merchant_code_next))
ON DUPLICATE KEY UPDATE `next_value` = GREATEST(`next_value`, VALUES(`next_value`));
