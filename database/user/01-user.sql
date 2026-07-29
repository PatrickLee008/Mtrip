-- ============================================================
-- 业务表 03:C端用户(文档 5.2.4 + 业务模块3)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 用户表(严格按文档 5.2.4)
CREATE TABLE IF NOT EXISTS `user_info` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`            BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `nickname`           VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '用户昵称',
  `avatar`             VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像URL',
  `mobile`             VARCHAR(255) NOT NULL DEFAULT '' COMMENT '手机号(加密)',
  `email`              VARCHAR(255) NOT NULL DEFAULT '' COMMENT '邮箱(加密)',
  `password`           VARCHAR(255) NOT NULL DEFAULT '' COMMENT '登录密码(bcrypt)',
  `register_source`    TINYINT      NOT NULL DEFAULT 1 COMMENT '注册来源:1Android 2iOS 3H5 4小程序',
  `register_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `last_login_at`      DATETIME     NULL DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '最后登录IP',
  `member_level_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '会员等级ID',
  `member_expire_time` DATETIME     NULL DEFAULT NULL COMMENT '会员到期时间',
  `balance`            DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '账户余额',
  `points`             INT          NOT NULL DEFAULT 0 COMMENT '积分余额',
  `real_name_status`   TINYINT      NOT NULL DEFAULT 0 COMMENT '实名认证状态:0未认证 1已认证 2认证失败',
  `real_name`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '真实姓名(加密)',
  `id_card`            VARCHAR(255) NOT NULL DEFAULT '' COMMENT '身份证号(加密)',
  `user_status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '用户状态:1正常 2冻结 3注销',
  `tags`               JSON         NULL COMMENT '用户标签',
  `remark`             VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`         DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_user_status` (`user_status`),
  KEY `idx_register_time` (`register_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='C端用户表';

-- 会员等级配置表(多站点独立)
CREATE TABLE IF NOT EXISTS `user_member_level` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `level_name`  VARCHAR(50)  NOT NULL COMMENT '等级名称',
  `level_order` INT          NOT NULL DEFAULT 1 COMMENT '等级序号(小到大)',
  `upgrade_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '升级所需累计消费金额',
  `discount_rate`  DECIMAL(5,2) NOT NULL DEFAULT 100.00 COMMENT '会员折扣率%(100=无折扣)',
  `benefits`    JSON         NULL COMMENT '会员权益配置',
  `icon`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '等级图标',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员等级配置表';

-- 用户余额变动流水表
CREATE TABLE IF NOT EXISTS `user_balance_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `change_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '变动类型:1充值 2消费 3退款 4调账 5提现',
  `amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '变动金额(正增负减)',
  `before_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '变动前余额',
  `after_balance`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '变动后余额',
  `order_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `operator_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID(手动调账时)',
  `remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户余额变动流水表';

-- 用户积分变动流水表
CREATE TABLE IF NOT EXISTS `user_points_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `change_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '变动类型:1下单获取 2积分兑换 3活动奖励 4过期扣减 5调账',
  `points`      INT          NOT NULL DEFAULT 0 COMMENT '变动积分(正增负减)',
  `after_points` INT         NOT NULL DEFAULT 0 COMMENT '变动后积分',
  `order_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户积分变动流水表';

-- 用户反馈与投诉表
CREATE TABLE IF NOT EXISTS `user_feedback` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `feedback_type` TINYINT     NOT NULL DEFAULT 1 COMMENT '类型:1功能建议 2订单投诉 3商户投诉 4其他',
  `content`      VARCHAR(2000) NOT NULL COMMENT '反馈内容',
  `images`       JSON         NULL COMMENT '附件图片',
  `order_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `status`       TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待处理 1处理中 2已处理 3已关闭',
  `reply_content` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '处理回复内容',
  `handler_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理人ID',
  `handled_at`   DATETIME     NULL DEFAULT NULL COMMENT '处理时间',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户反馈与投诉表';

-- 用户操作日志表(登录、下单、退款记录)
CREATE TABLE IF NOT EXISTS `user_action_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `action_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1登录 2下单 3支付 4退款 5注销',
  `content`     VARCHAR(500) NOT NULL DEFAULT '' COMMENT '操作内容',
  `client_ip`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '客户端IP',
  `device_info` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '设备信息',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户操作日志表';
