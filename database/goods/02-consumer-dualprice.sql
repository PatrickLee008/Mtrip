-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M0 地基]:缅甸公民双价
-- 需求出处:PRD 反复强调「Myanmar Citizen pricing」贯穿搜索/详情/下单/确认
-- 库:mtrip_business
-- 注:docker init 仅首次建库执行;既有库需手动执行本文件(ADD COLUMN 非幂等,重复执行会报 Duplicate column,属预期)
-- ============================================================
USE `mtrip_business`;

-- 房型:基础公民门市价(0=未配置则回退外国人价 base_price)
ALTER TABLE `hotel_room_type`
  ADD COLUMN `base_price_citizen` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '缅甸公民基础门市价,0=同 base_price' AFTER `base_price`;

-- 分时库存日历:当日公民价(0=未配置则回退 price)
ALTER TABLE `goods_daily_stock`
  ADD COLUMN `price_citizen` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '当日缅甸公民价,0=同 price' AFTER `price`;
