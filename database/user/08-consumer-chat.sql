-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M3 运营与风控]:在线客服 / 与酒店聊天(Chat)
-- 需求出处:PRD 模块 4.1(与酒店咨询)+ 模块 13(客服会话,机器人+转人工+会话评分)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 会话表(酒店咨询 / 客服)
CREATE TABLE IF NOT EXISTS `chat_conversation` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `type`         TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1酒店咨询 2客服',
  `target_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '目标ID(酒店商品ID;客服=0)',
  `title`        VARCHAR(200) NOT NULL DEFAULT '' COMMENT '会话标题(酒店名/客服)',
  `status`       TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0进行中 1已结束',
  `last_message` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '最后一条消息摘要',
  `last_time`    DATETIME     NULL DEFAULT NULL COMMENT '最后消息时间',
  `rating`       TINYINT      NOT NULL DEFAULT 0 COMMENT '会话评分1-5,0未评',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_type` (`user_id`, `type`),
  KEY `idx_site_status` (`site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='聊天会话表';

-- 消息表
CREATE TABLE IF NOT EXISTS `chat_message` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `conversation_id` BIGINT UNSIGNED NOT NULL COMMENT '会话ID',
  `sender_type`     TINYINT      NOT NULL DEFAULT 1 COMMENT '发送方:1用户 2坐席/酒店 3机器人',
  `content`         VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '内容',
  `msg_type`        TINYINT      NOT NULL DEFAULT 1 COMMENT '消息类型:1文本 2图片',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`),
  KEY `idx_conversation` (`conversation_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='聊天消息表';
