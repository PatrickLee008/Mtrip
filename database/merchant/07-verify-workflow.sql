-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / Phase 1]:商户验证工作流
-- 设计源:docs/redesign/super-admin-portal/modules/02-merchant-verification.md / 03-merchant-management.md
-- 库:mtrip_business
--
-- merchant_info.status 语义扩展(无需改表结构,tinyint 取值扩充):
--   0待审核 2审核驳回 3已启用 4已禁用(=暂停 Suspended) 5已注销
--   6待重新提交(Resubmission,驳回后要求商户补正重交;商户编辑后回到 0)
--   拉黑(Blacklisted)另存 merchant_blacklist(status=4 暂停 + 黑名单记录区分「暂停」与「拉黑」)
-- ============================================================
USE `mtrip_business`;

-- 商户资质文档(逐份核验:类型/文件/状态/有效期/审核人/驳回原因/历史)
CREATE TABLE IF NOT EXISTS `merchant_verify_document` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`      BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `biz_unit`         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '业务单元标识(多业态时区分,空=主体)',
  `doc_type`         VARCHAR(50)  NOT NULL COMMENT '文档类型(business_license/operating_license/owner_id/bank_cert/tax_cert/...)',
  `name`             VARCHAR(100) NOT NULL DEFAULT '' COMMENT '文档名称',
  `file_url`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '文件URL',
  `file_size`        VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '文件大小(展示用)',
  `status`           TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1核验通过 2待审 3已驳回 4已过期 5需重交',
  `expiry_date`      DATE         NULL DEFAULT NULL COMMENT '有效期至(NULL=长期)',
  `last_verified_at` DATETIME     NULL DEFAULT NULL COMMENT '最后核验时间',
  `reviewer_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '核验人ID',
  `reviewer_name`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '核验人姓名(快照)',
  `reject_reason`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '驳回/重交原因',
  `remark`           VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `uploaded_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expiry` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户资质文档核验表';

-- 商户验证时间线(审核动作审计:谁在何时做了什么)
CREATE TABLE IF NOT EXISTS `merchant_verify_timeline` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `action`        VARCHAR(100) NOT NULL COMMENT '动作(submitted/assigned/kyc_sent/doc_verified/approved/rejected/resubmit_requested/...)',
  `actor_type`    TINYINT      NOT NULL DEFAULT 2 COMMENT '来源:1系统 2管理员 3商户',
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID(管理员)',
  `operator_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作人姓名(快照)',
  `note`          VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注/原因',
  `is_exception`  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否异常事件:0否 1是(告警高亮)',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户验证/审核时间线';

-- 商户黑名单(区分「暂停」与「拉黑」:拉黑=永久移除,带证据)
CREATE TABLE IF NOT EXISTS `merchant_blacklist` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `reason`        VARCHAR(255) NOT NULL COMMENT '拉黑原因',
  `evidence`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '证据摘要',
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID',
  `operator_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作人姓名(快照)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1生效 2已移除',
  `removed_at`    DATETIME     NULL DEFAULT NULL COMMENT '移除时间',
  `removed_by`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '移除操作人ID',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户黑名单';

-- 商户活动审计日志(登录/资料变更/暂停/恢复/文档/核验/警告/代入/预订)
CREATE TABLE IF NOT EXISTS `merchant_activity_log` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`     BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `activity_type`   VARCHAR(30)  NOT NULL COMMENT '类型(login/profile_update/suspension/reactivation/document_upload/verification/warning/impersonation/booking/blacklist)',
  `description`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '描述',
  `performed_by`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '执行人姓名(商户/管理员/System)',
  `performed_by_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '执行人ID(管理员;0=系统/商户)',
  `ip_address`      VARCHAR(45)  NOT NULL DEFAULT '' COMMENT 'IP地址',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1成功 2失败 3处理中',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户活动审计日志';
