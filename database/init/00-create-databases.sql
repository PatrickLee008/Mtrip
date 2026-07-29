-- ============================================================
-- Mtrip 建库脚本(MySQL 8.0+)
-- mtrip_system   : 系统域(sys_* 表:管理员/RBAC/站点/配置/客户端/审计日志)
-- mtrip_business : 业务域(商户/供应商/用户/商品/订单/财务/营销/核销)
-- 所有微服务共用同一 MySQL 实例;业务服务经 databases.php 中
-- 名为 system 的连接访问 mtrip_system(共享中间件写审计日志)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `mtrip_system`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `mtrip_business`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 应用账号(docker-compose 中通过环境变量注入实际密码)
CREATE USER IF NOT EXISTS 'mtrip'@'%' IDENTIFIED BY 'mtrip@2026';
GRANT ALL PRIVILEGES ON `mtrip_system`.* TO 'mtrip'@'%';
GRANT ALL PRIVILEGES ON `mtrip_business`.* TO 'mtrip'@'%';
FLUSH PRIVILEGES;
