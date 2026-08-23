-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [正式 PRD v1.0 整改]:商户验证与审批(方案 S1.1-S1.5)
-- 依据:docs/redesign/商户验证与审批整改方案.md 阶段一
-- 库:mtrip_business;守卫式幂等(探测列/表存在则跳过)
-- ============================================================
USE `mtrip_business`;

-- S1.1 业务单元补业务级联系方式(公司级信息一次,业务级各自维护)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_application_business' AND COLUMN_NAME='contact_name');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `contact_name` VARCHAR(50) NOT NULL DEFAULT '''' COMMENT ''业务联系人'' AFTER `business_type`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_application_business' AND COLUMN_NAME='contact_phone');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `contact_phone` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''业务手机号(加密)'' AFTER `contact_name`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_application_business' AND COLUMN_NAME='contact_email');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `contact_email` VARCHAR(100) NOT NULL DEFAULT '''' COMMENT ''业务邮箱'' AFTER `contact_phone`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- S1.3 账户访问与 2FA 状态(PRD:批准后完成访问安全设置才能访问仪表盘)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_info' AND COLUMN_NAME='access_status');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_info` ADD COLUMN `access_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''访问安全状态:0待设置2FA 1已设置'' AFTER `two_fa_last_reset_at`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_info' AND COLUMN_NAME='two_fa_status');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_info` ADD COLUMN `two_fa_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''2FA状态:0未注册 1活跃 2需要重置'' AFTER `access_status`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_info' AND COLUMN_NAME='two_fa_secret_enc');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_info` ADD COLUMN `two_fa_secret_enc` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''2FA设置密钥(加密,仅注册流程消费,管理端不展示)'' AFTER `two_fa_status`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- S1.4 重新提交受影响文件标记(先前已批准文件无需重交)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_verify_document' AND COLUMN_NAME='resubmit_required_at');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_verify_document` ADD COLUMN `resubmit_required_at` DATETIME NULL DEFAULT NULL COMMENT ''被要求重交的时间(受影响文件标记)'' AFTER `revision_count`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- S1.5 拒绝快照(受影响文件 id 列表)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='merchant_application' AND COLUMN_NAME='rejected_doc_ids');
SET @ddl := IF(@col_exists=0,
  'ALTER TABLE `merchant_application` ADD COLUMN `rejected_doc_ids` JSON NULL COMMENT ''拒绝时受影响文件ID快照'' AFTER `reject_note`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- S1.2 访问码操作审计(生成/重发/重新生成)
CREATE TABLE IF NOT EXISTS `merchant_access_code_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `action`        VARCHAR(30)  NOT NULL COMMENT '动作:generate/resend/regenerate',
  `channels`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '下发渠道(email,sms,inapp)',
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID',
  `operator_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作人姓名(快照)',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_merchant` (`site_id`, `merchant_id`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户访问码操作审计(整改 S1.2)';
