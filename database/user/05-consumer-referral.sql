-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M2 促销与用户资产]:推荐返利(Refer & Earn)
-- 需求出处:PRD 模块 14(每人唯一推荐码;新用户注册绑定;被推荐人首单达成→奖励入推荐人钱包)
-- 库:mtrip_business
-- 注:referral_code 允许 NULL(存量用户为 NULL,首次访问推荐页时惰性生成);唯一索引允许多个 NULL
-- ============================================================
USE `mtrip_business`;

-- 每个用户的推荐码(分享用)
ALTER TABLE `user_info`
  ADD COLUMN `referral_code` VARCHAR(16) NULL DEFAULT NULL COMMENT '本人推荐码(分享用)',
  ADD UNIQUE KEY `uk_referral_code` (`referral_code`);

-- 推荐绑定与奖励表(每个被推荐人只被绑定一次)
CREATE TABLE IF NOT EXISTS `user_referral` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `inviter_user_id`  BIGINT UNSIGNED NOT NULL COMMENT '推荐人用户ID',
  `invitee_user_id`  BIGINT UNSIGNED NOT NULL COMMENT '被推荐人用户ID(新用户)',
  `reward_status`    TINYINT      NOT NULL DEFAULT 0 COMMENT '奖励状态:0待达成 1已发放 2已失效',
  `reward_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '推荐人奖励额(发放时快照)',
  `reward_order_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '达成条件的首单ID',
  `bind_time`        DATETIME     NULL DEFAULT NULL COMMENT '绑定时间',
  `reward_time`      DATETIME     NULL DEFAULT NULL COMMENT '奖励发放时间',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invitee` (`invitee_user_id`),
  KEY `idx_inviter` (`inviter_user_id`),
  KEY `idx_reward_status` (`reward_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='推荐返利绑定与奖励表';
