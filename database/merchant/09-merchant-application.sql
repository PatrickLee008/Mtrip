-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 原型 stir-long v4.2.1]:商户入驻流水线(Onboarding)
-- 设计源:docs/plans 商户验证原型对齐整改方案;原型 Merchant Verification / Onboarding
-- 库:mtrip_business
--
-- 入驻流水线(merchant_application.stage):
--   1 New Lead → 2 Contacted → 3 KYC Access Granted → 4 KYC In Progress
--   → 5 Approved(转 merchant_info status=0 进入 Pending Verification)
--   → 6 Rejected(关闭入驻)
-- ============================================================
USE `mtrip_business`;

-- 入驻申请/线索(CRM 式流水线,审核通过后才生成正式商户)
CREATE TABLE IF NOT EXISTS `merchant_application` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`             BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `app_no`              VARCHAR(30)  NOT NULL COMMENT '线索编号(APP-20240001)',
  `merchant_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '通过后关联商户ID,0=尚未转商户',
  `company_name`        VARCHAR(100) NOT NULL COMMENT '公司/商户名称',
  `company_group_name`  VARCHAR(100) NOT NULL DEFAULT '' COMMENT '集团名称',
  `reg_number`          VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '公司注册号',
  `country`             VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '注册国家',
  `business_types`      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '业态组合(hotel,restaurant,...)',
  `num_businesses`      TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '业务(门店)数量',
  `stage`               TINYINT      NOT NULL DEFAULT 1 COMMENT '阶段:1新线索 2已联系 3KYC已开放 4KYC进行中 5已通过 6已驳回',
  `assigned_ops_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '指派运营(管理员)ID,0=未指派',
  `assigned_ops_name`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '指派运营姓名(快照)',
  `operator_type`       VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '运营类型(single_unit/chain/franchise/independent/mixed)',
  `expected_launch_date` DATE        NULL DEFAULT NULL COMMENT '预计上线日期',
  `operations_notes`    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '运营评估备注',
  `kyc_scope`           TINYINT      NOT NULL DEFAULT 1 COMMENT '验证范围:1新商户 2追加业务',
  `kyc_template_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'KYC模板ID(merchant_kyc_template)',
  `submission_method`   TINYINT      NOT NULL DEFAULT 1 COMMENT 'KYC提交方式:1商户自助 2运营协助',
  `reject_reason_code`  TINYINT      NOT NULL DEFAULT 0 COMMENT '驳回原因码(1-9预置枚举)',
  `reject_note`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '驳回补充说明',
  `submitted_at`        DATETIME     NULL DEFAULT NULL COMMENT '申请提交时间',
  `last_updated_at`     DATETIME     NULL DEFAULT NULL COMMENT '最后更新时间',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`          DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_no` (`app_no`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_stage` (`stage`),
  KEY `idx_assigned` (`assigned_ops_id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户入驻申请/线索表(Onboarding流水线)';

-- 申请下注册业务单元(一个申请多家门店/多业态,各自 KYC 状态)
CREATE TABLE IF NOT EXISTS `merchant_application_business` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `application_id` BIGINT UNSIGNED NOT NULL COMMENT '入驻申请ID',
  `business_name`  VARCHAR(100) NOT NULL COMMENT '业务/门店名称',
  `business_type`  VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '业态(hotel/restaurant/airline/car_rental/attraction)',
  `city`           VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '所在城市',
  `kyc_status`     TINYINT      NOT NULL DEFAULT 2 COMMENT 'KYC状态:1已核验 2待提交 3核验中 4已驳回',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_application_id` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='入驻申请-注册业务单元';

-- 平台 KYC 模板(按业态维护所需文档清单,平台可配置)
CREATE TABLE IF NOT EXISTS `merchant_kyc_template` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`          VARCHAR(100) NOT NULL COMMENT '模板名称(Hotel – Single Property...)',
  `business_type` VARCHAR(30)  NOT NULL COMMENT '业态(hotel/restaurant/airline/car_rental/attraction)',
  `docs`          JSON         NULL COMMENT '所需文档清单[{name,doc_type,required}]',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `sort`          INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_business_type` (`business_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='平台KYC验证模板';

-- 入驻申请内部备注(仅运营/管理员可见)
CREATE TABLE IF NOT EXISTS `merchant_application_note` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `application_id` BIGINT UNSIGNED NOT NULL COMMENT '入驻申请ID',
  `note`           VARCHAR(1000) NOT NULL COMMENT '备注内容',
  `author_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '备注人(管理员)ID',
  `author_name`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '备注人姓名(快照)',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_application_id` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='入驻申请内部备注';

-- 资质文档重交版本(Original vs Resubmitted 对比留痕,重交不覆盖旧版本)
CREATE TABLE IF NOT EXISTS `merchant_verify_document_revision` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `doc_id`        BIGINT UNSIGNED NOT NULL COMMENT '文档ID(merchant_verify_document)',
  `merchant_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID(冗余便于查询)',
  `version`       INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '版本号(1=原始提交)',
  `file_url`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '文件URL',
  `file_size`     VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '文件大小(展示用)',
  `status`        TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1核验通过 2待审 3已驳回',
  `reject_reason` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '驳回原因',
  `reviewer_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '审核人姓名(快照)',
  `uploaded_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_doc_id` (`doc_id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='资质文档重交版本历史';

-- ============================================================
-- 存量表增量(守卫式幂等:探测列存在则跳过)
-- ============================================================

-- merchant_info.access_code 商户门户访问码(登录仍走 merchant_admin 账号)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'access_code');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `access_code` VARCHAR(32) NOT NULL DEFAULT '''' COMMENT ''商户门户访问码(MTRP-HOTEL-XXXXXX)'' AFTER `audit_time`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_info.credential_channels 凭证下发渠道
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'credential_channels');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `credential_channels` VARCHAR(30) NOT NULL DEFAULT '''' COMMENT ''凭证下发渠道(email,sms,inapp)'' AFTER `access_code`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_info.reject_reason_code 预置驳回原因码
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'reject_reason_code');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `reject_reason_code` TINYINT NOT NULL DEFAULT 0 COMMENT ''驳回原因码(1-9预置枚举,0=未记录)'' AFTER `credential_channels`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_verify_timeline.application_id 时间线支持入驻申请维度
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_verify_timeline' AND COLUMN_NAME = 'application_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_verify_timeline` ADD COLUMN `application_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''入驻申请ID(0=非入驻事件)'' AFTER `merchant_id`, ADD KEY `idx_application_id` (`application_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_verify_document.application_id 文档支持挂载入驻申请
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_verify_document' AND COLUMN_NAME = 'application_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_verify_document` ADD COLUMN `application_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''入驻申请ID(0=正式商户文档)'' AFTER `merchant_id`, ADD KEY `idx_application_id` (`application_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_verify_document.revision_count 重交次数冗余
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_verify_document' AND COLUMN_NAME = 'revision_count');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_verify_document` ADD COLUMN `revision_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''已重交次数(冗余,详情对比用)'' AFTER `reject_reason`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- KYC 模板种子(原型 9 模板;docs 内 doc_type 与 merchant_verify_document.doc_type 对齐)
-- ============================================================
INSERT IGNORE INTO `merchant_kyc_template` (`id`,`site_id`,`name`,`business_type`,`docs`,`sort`) VALUES
(1,0,'Hotel – Single Property','hotel','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Hotel Operating License","doc_type":"hotel_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Tax Registration Certificate","doc_type":"tax_cert","required":true},{"name":"Premises Ownership / Lease Agreement","doc_type":"premises_lease","required":false}]',1),
(2,0,'Hotel – Multi Property','hotel','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Hotel Operating License","doc_type":"hotel_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Tax Registration Certificate","doc_type":"tax_cert","required":true},{"name":"Premises Ownership / Lease Agreement (each property)","doc_type":"premises_lease","required":false}]',2),
(3,0,'Restaurant – Single Unit','restaurant','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Food & Beverage License","doc_type":"fnb_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Tax Registration Certificate","doc_type":"tax_cert","required":true},{"name":"Fire Safety Certificate","doc_type":"fire_safety","required":false}]',3),
(4,0,'Restaurant – Chain','restaurant','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Food & Beverage License","doc_type":"fnb_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Tax Registration Certificate","doc_type":"tax_cert","required":true},{"name":"Fire Safety Certificate (each outlet)","doc_type":"fire_safety","required":false}]',4),
(5,0,'Airline','airline','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Air Operator Certificate","doc_type":"air_operator_cert","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Tax Registration Certificate","doc_type":"tax_cert","required":true}]',5),
(6,0,'Car Rental – Standard','car_rental','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Tourism Operator License","doc_type":"tourism_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Vehicle Registration & Insurance","doc_type":"vehicle_reg","required":true}]',6),
(7,0,'Car Rental – Large Fleet','car_rental','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Tourism Operator License","doc_type":"tourism_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Vehicle Registration & Insurance (fleet list)","doc_type":"vehicle_reg","required":true}]',7),
(8,0,'Attraction – Single Venue','attraction','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Tourism Operator License","doc_type":"tourism_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Safety / Insurance Certification","doc_type":"insurance_cert","required":false}]',8),
(9,0,'Attraction – Multi Venue','attraction','[{"name":"Business Registration Certificate","doc_type":"business_reg","required":true},{"name":"Tourism Operator License","doc_type":"tourism_license","required":true},{"name":"Owner NRC / Passport","doc_type":"id_doc","required":true},{"name":"Bank Certificate","doc_type":"bank_letter","required":true},{"name":"Safety / Insurance Certification (each venue)","doc_type":"insurance_cert","required":false}]',9);
