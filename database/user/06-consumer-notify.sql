-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M3 运营与风控]:站内通知(Notification Center)
-- 需求出处:PRD 模块 10(预订事件触发多渠道通知;本期落地 In-App 站内信,Push/SMS/Email 待接第三方)
-- 库:mtrip_business(order-service 写入事件通知,user-service 读取/标记已读)
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `notify_record` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '接收用户ID',
  `event_key`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '事件标识(booking_confirmed/booking_cancelled/review_request…)',
  `title`      VARCHAR(200) NOT NULL DEFAULT '' COMMENT '通知标题',
  `content`    VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '通知内容',
  `biz_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '业务类型:1订单 2营销 3系统',
  `biz_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '业务对象ID(如订单ID)',
  `is_read`    TINYINT      NOT NULL DEFAULT 0 COMMENT '是否已读:0未读 1已读',
  `read_at`    DATETIME     NULL DEFAULT NULL COMMENT '已读时间',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_read` (`site_id`, `user_id`, `is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='站内通知记录表';
