-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 商户管理整改 B1]:商户通知中心
-- 需求源:docs/redesign/需求分析-商户管理模块.md §3.5.6(Send Notification 抽屉)
-- 库:mtrip_business;与 C 端 notify_record 分表,面向 merchant_id
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_notify` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`     BIGINT UNSIGNED NOT NULL COMMENT '接收商户ID',
  `category`        VARCHAR(30)  NOT NULL DEFAULT 'system' COMMENT '通知分类(booking/promotion/rewards/wallet/refund/account/security/support/system)',
  `title`           VARCHAR(200) NOT NULL DEFAULT '' COMMENT '通知标题',
  `message`         VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '通知正文',
  `deep_link_type`  VARCHAR(30)  NOT NULL DEFAULT 'none' COMMENT '深链类型(booking_detail/wallet/promotion/coupon/user_profile/external_url/none)',
  `deep_link_value` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '深链地址/ID',
  `channels`        VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '下发渠道(push,inapp,email,sms 逗号分隔)',
  `send_type`       TINYINT      NOT NULL DEFAULT 1 COMMENT '发送方式:1立即 2定时',
  `send_at`         DATETIME     NULL DEFAULT NULL COMMENT '定时发送时间(立即发送=发送时刻)',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1已发送 2定时中 3发送失败',
  `read_at`         DATETIME     NULL DEFAULT NULL COMMENT '商户端已读时间',
  `read_by`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户端已读操作员ID',
  `operator_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '发送操作人ID',
  `operator_name`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '发送操作人姓名(快照)',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_merchant` (`site_id`, `merchant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_read_at` (`read_at`),
  KEY `idx_send_at` (`send_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户通知记录(整改 B1)';

-- 通知模板(Use Template 自动填充)
CREATE TABLE IF NOT EXISTS `notify_template` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID(0=平台通用)',
  `category`        VARCHAR(30)  NOT NULL DEFAULT 'system' COMMENT '通知分类',
  `title`           VARCHAR(200) NOT NULL DEFAULT '' COMMENT '模板标题',
  `message`         VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '模板正文',
  `deep_link_type`  VARCHAR(30)  NOT NULL DEFAULT 'none' COMMENT '深链类型',
  `deep_link_value` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '深链地址/ID',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_category` (`site_id`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户通知模板(整改 B1)';

-- 模板种子(Use Template 下拉示例)
INSERT INTO `notify_template` (`site_id`, `category`, `title`, `message`, `deep_link_type`, `deep_link_value`)
VALUES
  (0, 'system',    'Scheduled Maintenance', 'Dear merchant, the mTrip platform will undergo scheduled maintenance. Thank you for your understanding.', 'none', ''),
  (0, 'booking',   'New Booking Received',   'You have a new confirmed booking. Please check the booking detail and prepare for the guest.', 'booking_detail', ''),
  (0, 'promotion', 'Promotion Approved',     'Your promotion has been approved and is now live on the mTrip app.', 'promotion', ''),
  (0, 'account',   'Account Information Update', 'Your account information has been updated by the platform.', 'user_profile', ''),
  (0, 'refund',    'Refund Processed',       'A refund has been processed for one of your orders.', 'wallet', '');
