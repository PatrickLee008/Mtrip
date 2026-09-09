-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App / 短信验证码]:SMSPoh Verify API V3 接入
-- 服务商文档:https://smspoh.com/v3/developers/verify-api
--
-- 为什么要动 `sys_sms_channel`:
--   原表是按 Twilio/MessageBird 设计的「一个密钥(api_key)+ 一个账号(account_sid)」模型,
--   而 SMSPoh V3 的鉴权是 `accessToken = base64(APIKey:APISecret)` —— **两段密钥**,
--   现有列放不下第二段。同时 Verify API 的 brand / pinLength / maxInvalidAttempts
--   三个参数在原表里也没有对应列,不补的话只能在代码里写死,后台改不了。
--
-- 列的对应关系(代码侧 SmsVerifyService::resolveChannel 按此读取):
--   api_key              → SMSPoh API Key   (AES 加密,原列复用)
--   api_secret           → SMSPoh API Secret(AES 加密,本次新增)
--   sign_name            → Sender ID,即 `from` 参数(原列语义就是短信签名,大小写敏感)
--   brand_name           → `brand` 参数,出现在短信正文里(本次新增)
--   code_expire_sec      → `ttl` 参数(原列,SMSPoh 限制 60~3600,代码侧会夹取)
--   pin_length           → `pinLength` 参数(本次新增,SMSPoh 限制 4~8)
--   max_invalid_attempts → `maxInvalidAttempts` 参数(本次新增,SMSPoh 限制 1~10)
--
-- `sys_sms_log` 补两列是为了排障与对账:出问题时要能回答「这条是哪个场景发的」
-- 以及「服务商那边的 requestId 是多少」,否则日志表只有一句失败原因,查不下去。
--
-- 库:mtrip_system
-- 幂等:全部先查 information_schema,已存在则跳过;可重复执行。
-- ============================================================
USE `mtrip_system`;

-- ---- 1. sys_sms_channel.api_secret:SMSPoh 的第二段密钥 ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_channel'
        AND COLUMN_NAME = 'api_secret'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_channel` ADD COLUMN `api_secret` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''API Secret(AES加密;SMSPoh 用 base64(apiKey:apiSecret) 作 accessToken)'' AFTER `api_key`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. sys_sms_channel.brand_name:短信正文里的品牌名(SMSPoh brand,必填) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_channel'
        AND COLUMN_NAME = 'brand_name'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_channel` ADD COLUMN `brand_name` VARCHAR(100) NOT NULL DEFAULT '''' COMMENT ''品牌名(SMSPoh brand 参数,出现在短信正文;留空时回退 sign_name)'' AFTER `sign_name`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 3. sys_sms_channel.pin_length:验证码位数(SMSPoh pinLength 4~8) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_channel'
        AND COLUMN_NAME = 'pin_length'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_channel` ADD COLUMN `pin_length` TINYINT NOT NULL DEFAULT 6 COMMENT ''验证码位数(SMSPoh pinLength,4~8;App 验证码页按 6 位画格)'' AFTER `code_expire_sec`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 4. sys_sms_channel.max_invalid_attempts:验证码最大错误次数(SMSPoh 1~10) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_channel'
        AND COLUMN_NAME = 'max_invalid_attempts'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_channel` ADD COLUMN `max_invalid_attempts` TINYINT NOT NULL DEFAULT 5 COMMENT ''验证码最大错误次数(SMSPoh maxInvalidAttempts,1~10;超出后该次请求作废)'' AFTER `pin_length`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 4b. sys_sms_channel.country_code:默认国家码,用于把用户输入补成 E.164 ----
-- App 登录/注册页把「+95」画成静态标签却从不拼进请求,用户输入 `9971183240` 直接发给 SMSPoh
-- 会被拒(其文档只接受 09xxxxxxxx / 959xxxxxxx / +959xxxxxx 三种前缀)。
-- 库里仍按用户原样输入存 mobile / mobile_hash(改了会让存量账号登不进来),
-- 只在**出网发短信那一刻**用这个国家码补成 E.164。平台是多站点海外 SaaS,故做成可配而不是写死 95。
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_channel'
        AND COLUMN_NAME = 'country_code'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_channel` ADD COLUMN `country_code` VARCHAR(6) NOT NULL DEFAULT ''95'' COMMENT ''默认国家码(不含+),用于把用户输入的本地号码补成E.164;缅甸=95'' AFTER `brand_name`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 5. sys_sms_log.scene:OTP 场景(register/login/reset) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_log'
        AND COLUMN_NAME = 'scene'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_log` ADD COLUMN `scene` VARCHAR(20) NOT NULL DEFAULT '''' COMMENT ''业务场景:register注册 login验证码登录 reset重置密码'' AFTER `template_id`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 6. sys_sms_log.provider_request_id:服务商请求ID(SMSPoh requestId) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_system'
        AND TABLE_NAME = 'sys_sms_log'
        AND COLUMN_NAME = 'provider_request_id'
    ),
    'DO 0',
    'ALTER TABLE `sys_sms_log` ADD COLUMN `provider_request_id` VARCHAR(64) NOT NULL DEFAULT '''' COMMENT ''服务商请求ID(SMSPoh requestId,验码与对账凭据)'' AFTER `scene`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
