-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M1 预订闭环]:常旅客(Frequent Traveler)
-- 需求出处:PRD 模块 5/7(下单可从常旅客带入;证件号加密存储、列表脱敏)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `user_traveler` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`        BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `nationality`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '国籍',
  `first_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '名',
  `last_name`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '姓',
  `id_type`        TINYINT      NOT NULL DEFAULT 2 COMMENT '证件类型:1NRC 2护照 3其他',
  `id_no`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '证件号(AES加密)',
  `id_expire_date` DATE         NULL DEFAULT NULL COMMENT '证件到期日',
  `is_default`     TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认:0否 1是',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_user` (`site_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='常旅客表';
