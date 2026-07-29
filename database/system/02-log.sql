-- ============================================================
-- 系统表 02:审计日志(文档模块4/14,永久留存不可删改)
-- 库:mtrip_system
-- 分表策略:sys_api_access_log 按月分表(单表<500万),
--   由定时任务在每月末预建下月表(复制本模板表结构,后缀 _YYYYMM)
-- ============================================================
USE `mtrip_system`;

-- 系统操作日志表(后台管理员全部写操作)
CREATE TABLE IF NOT EXISTS `sys_operation_log` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `admin_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '管理员ID',
  `admin_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '管理员姓名',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `module`         VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作模块(管理员/角色/存储/支付等)',
  `action`         VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作类型(新增/编辑/删除/导出/登录/重置密码等)',
  `content`        TEXT         NULL COMMENT '操作详细内容(脱敏参数,含修改前后数据)',
  `request_url`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '请求接口地址',
  `request_method` VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '请求方式',
  `client_ip`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '客户端IP',
  `user_agent`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '操作系统/浏览器',
  `status_code`    INT          NOT NULL DEFAULT 0 COMMENT '响应HTTP状态码',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_module` (`module`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统操作日志表(永久留存,禁止手动删改)';

-- 接口调用日志表(移动端 API 全量日志,按月分表模板)
CREATE TABLE IF NOT EXISTS `sys_api_access_log` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `client_pk_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '客户端表主键ID',
  `client_id`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT 'ClientId',
  `client_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '客户端名称',
  `client_type`     TINYINT      NOT NULL DEFAULT 0 COMMENT '客户端类型:1Android 2iOS 3H5',
  `api_path`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '请求接口完整路径',
  `request_method`  VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '请求方式',
  `request_headers` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '请求Header(脱敏)',
  `request_params`  TEXT         NULL COMMENT '请求入参(脱敏)',
  `response_code`   INT          NOT NULL DEFAULT 0 COMMENT '响应HTTP状态码',
  `response_body`   TEXT         NULL COMMENT '响应返回数据(脱敏,截断)',
  `cost_ms`         INT          NOT NULL DEFAULT 0 COMMENT '调用耗时(ms)',
  `device_info`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '客户端设备信息',
  `client_ip`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '客户端IP',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '调用时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_api_path` (`api_path`),
  KEY `idx_response_code` (`response_code`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接口调用日志表(月分表模板,永久留存,仅定时任务归档)';
