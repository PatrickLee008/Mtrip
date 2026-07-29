-- ============================================================
-- 系统表 05:支付渠道 / 国际短信 / 地图配置(文档模块8/9/10)
-- 库:mtrip_system(密钥类字段一律 AES 加密存储,前端脱敏)
-- ============================================================
USE `mtrip_system`;

-- 支付渠道表(Stripe/PayPal,分站点配置)
CREATE TABLE IF NOT EXISTS `sys_pay_channel` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `channel_name`   VARCHAR(50)  NOT NULL COMMENT '渠道名称(Stripe/PayPal)',
  `channel_code`   VARCHAR(20)  NOT NULL COMMENT '渠道标识:stripe/paypal',
  `api_key`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'API密钥(AES加密)',
  `merchant_no`    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '商户ID',
  `webhook_url`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Webhook回调地址',
  `fee_rate`       DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '渠道手续费比例%',
  `min_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '单笔最小支付限额',
  `max_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '单笔最大支付限额,0=不限',
  `currencies`     JSON         NULL COMMENT '支持货币列表',
  `split_enabled`  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否启用分账:0否 1是',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `remark`         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_channel_code` (`channel_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付渠道表';

-- 国际短信渠道表(Twilio/MessageBird)
CREATE TABLE IF NOT EXISTS `sys_sms_channel` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `provider_name`   VARCHAR(50)  NOT NULL COMMENT '服务商名称(Twilio/MessageBird)',
  `provider_code`   VARCHAR(20)  NOT NULL COMMENT '服务商标识:twilio/messagebird',
  `api_key`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'API密钥(AES加密)',
  `account_sid`     VARCHAR(200) NOT NULL DEFAULT '' COMMENT '账号SID',
  `sign_name`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '短信签名',
  `region_whitelist` JSON        NULL COMMENT '国际短信发送地区白名单',
  `code_expire_sec` INT          NOT NULL DEFAULT 300 COMMENT '验证码有效时长(秒)',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`      DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_provider_code` (`provider_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='国际短信渠道表';

-- 短信模板表(依附渠道+站点)
CREATE TABLE IF NOT EXISTS `sys_sms_template` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `channel_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属短信渠道ID',
  `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称',
  `template_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1注册验证码 2订单通知 3退款通知 4商户审核通知',
  `content`       VARCHAR(1000) NOT NULL COMMENT '模板内容(含 ${var} 占位符)',
  `variables`     JSON         NULL COMMENT '变量占位符定义',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_channel_id` (`channel_id`),
  KEY `idx_template_type` (`template_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信模板表';

-- 短信发送日志表
CREATE TABLE IF NOT EXISTS `sys_sms_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `channel_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '短信渠道ID',
  `template_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '短信模板ID',
  `mobile`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '手机号(加密)',
  `content`     VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '发送内容',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '发送状态:1成功 2失败 3发送中',
  `fail_reason` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '失败原因',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信发送日志表';

-- 地图服务配置表(Google Maps,分站点)
CREATE TABLE IF NOT EXISTS `sys_map_config` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `provider`       VARCHAR(20)  NOT NULL DEFAULT 'google' COMMENT '服务商(固定 google)',
  `api_key`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'API Key(AES加密)',
  `map_language`   VARCHAR(10)  NOT NULL DEFAULT 'en' COMMENT '地图语言',
  `default_zoom`   TINYINT      NOT NULL DEFAULT 12 COMMENT '默认缩放等级',
  `geocode_enabled` TINYINT     NOT NULL DEFAULT 1 COMMENT '是否开启地址逆解析:0否 1是',
  `locate_enabled` TINYINT      NOT NULL DEFAULT 1 COMMENT '是否开启定位获取:0否 1是',
  `region_limit`   JSON         NULL COMMENT '地区访问限制',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地图服务配置表';
