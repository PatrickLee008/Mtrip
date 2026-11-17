SET NAMES utf8mb4;

-- mTrip Consumer App 版本更新与强制更新(Consumer App PRD v1.0.6 19.1)。
--
--   sys_config 分组 app_version     Android / iOS 各自的最低支持版本、最新版本、商店地址 + 共用更新说明,
--                                   后台「全局配置 → App Version」维护,改完即生效,无需发新包。
--   消费端                          App 启动 / 回到前台调 GET /api/v1/app/site/version-check(公开,无需登录):
--                                   已装版本 < 最低支持版本 → 强制更新(阻断);< 最新版本 → 可选更新(可稍后)。
--
-- 版本号留空 = 该项不启用(上线即不打扰任何用户);版本格式 1~4 段数字(如 1.2.3),后台保存时校验。
-- 幂等:INSERT IGNORE(config_key 唯一)。

USE `mtrip_system`;

INSERT IGNORE INTO `sys_config`
  (`config_group`, `config_key`, `config_value`, `value_type`, `config_name`, `default_value`, `remark`)
VALUES
  ('app_version', 'app_android_min_version',    '', 1, 'Android 最低支持版本', '', '低于此版本强制更新,留空 = 不强更,格式如 1.2.0'),
  ('app_version', 'app_android_latest_version', '', 1, 'Android 最新版本', '', '低于此版本提示可选更新,留空 = 不提示'),
  ('app_version', 'app_android_store_url',      'https://play.google.com/store/apps/details?id=com.mtrip.clientapp', 1,
   'Android 商店地址', 'https://play.google.com/store/apps/details?id=com.mtrip.clientapp', 'Google Play 应用页地址'),
  ('app_version', 'app_ios_min_version',        '', 1, 'iOS 最低支持版本', '', '低于此版本强制更新,留空 = 不强更,格式如 1.2.0'),
  ('app_version', 'app_ios_latest_version',     '', 1, 'iOS 最新版本', '', '低于此版本提示可选更新,留空 = 不提示'),
  ('app_version', 'app_ios_store_url',          '', 1, 'iOS 商店地址', '', 'App Store 应用页地址,如 https://apps.apple.com/app/id123456789'),
  ('app_version', 'app_update_notes',           '', 1, '更新说明', '', '更新弹窗正文,留空用 App 内置文案');
