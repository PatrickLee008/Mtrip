-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 系统表 01:管理员 / 角色 / 菜单(RBAC 权限体系,文档模块1/2/3)
-- 库:mtrip_system
-- ============================================================
USE `mtrip_system`;

-- 管理员账号表
CREATE TABLE IF NOT EXISTS `sys_admin` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全平台(超管)',
  `username`       VARCHAR(50)  NOT NULL COMMENT '登录账号',
  `password`       VARCHAR(255) NOT NULL COMMENT '登录密码(bcrypt)',
  `real_name`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '管理员姓名',
  `mobile`         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '手机号(加密)',
  `email`          VARCHAR(100) NOT NULL DEFAULT '' COMMENT '邮箱',
  `avatar`         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像URL',
  `is_super`       TINYINT      NOT NULL DEFAULT 0 COMMENT '是否超级管理员:0否 1是',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `login_fail_count` INT        NOT NULL DEFAULT 0 COMMENT '连续登录失败次数',
  `locked_until`   DATETIME     NULL DEFAULT NULL COMMENT '锁定截止时间',
  `last_login_at`  DATETIME     NULL DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '最后登录IP',
  `remark`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='管理员账号表';

-- 管理员登录记录表
CREATE TABLE IF NOT EXISTS `sys_admin_login_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `admin_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '管理员ID',
  `username`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '登录账号',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `login_ip`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '登录IP',
  `user_agent`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '操作系统/浏览器',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '结果:1成功 2密码错误 3账号锁定 4账号禁用',
  `remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注(失败原因)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='管理员登录记录表';

-- 角色表
CREATE TABLE IF NOT EXISTS `sys_role` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,全局角色=0',
  `role_name`   VARCHAR(50)  NOT NULL COMMENT '角色名称',
  `role_type`   TINYINT      NOT NULL DEFAULT 1 COMMENT '角色类型:1全局角色 2站点角色',
  `description` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '角色描述',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='角色表';

-- 账号-角色关联表
CREATE TABLE IF NOT EXISTS `sys_admin_role` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `admin_id`   BIGINT UNSIGNED NOT NULL COMMENT '管理员ID',
  `role_id`    BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_role` (`admin_id`, `role_id`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='账号角色关联表';

-- 菜单按钮权限树表
CREATE TABLE IF NOT EXISTS `sys_menu` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '父级菜单ID,0=根',
  `menu_name`  VARCHAR(50)  NOT NULL COMMENT '菜单名称(中文)',
  `menu_name_en` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '菜单英文名称(无 i18n_key 词条时非中文环境的显示名)',
  `i18n_key`   VARCHAR(100) NOT NULL DEFAULT '' COMMENT '多语言标记(前端词条 key,如 menu.systemAdmin;扩展语言仅需前端补词条)',
  `perm_key`   VARCHAR(100) NOT NULL DEFAULT '' COMMENT '权限标识(唯一key,如 sys:admin:add)',
  `menu_type`  TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1一级菜单(目录) 2页面菜单 3页面按钮',
  `route_path` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '前端路由地址',
  `component`  VARCHAR(200) NOT NULL DEFAULT '' COMMENT '前端组件路径',
  `icon`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '图标',
  `sort`       INT          NOT NULL DEFAULT 0 COMMENT '排序号(小在前)',
  `status`     TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1显示 2隐藏',
  `is_cache`   TINYINT      NOT NULL DEFAULT 1 COMMENT '页面缓存:1缓存 2不缓存(多页签 keep-alive,仅页面菜单生效)',
  `remark`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_perm_key` (`perm_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='菜单按钮权限树表';

-- 角色-菜单权限关联表
CREATE TABLE IF NOT EXISTS `sys_role_menu` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id`    BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  `menu_id`    BIGINT UNSIGNED NOT NULL COMMENT '菜单/按钮ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_menu` (`role_id`, `menu_id`),
  KEY `idx_menu_id` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='角色菜单权限关联表';
