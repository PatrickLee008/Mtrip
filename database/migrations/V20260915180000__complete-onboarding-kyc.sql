SET NAMES utf8mb4;
USE `mtrip_business`;

-- The published version is immutable in use: signatures retain both version and content digest.
INSERT INTO merchant_onboarding_agreement
  (site_id,agreement_version,title,content,content_sha256,status,effective_at,created_by)
SELECT
  0,
  '1.0',
  'mTrip 商户入驻与平台服务条款',
  '一、签署人确认其有权代表申请主体提交入驻申请及认证资料。\n二、申请主体保证所提交的公司、银行、税务、经营许可及物业资料真实、完整、有效，并同意平台为认证、履约、结算及合规目的处理相关资料。\n三、每家首批物业须独立完成适用的专项认证；商户主体或任一首批物业未通过认证时，平台可要求补正且不会影响其他已通过范围。\n四、最终批准后平台将创建商户主账号及首批物业。商户应妥善保管访问码、一次性验证码和认证器凭据，并对账号下的操作负责。\n五、酒店资料、房型、价格与库存须经适用审核并满足发布门禁后方可向用户展示。\n六、平台可根据法律、监管或业务要求发布新版本条款；最终批准前如条款版本变化，申请主体须重新阅读并签署。',
  SHA2('一、签署人确认其有权代表申请主体提交入驻申请及认证资料。\n二、申请主体保证所提交的公司、银行、税务、经营许可及物业资料真实、完整、有效，并同意平台为认证、履约、结算及合规目的处理相关资料。\n三、每家首批物业须独立完成适用的专项认证；商户主体或任一首批物业未通过认证时，平台可要求补正且不会影响其他已通过范围。\n四、最终批准后平台将创建商户主账号及首批物业。商户应妥善保管访问码、一次性验证码和认证器凭据，并对账号下的操作负责。\n五、酒店资料、房型、价格与库存须经适用审核并满足发布门禁后方可向用户展示。\n六、平台可根据法律、监管或业务要求发布新版本条款；最终批准前如条款版本变化，申请主体须重新阅读并签署。',256),
  1,
  '2026-09-15 00:00:00',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM merchant_onboarding_agreement WHERE site_id=0 AND agreement_version='1.0'
);

-- Applications approved in stage 2 are made immediately usable by the stage 3 APIs.
UPDATE merchant_application a
SET a.kyc_template_id = COALESCE((
  SELECT t.id
  FROM merchant_kyc_template t
  WHERE t.scope_type='merchant' AND t.business_type='unified' AND t.status=1
    AND t.site_id IN (0,a.site_id)
  ORDER BY (t.site_id=a.site_id) DESC,t.sort,t.id
  LIMIT 1
),a.kyc_template_id)
WHERE a.state_model_version>=1 AND a.registration_status=3 AND a.merchant_kyc_status>0
  AND a.kyc_template_id=0;

UPDATE merchant_application_business b
JOIN merchant_application a ON a.id=b.application_id AND a.site_id=b.site_id
SET b.kyc_scope=2,
    b.kyc_template_id=COALESCE((
      SELECT t.id
      FROM merchant_kyc_template t
      WHERE t.scope_type='property' AND t.business_type=b.business_type AND t.status=1
        AND t.site_id IN (0,b.site_id)
      ORDER BY (t.site_id=b.site_id) DESC,t.sort,t.id
      LIMIT 1
    ),b.kyc_template_id),
    b.kyc_status=CASE WHEN b.kyc_status=0 THEN 1 ELSE b.kyc_status END
WHERE a.state_model_version>=1 AND a.registration_status=3 AND a.merchant_kyc_status>0;

INSERT INTO merchant_verify_document
  (site_id,merchant_id,scope_type,property_id,application_id,application_business_id,
   scope_resolution_status,scope_resolution_note,scope_model_version,biz_unit,doc_type,name,
   file_url,file_size,status,uploaded_at)
SELECT
  a.site_id,0,'merchant',0,a.id,0,0,'',1,'',requirements.doc_type,requirements.doc_name,'','',0,NOW()
FROM merchant_application a
JOIN merchant_kyc_template t ON t.id=a.kyc_template_id AND t.scope_type='merchant' AND t.status=1
JOIN JSON_TABLE(t.docs, '$[*]' COLUMNS(
  doc_type VARCHAR(50) PATH '$.doc_type',
  doc_name VARCHAR(100) PATH '$.name'
)) requirements
WHERE a.state_model_version>=1 AND a.registration_status=3 AND a.merchant_kyc_status>0
  AND requirements.doc_type<>''
  AND NOT EXISTS (
    SELECT 1 FROM merchant_verify_document d
    WHERE d.application_id=a.id AND d.scope_type='merchant' AND d.application_business_id=0
      AND d.doc_type=requirements.doc_type AND d.deleted_at IS NULL
  );

INSERT INTO merchant_verify_document
  (site_id,merchant_id,scope_type,property_id,application_id,application_business_id,
   scope_resolution_status,scope_resolution_note,scope_model_version,biz_unit,doc_type,name,
   file_url,file_size,status,uploaded_at)
SELECT
  b.site_id,0,'property',0,b.application_id,b.id,0,'',1,'',requirements.doc_type,requirements.doc_name,'','',0,NOW()
FROM merchant_application_business b
JOIN merchant_application a ON a.id=b.application_id AND a.site_id=b.site_id
JOIN merchant_kyc_template t ON t.id=b.kyc_template_id AND t.scope_type='property' AND t.status=1
JOIN JSON_TABLE(t.docs, '$[*]' COLUMNS(
  doc_type VARCHAR(50) PATH '$.doc_type',
  doc_name VARCHAR(100) PATH '$.name'
)) requirements
WHERE a.state_model_version>=1 AND a.registration_status=3 AND a.merchant_kyc_status>0
  AND requirements.doc_type<>''
  AND NOT EXISTS (
    SELECT 1 FROM merchant_verify_document d
    WHERE d.application_id=b.application_id AND d.scope_type='property' AND d.application_business_id=b.id
      AND d.doc_type=requirements.doc_type AND d.deleted_at IS NULL
  );
