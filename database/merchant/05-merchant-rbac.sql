-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 05:商家端动态 RBAC(计划 13-商家端 merchant-web 落地)
-- 库:mtrip_business
-- 目标:merchant-web(merchant_admin,account_type 1集团/2商户/3门店)独立四表 RBAC,
--       与平台 sys_menu/sys_role 完全隔离;弃用 merchant_admin.role_perms JSON 隐式方案。
-- perm_key 为"同一把钥匙":既控前端 v-perm 按钮显隐,也控后端 #[Permission] 接口鉴权。
-- account_scope(逗号分隔 account_type)控制菜单对哪些账号类型可见。
-- 本脚本幂等:CREATE TABLE IF NOT EXISTS,可在全新与存量环境重复执行。
-- ============================================================
USE `mtrip_business`;

-- 商家端菜单/按钮权限树(平台预置,商户不可改)
CREATE TABLE IF NOT EXISTS `merchant_menu` (
  `id`            BIGINT UNSIGNED NOT NULL COMMENT '主键(手工分配:目录=100N,页面=parent+序,按钮=页面ID*100+序)',
  `parent_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '父菜单ID,0=一级',
  `menu_name`     VARCHAR(50)  NOT NULL COMMENT '菜单中文名',
  `menu_name_en`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '菜单英文名(词条缺失时非中文环境回退)',
  `i18n_key`      VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '前端词条key(目录/页面必填,按钮不占词条)',
  `perm_key`      VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '权限标识(mch:模块:动作),与后端#[Permission]一致',
  `menu_type`     TINYINT      NOT NULL DEFAULT 2 COMMENT '类型:1目录 2页面 3按钮',
  `route_path`    VARCHAR(120) NOT NULL DEFAULT '' COMMENT '前端路由路径',
  `component`     VARCHAR(120) NOT NULL DEFAULT '' COMMENT '前端组件路径(相对 views/)',
  `icon`          VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '菜单图标(antd 图标名)',
  `sort`          INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `is_cache`      TINYINT      NOT NULL DEFAULT 1 COMMENT '页面是否 keep-alive 缓存:0否 1是',
  `account_scope` VARCHAR(20)  NOT NULL DEFAULT '1,2,3' COMMENT '可见账号类型(逗号分隔:1集团 2商户 3门店)',
  `business_scope` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '所属业务模块:空=全业务可见,hotel=仅酒店业务视图展示',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_perm_key` (`perm_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商家端菜单权限表';

-- 商家端角色(merchant_id=0 且 is_builtin=1 为平台内置预设,商户可自建自定义角色)
CREATE TABLE IF NOT EXISTS `merchant_role` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `group_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属集团ID(集团自建角色)',
  `merchant_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属商户ID(0=平台内置预设)',
  `account_type` TINYINT      NOT NULL DEFAULT 2 COMMENT '适用账号类型:1集团 2商户 3门店',
  `role_name`    VARCHAR(50)  NOT NULL COMMENT '角色名称',
  `role_code`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '角色编码',
  `is_builtin`   TINYINT      NOT NULL DEFAULT 0 COMMENT '是否内置:0否 1是(内置不可删改)',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_account_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商家端角色表';

-- 角色-菜单关联
CREATE TABLE IF NOT EXISTS `merchant_role_menu` (
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  `menu_id` BIGINT UNSIGNED NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (`role_id`, `menu_id`),
  KEY `idx_menu_id` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商家端角色菜单关联表';

-- 账号-角色关联(子账号授权;主账号 is_owner=1 登录时直接拥有本 account_type 全部权限,不依赖本表)
CREATE TABLE IF NOT EXISTS `merchant_admin_role` (
  `admin_id` BIGINT UNSIGNED NOT NULL COMMENT '商户账号ID(merchant_admin.id)',
  `role_id`  BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`admin_id`, `role_id`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商家端账号角色关联表';
