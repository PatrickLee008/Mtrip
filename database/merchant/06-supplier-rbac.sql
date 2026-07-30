-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 06:供应商自助端动态 RBAC(计划 14-供应商端 supplier-web 落地)
-- 库:mtrip_business
-- 目标:supplier-web(supplier_admin)独立四表 RBAC,与平台 sys_* / 商家 merchant_* 完全隔离。
-- 供应商为单层主体(无集团/门店/账号类型概念):数据范围恒为本 supplier_id;
--       主账号 is_owner=1 拥有全部权限,子账号按角色授权。
-- perm_key 为"同一把钥匙":既控前端 v-perm 按钮显隐,也控后端 #[Permission] 接口鉴权。
-- 本脚本幂等:CREATE TABLE IF NOT EXISTS,可在全新与存量环境重复执行。
-- ============================================================
USE `mtrip_business`;

-- 供应商自助端登录账号(主账号 is_owner=1;子账号由主账号自建并赋角色)
CREATE TABLE IF NOT EXISTS `supplier_admin` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `supplier_id`   BIGINT UNSIGNED NOT NULL COMMENT '所属供应商ID(supplier_info.id)',
  `username`      VARCHAR(50)  NOT NULL COMMENT '登录账号',
  `password`      VARCHAR(255) NOT NULL COMMENT '登录密码(bcrypt)',
  `real_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '姓名',
  `mobile`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '手机号(加密)',
  `is_owner`      TINYINT      NOT NULL DEFAULT 0 COMMENT '是否供应商主账号:0否 1是',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `last_login_at` DATETIME     NULL DEFAULT NULL COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_supplier_id` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商自助端登录账号表';

-- 供应商端菜单/按钮权限树(平台预置,供应商不可改;供应商单层主体,无 account_scope)
CREATE TABLE IF NOT EXISTS `supplier_menu` (
  `id`           BIGINT UNSIGNED NOT NULL COMMENT '主键(手工分配:目录=100N,页面=parent+序,按钮=页面ID*100+序)',
  `parent_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '父菜单ID,0=一级',
  `menu_name`    VARCHAR(50)  NOT NULL COMMENT '菜单中文名',
  `menu_name_en` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '菜单英文名(词条缺失时非中文环境回退)',
  `i18n_key`     VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '前端词条key(目录/页面必填,按钮不占词条)',
  `perm_key`     VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '权限标识(sup:模块:动作),与后端#[Permission]一致',
  `menu_type`    TINYINT      NOT NULL DEFAULT 2 COMMENT '类型:1目录 2页面 3按钮',
  `route_path`   VARCHAR(120) NOT NULL DEFAULT '' COMMENT '前端路由路径',
  `component`    VARCHAR(120) NOT NULL DEFAULT '' COMMENT '前端组件路径(相对 views/)',
  `icon`         VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '菜单图标(antd 图标名)',
  `sort`         INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `is_cache`     TINYINT      NOT NULL DEFAULT 1 COMMENT '页面是否 keep-alive 缓存:0否 1是',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_perm_key` (`perm_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商端菜单权限表';

-- 供应商端角色(supplier_id=0 且 is_builtin=1 为平台内置预设,供应商可自建自定义角色)
CREATE TABLE IF NOT EXISTS `supplier_role` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `supplier_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属供应商ID(0=平台内置预设)',
  `role_name`   VARCHAR(50)  NOT NULL COMMENT '角色名称',
  `role_code`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '角色编码',
  `is_builtin`  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否内置:0否 1是(内置不可删改)',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_supplier_id` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商端角色表';

-- 角色-菜单关联
CREATE TABLE IF NOT EXISTS `supplier_role_menu` (
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  `menu_id` BIGINT UNSIGNED NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (`role_id`, `menu_id`),
  KEY `idx_menu_id` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商端角色菜单关联表';

-- 账号-角色关联(子账号授权;主账号 is_owner=1 登录时直接拥有全部权限,不依赖本表)
CREATE TABLE IF NOT EXISTS `supplier_admin_role` (
  `admin_id` BIGINT UNSIGNED NOT NULL COMMENT '供应商账号ID(supplier_admin.id)',
  `role_id`  BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`admin_id`, `role_id`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商端账号角色关联表';
