-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M3 运营与风控]:风控与申诉(Booking Risk & Appeal)
-- 需求出处:PRD 模块 10.1(可配置多级风控:警告/账号限制/封禁;用户可申诉)
-- 库:mtrip_business
-- 分级 level:0正常 1警告 2账号限制(冻结,登录拦截 user_status=2) 3封禁
-- ============================================================
USE `mtrip_business`;

-- 用户风控态(每人一行)
CREATE TABLE IF NOT EXISTS `user_fraud` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `fraud_score`  INT          NOT NULL DEFAULT 0 COMMENT '风险分',
  `level`        TINYINT      NOT NULL DEFAULT 0 COMMENT '风控级别:0正常 1警告 2限制 3封禁',
  `last_reason`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '最近触发原因',
  `last_eval_at` DATETIME     NULL DEFAULT NULL COMMENT '最近评估时间',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user` (`user_id`),
  KEY `idx_site_level` (`site_id`, `level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户风控态表';

-- 申诉表
CREATE TABLE IF NOT EXISTS `user_appeal` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '申诉用户ID',
  `content`       VARCHAR(2000) NOT NULL COMMENT '申诉说明',
  `attachments`   JSON         NULL COMMENT '附件(图片/文件,≤20MB)',
  `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待审 1通过解除 2驳回维持 3升级封禁',
  `handler_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理人(管理员)ID',
  `handle_remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '处理备注',
  `handled_at`    DATETIME     NULL DEFAULT NULL COMMENT '处理时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户申诉表';
