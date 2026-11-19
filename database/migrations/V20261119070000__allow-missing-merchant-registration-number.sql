SET NAMES utf8mb4;
USE `mtrip_business`;

-- 未提供公司注册号时存 NULL；保留 uk_credit_code 对真实注册号的唯一约束。
SET @ddl := IF((SELECT IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='credit_code')='NO',
    'ALTER TABLE merchant_info MODIFY COLUMN credit_code VARCHAR(50) NULL DEFAULT NULL COMMENT ''统一社会信用代码''',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 兼容已批准商户；申请、KYC、账号、物业与非空注册号均保留。
UPDATE merchant_info SET credit_code=NULL WHERE TRIM(credit_code)='';
