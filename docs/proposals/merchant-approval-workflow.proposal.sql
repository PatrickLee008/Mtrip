-- ============================================================
-- 提案 [商户入住流程审批表] —— 当前项目缺失
-- 现状:商户入住仅由 merchant_info.status 一个 tinyint 枚举驱动(0待审→3启用/2驳回/6重交),
--       审核为单步「通过/驳回」,无多级审批、无审批流定义、无节点级审批记录。
-- 本提案补齐「审批流定义 + 审批实例 + 节点记录」三表,复用现有约定(库 mtrip_business /
-- site_id 站点隔离 / deleted_at 软删 / InnoDB utf8mb4_bin)。
-- 注意:本文件为提案,未纳入 database/<域>/NN-*.sql 增量执行路径,需评审后落地。
-- ============================================================
SET NAMES utf8mb4;
USE `mtrip_business`;

-- ① 审批流定义(模板):可配置多节点、串行/并行、审批角色
CREATE TABLE IF NOT EXISTS `merchant_approval_flow` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '适用站点ID,0=全平台通用模板',
  `flow_code`     VARCHAR(50)  NOT NULL COMMENT '流程编码(如 merchant_onboarding)',
  `flow_name`     VARCHAR(100) NOT NULL COMMENT '流程名称',
  `biz_scope`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '适用业态/商户类型(空=全部)',
  `nodes`         JSON         NOT NULL COMMENT '节点定义:[{key,name,approver_role,mode(serial/parallel),order}]',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flow_code_site` (`flow_code`, `site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户审批流定义表';

-- ② 审批实例:一次入住申请对应的审批过程(挂在 merchant_info 上)
CREATE TABLE IF NOT EXISTS `merchant_approval_instance` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `flow_id`       BIGINT UNSIGNED NOT NULL COMMENT '审批流定义ID',
  `current_node`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '当前待审节点key(空=已结束)',
  `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0审批中 1通过 2驳回 3撤回',
  `started_by`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '发起审批人ID',
  `started_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发起时间',
  `finished_at`   DATETIME     NULL DEFAULT NULL COMMENT '结束时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_merchant_active` (`merchant_id`, `status`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_flow_id` (`flow_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户审批实例表';

-- ③ 审批节点记录:每个节点每次审批的留痕(谁、何时、通过/驳回/转交、意见)
CREATE TABLE IF NOT EXISTS `merchant_approval_record` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `instance_id`   BIGINT UNSIGNED NOT NULL COMMENT '审批实例ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `node_key`      VARCHAR(50)  NOT NULL COMMENT '节点key',
  `node_name`     VARCHAR(100) NOT NULL DEFAULT '' COMMENT '节点名称',
  `approver_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '审批人ID',
  `approver_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '审批人姓名(快照)',
  `action`        TINYINT      NOT NULL DEFAULT 0 COMMENT '动作:1通过 2驳回 3转交',
  `comment`       VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审批意见',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_instance_id` (`instance_id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户审批节点记录表';
