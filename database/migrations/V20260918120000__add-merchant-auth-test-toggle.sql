-- 商户认证测试模式运行时开关。
-- 部署环境还必须显式设置 MTRIP_MERCHANT_AUTH_TEST_ALLOWED=true；生产环境始终禁用。

SET NAMES utf8mb4;
USE mtrip_system;

INSERT INTO sys_config (config_group, config_key, config_value, value_type, config_name, default_value, remark)
SELECT 'security', 'merchant_auth_test_mode', '0', 3, '商户认证测试模式', '0',
       '仅测试环境可开启。开启后商户注册、激活、登录和恢复使用固定验证码000000，并跳过外部凭证投递。'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'merchant_auth_test_mode');
