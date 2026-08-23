-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 修复:恢复 Hotel – Single Property 验证模板原始数据
-- (冒烟脚本 JSON 序列化误写,恢复为种子原始清单)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

UPDATE `merchant_kyc_template`
SET `name` = 'Hotel – Single Property',
    `docs` = JSON_ARRAY(
      JSON_OBJECT('name', 'Business Registration Certificate', 'doc_type', 'business_reg', 'required', true),
      JSON_OBJECT('name', 'Hotel Operating License', 'doc_type', 'hotel_license', 'required', true),
      JSON_OBJECT('name', 'Owner NRC / Passport', 'doc_type', 'id_doc', 'required', true),
      JSON_OBJECT('name', 'Bank Certificate', 'doc_type', 'bank_letter', 'required', true),
      JSON_OBJECT('name', 'Tax Registration Certificate', 'doc_type', 'tax_cert', 'required', true),
      JSON_OBJECT('name', 'Premises Ownership / Lease Agreement', 'doc_type', 'premises_lease', 'required', false)
    )
WHERE `id` = 1;
