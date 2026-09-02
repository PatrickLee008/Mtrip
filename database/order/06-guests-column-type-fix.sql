-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 修复:`order_main.guests` 列类型 JSON → TEXT
-- 库:mtrip_business
--
-- 起因:`03-consumer-booking.sql` 把这一列建成了 JSON,但两处写入
--       (`App\Controller\App\OrderController::create`、`TripController::create`)
--       存的都是 `CryptoHelper::encrypt(json_encode($guests))` 的 AES 密文
--       —— 密文是 base64,不是合法 JSON,MySQL 直接报
--       `3140 Invalid JSON text: "Invalid value." at position 0`,
--       导致**任何带住客名单的下单都 500**(不带 travelers 时写 null,才侥幸没暴露)。
--
-- 取舍:保持「住客名单加密存储」的既有设计(与同表 `contact_phone` 一致,
--       读取侧 `decryptGuests()` 也是按密文写的),因此改列类型而不是改成明文 JSON。
--
-- 幂等:先查 information_schema,已是 TEXT 就跳过。
-- ============================================================
USE `mtrip_business`;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'order_main'
        AND COLUMN_NAME = 'guests'
        AND DATA_TYPE = 'json'
    ),
    'ALTER TABLE `order_main` MODIFY COLUMN `guests` TEXT NULL COMMENT ''住客名单密文(AES,明文为[{firstName,lastName,phone,email}])''',
    'DO 0'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
