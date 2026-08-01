-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M0 地基 + M1 预订闭环]:订单增强 + 退款钱包化
-- 需求出处:PRD 模块 1/5/6/9/11(住客名单/券与长住优惠/平台费/退款仅入 mTrip 钱包)
-- 库:mtrip_business
-- 注:docker init 仅首次建库执行;既有库需手动执行本文件(ADD COLUMN 非幂等)
-- ============================================================
USE `mtrip_business`;

-- 订单主表增强(双价 / 平台费 / 多住客 / 长住优惠 / 券分摊 / Trip 预留)
ALTER TABLE `order_main`
  ADD COLUMN `trip_id`               BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Trip主单ID,0=独立单(多酒店 M4)' AFTER `user_id`,
  ADD COLUMN `is_citizen`            TINYINT       NOT NULL DEFAULT 0 COMMENT '是否按缅甸公民价:0否 1是' AFTER `order_type`,
  ADD COLUMN `longstay_discount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '长住优惠额' AFTER `discount_amount`,
  ADD COLUMN `alloc_coupon_discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Trip券分摊到本单额(独立单=coupon_discount)' AFTER `coupon_discount`,
  ADD COLUMN `platform_fee`          DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台便民费(仅用户主动取消时从退款额扣)' AFTER `pay_amount`,
  ADD COLUMN `guests`                JSON          NULL COMMENT '住客名单[{firstName,lastName,phone,email}]' AFTER `contact_phone`,
  ADD KEY `idx_trip_id` (`trip_id`);

-- 退款单:退款渠道(PRD 强制默认入 mTrip 钱包)
ALTER TABLE `order_refund`
  ADD COLUMN `refund_channel` TINYINT NOT NULL DEFAULT 1 COMMENT '退款渠道:1mTrip钱包 2原路退回' AFTER `refund_amount`;
