SET NAMES utf8mb4;

-- Configurable SMTP transport for OTP and future outbound email. Secrets are
-- encrypted by the application; delivery logs deliberately exclude OTP bodies.
USE `mtrip_system`;

CREATE TABLE IF NOT EXISTS `sys_email_channel` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `provider_name`    VARCHAR(50)  NOT NULL DEFAULT 'SMTP' COMMENT '服务商显示名',
  `provider_code`    VARCHAR(20)  NOT NULL DEFAULT 'smtp' COMMENT '服务商标识',
  `smtp_host`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'SMTP 主机',
  `smtp_port`        SMALLINT UNSIGNED NOT NULL DEFAULT 587 COMMENT 'SMTP 端口',
  `encryption`       VARCHAR(10)  NOT NULL DEFAULT 'tls' COMMENT '传输加密:tls/ssl/none',
  `username`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'SMTP 用户名(AES加密)',
  `password`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'SMTP 密码/App Password(AES加密)',
  `from_email`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '发件邮箱',
  `from_name`        VARCHAR(100) NOT NULL DEFAULT 'mTrip' COMMENT '发件人名称',
  `otp_subject`      VARCHAR(200) NOT NULL DEFAULT 'Your mTrip verification code' COMMENT 'OTP 邮件主题',
  `otp_content`      TEXT         NULL COMMENT 'OTP 正文,支持 {{code}}/{{expiresMinutes}}',
  `code_expire_sec`  INT          NOT NULL DEFAULT 300 COMMENT '验证码有效期秒',
  `pin_length`       TINYINT UNSIGNED NOT NULL DEFAULT 6 COMMENT '验证码位数',
  `max_invalid_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT '单次验证码最大错误次数',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`           VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_site_provider` (`site_id`,`provider_code`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='邮件发送渠道表';

CREATE TABLE IF NOT EXISTS `sys_email_log` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `channel_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '邮件渠道ID',
  `scene`            VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '业务场景',
  `recipient`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT '收件人邮箱(AES加密)',
  `subject`          VARCHAR(200) NOT NULL DEFAULT '' COMMENT '邮件主题',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1成功 2失败 3发送中',
  `provider_message` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '服务端投递结果',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_site_scene` (`site_id`,`scene`),
  KEY `idx_channel_created` (`channel_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='邮件发送日志(不保存正文和验证码)';

-- Dynamic menus must be present for existing databases as well as fresh seeds.
INSERT IGNORE INTO `sys_menu`
  (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`)
VALUES
  (1312,1300,'邮件配置','Email','menu.configEmail','config:email:list',2,'/config/email','config/email/index','',6);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
  (131201,1312,'新增邮件渠道','Add Email Channel','config:email:add',3,1),
  (131202,1312,'编辑邮件渠道','Edit Email Channel','config:email:edit',3,2),
  (131203,1312,'启用禁用邮件渠道','Enable/Disable Email Channel','config:email:status',3,3),
  (131204,1312,'删除邮件渠道','Delete Email Channel','config:email:delete',3,4);
