-- ============================================================
-- 种子数据 03:默认全局配置 + 示例站点树(全球→欧洲→法国→巴黎)
-- 库:mtrip_system
-- ============================================================
USE `mtrip_system`;

-- ---------- 默认全局配置(config_key 唯一,重复执行自动忽略) ----------
INSERT IGNORE INTO `sys_config` (`config_group`, `config_key`, `config_value`, `value_type`, `config_name`, `default_value`, `remark`) VALUES
-- base 平台基础
('base', 'platform_name',        'Mtrip海外旅游平台', 1, '平台名称',        'Mtrip海外旅游平台', ''),
('base', 'platform_logo',        '',                  1, '平台Logo URL',    '',                  ''),
('base', 'default_language',     'zh-CN',             1, '后台默认语言',    'zh-CN',             'zh-CN/en-US'),
('base', 'default_currency',     'EUR',               1, '平台默认货币',    'EUR',               'ISO 4217'),
('base', 'default_timezone',     'UTC',               1, '平台默认时区',    'UTC',               ''),
('base', 'customer_service_email', 'support@mtrip.com', 1, '客服邮箱',      'support@mtrip.com', ''),
-- security 安全策略
('security', 'login_fail_limit',     '5',    2, '登录失败锁定次数',       '5',    '连续失败N次锁定账号'),
('security', 'login_lock_minutes',   '30',   2, '账号锁定时长(分钟)',     '30',   ''),
('security', 'jwt_expire_minutes',   '120',  2, 'JWT有效期(分钟)',        '120',  '管理后台AccessToken'),
('security', 'jwt_refresh_days',     '7',    2, 'RefreshToken有效期(天)', '7',    ''),
('security', 'password_min_length',  '8',    2, '密码最小长度',           '8',    '需含字母+数字'),
('security', 'ip_white_enabled',     '0',    3, '后台IP白名单开关',       '0',    '0关闭 1开启'),
-- upload 上传限制
('upload', 'upload_max_size_mb',   '10',                        2, '单文件上传上限(MB)', '10', ''),
('upload', 'upload_allow_ext',     'jpg,jpeg,png,webp,gif,pdf', 1, '允许上传扩展名',     'jpg,jpeg,png,webp,gif,pdf', '逗号分隔'),
('upload', 'upload_default_storage', '1',                       2, '默认存储配置ID',     '1', '对应 sys_storage.id'),
-- client 客户端与日志
('client', 'client_sign_expire_seconds', '300',  2, '客户端签名有效期(秒)',   '300',  '时间戳偏差窗口'),
('client', 'client_default_qps',         '50',   2, '客户端默认QPS限制',      '50',   ''),
('client', 'api_log_retain_days',        '180',  2, '接口日志保留天数',       '180',  '按月分表归档'),
('client', 'operation_log_retain_days',  '0',    2, '操作日志保留天数',       '0',    '0=永久(审计要求不可删)');

-- ---------- 示例站点树:全球(1)→ 欧洲(2)→ 法国(3)→ 巴黎(4) ----------
INSERT IGNORE INTO `sys_site` (`id`, `parent_id`, `site_name`, `site_type`, `country_code`, `timezone`, `currency`, `language`, `status`, `sort`, `remark`) VALUES
(1, 0, '全球', 2, '',   'UTC',          'EUR', 'en-US', 1, 1, '根站点(全球总站)'),
(2, 1, '欧洲', 2, '',   'Europe/Paris', 'EUR', 'en-US', 1, 1, '欧洲区域站'),
(3, 2, '法国', 1, 'FR', 'Europe/Paris', 'EUR', 'fr-FR', 1, 1, '法国国家站'),
(4, 3, '巴黎', 3, 'FR', 'Europe/Paris', 'EUR', 'fr-FR', 1, 1, '巴黎城市站(示例运营站点)');

-- ---------- 巴黎站点差异化配置示例 ----------
INSERT IGNORE INTO `sys_site_config` (`site_id`, `config_group`, `config_key`, `config_value`, `config_name`) VALUES
(4, 'local',   'vat_rate',        '0.20',  '增值税率(VAT 20%)'),
(4, 'local',   'city_tax',        '2.50',  '城市税(欧元/人/晚)'),
(4, 'operate', 'commission_rate', '0.10',  '平台默认佣金比例'),
(4, 'page',    'site_logo',       '',      '站点Logo URL');
