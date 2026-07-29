-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 07:财务(文档 5.2.5 + 业务模块7:结算/提现/税费)
-- 库:mtrip_business
-- 分表策略:finance_flow 按 created_at 月份分表(finance_flow_YYYYMM),
--   本文件为模板表,定时任务每月末预建下月分表
-- 说明:供应商结算单已建于 merchant/02-supplier.sql 的 supplier_settle 表,
--   财务模块直接复用该表,不再重复建 finance_supplier_settle
-- ============================================================
USE `mtrip_business`;

-- 资金流水表(严格按文档 5.2.5,月分表模板)
CREATE TABLE IF NOT EXISTS `finance_flow` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `flow_no`     VARCHAR(32)  NOT NULL COMMENT '流水号(唯一)',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `flow_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '流水类型:1收入 2支出 3转账 4冻结 5解冻',
  `biz_type`    TINYINT      NOT NULL DEFAULT 1 COMMENT '业务类型:1订单支付 2订单退款 3商户提现 4供应商回款 5手动调账',
  `amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '金额',
  `order_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `merchant_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联商户ID',
  `supplier_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联供应商ID',
  `user_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联用户ID',
  `pay_channel` TINYINT      NOT NULL DEFAULT 0 COMMENT '支付渠道:1Stripe 2PayPal',
  `trade_no`    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '第三方交易流水号',
  `flow_status` TINYINT      NOT NULL DEFAULT 1 COMMENT '流水状态:1成功 2处理中 3失败',
  `remark`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注(手动调账必填原因)',
  `operator_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID(手动调账时)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flow_no` (`flow_no`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_flow_type` (`flow_type`),
  KEY `idx_biz_type` (`biz_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='资金流水表(月分表模板 finance_flow_YYYYMM)';

-- 商户结算单表(按结算周期生成)
CREATE TABLE IF NOT EXISTS `finance_merchant_settle` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `settle_no`      VARCHAR(32)  NOT NULL COMMENT '结算单号(唯一)',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`    BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `settle_cycle`   VARCHAR(20)  NOT NULL COMMENT '结算周期(如 2026-07 或 2026-07-01~2026-07-07)',
  `order_count`    INT          NOT NULL DEFAULT 0 COMMENT '结算订单数',
  `order_amount`   DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
  `refund_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '退款总金额',
  `commission`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台佣金',
  `tax_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税费金额',
  `settle_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应结算金额',
  `status`         TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待确认 1已确认 2已打款 3有争议',
  `confirm_by`     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '确认人ID',
  `confirm_time`   DATETIME     NULL DEFAULT NULL COMMENT '确认时间',
  `pay_time`       DATETIME     NULL DEFAULT NULL COMMENT '打款时间',
  `pay_voucher`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '打款凭证',
  `remark`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注/争议说明',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settle_no` (`settle_no`),
  UNIQUE KEY `uk_merchant_cycle` (`merchant_id`, `settle_cycle`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户结算单表';

-- 商户提现申请表
CREATE TABLE IF NOT EXISTS `finance_withdraw` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `withdraw_no`    VARCHAR(32)  NOT NULL COMMENT '提现单号(唯一)',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`    BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `amount`         DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '提现金额',
  `fee`            DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '手续费',
  `actual_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '实际到账金额',
  `account_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '收款账户类型:1银行卡 2Stripe 3PayPal',
  `account_info`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '收款账户信息快照(加密)',
  `status`         TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待审核 1审核通过打款中 2已打款 3已驳回 4打款失败',
  `audit_by`       BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '审核人ID',
  `audit_time`     DATETIME     NULL DEFAULT NULL COMMENT '审核时间',
  `audit_remark`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审核备注/驳回原因',
  `trade_no`       VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '打款流水号',
  `pay_time`       DATETIME     NULL DEFAULT NULL COMMENT '打款时间',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_withdraw_no` (`withdraw_no`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户提现申请表';

-- 税费配置表(按站点/国家差异化)
CREATE TABLE IF NOT EXISTS `finance_tax_config` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局默认',
  `tax_name`    VARCHAR(50)  NOT NULL COMMENT '税种名称(如 VAT/城市税)',
  `goods_type`  TINYINT      NOT NULL DEFAULT 0 COMMENT '适用商品类型:0全部 1酒店 2门票',
  `tax_rate`    DECIMAL(6,4) NOT NULL DEFAULT 0.0000 COMMENT '税率(0.2000=20%)',
  `calc_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '计税方式:1价内税 2价外税',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='税费配置表';
