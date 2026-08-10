-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / Phase 3]:终端用户封禁/黑名单
-- 设计源:docs/redesign/super-admin-portal/modules/07-end-user-management.md
-- 库:mtrip_business
--
-- user_info.user_status 语义扩展(无需改表结构,tinyint 取值扩充):
--   1正常(active) 2冻结(suspended) 3注销(inactive) 4拉黑(blacklisted)
--   「拉黑」= 永久移除,带原因/证据,另记 user_blacklist(区分「冻结」与「拉黑」)
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `user_blacklist` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `reason`        VARCHAR(255) NOT NULL COMMENT '拉黑原因',
  `evidence`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '证据摘要(chargeback号/设备指纹等)',
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID',
  `operator_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作人姓名(快照)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1生效 2已移除',
  `removed_at`    DATETIME     NULL DEFAULT NULL COMMENT '移除时间',
  `removed_by`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '移除操作人ID',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='终端用户黑名单';
