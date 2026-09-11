SET NAMES utf8mb4;

-- KYC is now one application-level checklist. Legacy business-type templates
-- are retained only for audit history and are no longer selected at runtime.
USE `mtrip_business`;

INSERT INTO `merchant_kyc_template` (`site_id`, `name`, `business_type`, `docs`, `status`, `sort`)
SELECT
  0,
  'Unified Merchant KYC',
  'unified',
  JSON_ARRAY(
    JSON_OBJECT('name', 'Business Registration Certificate', 'doc_type', 'business_reg', 'required', true),
    JSON_OBJECT('name', 'Business Operating License', 'doc_type', 'operating_license', 'required', true),
    JSON_OBJECT('name', 'Owner NRC / Passport', 'doc_type', 'id_doc', 'required', true),
    JSON_OBJECT('name', 'Bank Certificate', 'doc_type', 'bank_letter', 'required', true),
    JSON_OBJECT('name', 'Tax Registration Certificate', 'doc_type', 'tax_cert', 'required', true),
    JSON_OBJECT('name', 'Premises Ownership / Lease Agreement', 'doc_type', 'premises_lease', 'required', false)
  ),
  1,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM `merchant_kyc_template`
  WHERE `site_id` = 0 AND `business_type` = 'unified'
);
