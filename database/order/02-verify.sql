-- ============================================================
-- 业务表 06:核销设备与规则(业务模块9)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 核销设备表(线下核销终端)
CREATE TABLE IF NOT EXISTS `verify_device` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '绑定商户ID',
  `device_name`   VARCHAR(100) NOT NULL COMMENT '设备名称',
  `device_sn`     VARCHAR(64)  NOT NULL COMMENT '设备序列号(唯一)',
  `device_secret` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '设备密钥(AES加密)',
  `bind_goods`    JSON         NULL COMMENT '设备可核销商品范围,NULL=商户全部商品',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `online_status` TINYINT      NOT NULL DEFAULT 0 COMMENT '在线状态:0离线 1在线(心跳超时标记离线)',
  `last_heartbeat` DATETIME    NULL DEFAULT NULL COMMENT '最后心跳时间',
  `remark`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_sn` (`device_sn`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='核销设备表';

-- 核销规则表
CREATE TABLE IF NOT EXISTS `verify_rule` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `rule_name`      VARCHAR(100) NOT NULL COMMENT '规则名称',
  `goods_type`     TINYINT      NOT NULL DEFAULT 2 COMMENT '适用商品类型:1酒店 2门票',
  `valid_days`     INT          NOT NULL DEFAULT 1 COMMENT '门票有效期(天)',
  `per_user_limit` INT          NOT NULL DEFAULT 1 COMMENT '单人核销次数限制',
  `expire_forbid`  TINYINT      NOT NULL DEFAULT 1 COMMENT '过期不可核销:0否 1是',
  `time_range`     JSON         NULL COMMENT '可核销时段限制',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='核销规则表';
