-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 商户管理整改 B2]:商户代入会话
-- 需求源:docs/redesign/需求分析-商户管理模块.md §3.5.6(Start Impersonation Session)
-- 库:mtrip_business;会话起止各写一条 merchant_activity_log(impersonation 类型)
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_impersonation_session` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '被代入商户ID',
  `operator_id`   BIGINT UNSIGNED NOT NULL COMMENT '代入操作人(管理员)ID',
  `operator_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '代入操作人姓名(快照)',
  `reason`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '代入原因(technical_support/booking_investigation/payment_investigation/customer_complaint/other)',
  `session_key`   VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '会话标识(提交给商户端上下文的令牌)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1进行中 2已结束',
  `started_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `ended_at`      DATETIME     NULL DEFAULT NULL COMMENT '结束时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_merchant` (`site_id`, `merchant_id`),
  KEY `idx_operator` (`operator_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户代入会话(整改 B2)';
