#!/usr/bin/env bash
# Exercises the onboarding contract migration only in disposable databases.

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MIGRATION="$REPO_ROOT/database/migrations/V20260915120000__add-onboarding-contract-model.sql"
DOCKER="${DOCKER:-docker}"
CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
UPGRADE_DB="mtrip_onboarding_contract_test"
CONFLICT_DB="mtrip_onboarding_contract_conflict_test"

$DOCKER ps >/dev/null
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$($DOCKER exec "$CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"

mysql_exec() {
  $DOCKER exec -i -e "MYSQL_PWD=$ROOT_PWD" "$CONTAINER" \
    mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}

cleanup() {
  printf 'DROP DATABASE IF EXISTS `%s`; DROP DATABASE IF EXISTS `%s`;\n' "$UPGRADE_DB" "$CONFLICT_DB" | mysql_exec >/dev/null 2>&1 || true
}
trap cleanup EXIT

create_legacy_schema() {
  local database="$1"
  cat <<SQL | mysql_exec
DROP DATABASE IF EXISTS \`$database\`;
CREATE DATABASE \`$database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
USE \`$database\`;
CREATE TABLE merchant_application (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  app_no VARCHAR(30) NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  company_name VARCHAR(100) NOT NULL,
  business_types VARCHAR(100) NOT NULL DEFAULT '',
  stage TINYINT NOT NULL DEFAULT 1,
  assigned_ops_name VARCHAR(50) NOT NULL DEFAULT '',
  registration_channel VARCHAR(10) NOT NULL DEFAULT '',
  registration_contact_hash CHAR(64) NOT NULL DEFAULT '',
  confirmation_status TINYINT NOT NULL DEFAULT 0,
  confirmed_at DATETIME NULL,
  submitted_at DATETIME NULL,
  last_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY uk_app_no (app_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE merchant_application_business (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  application_id BIGINT UNSIGNED NOT NULL,
  business_name VARCHAR(100) NOT NULL,
  business_type VARCHAR(30) NOT NULL DEFAULT '',
  city VARCHAR(50) NOT NULL DEFAULT '',
  kyc_status TINYINT NOT NULL DEFAULT 0,
  kyc_submitted_at DATETIME NULL,
  kyc_submitted_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE merchant_verify_document (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  merchant_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  scope_type VARCHAR(20) NOT NULL DEFAULT 'merchant',
  property_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  application_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  biz_unit VARCHAR(64) NOT NULL DEFAULT '',
  doc_type VARCHAR(50) NOT NULL,
  status TINYINT NOT NULL DEFAULT 2,
  file_url VARCHAR(500) NOT NULL DEFAULT '',
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE merchant_info (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  merchant_name VARCHAR(100) NOT NULL,
  credit_code VARCHAR(50) NOT NULL,
  legal_person VARCHAR(50) NOT NULL,
  contact_name VARCHAR(50) NOT NULL,
  contact_phone VARCHAR(255) NOT NULL,
  status TINYINT NOT NULL DEFAULT 0,
  access_code VARCHAR(32) NOT NULL DEFAULT '',
  access_status TINYINT NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE merchant_admin (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  account_type TINYINT NOT NULL DEFAULT 2,
  merchant_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_owner TINYINT NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE merchant_store (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  merchant_id BIGINT UNSIGNED NOT NULL,
  source_business_id BIGINT UNSIGNED NULL,
  store_name VARCHAR(100) NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_source_business (source_business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
SQL
}

apply_migration() {
  local database="$1"
  sed "s/USE \`mtrip_business\`;/USE \`$database\`;/" "$MIGRATION" | mysql_exec >/dev/null
}

create_legacy_schema "$UPGRADE_DB"
cat <<SQL | mysql_exec
USE \`$UPGRADE_DB\`;
INSERT INTO merchant_application (id,site_id,app_no,merchant_id,company_name,business_types,stage,registration_channel,registration_contact_hash)
VALUES
  (81001,991,'APP-S1-1',82001,'Approved Hotel','hotel',5,'email',REPEAT('a',64)),
  (81002,991,'APP-S1-2',0,'KYC Draft','car_rental',3,'sms',REPEAT('b',64)),
  (81003,991,'APP-S1-3',0,'Submitted','hotel',1,'email',REPEAT('c',64)),
  (81004,991,'APP-S1-4',0,'Reviewing','hotel',2,'email',REPEAT('d',64)),
  (81005,991,'APP-S1-5',0,'Rejected','hotel',6,'email',REPEAT('e',64)),
  (81006,991,'APP-S1-6',0,'Draft','hotel',0,'email',REPEAT('f',64));
INSERT INTO merchant_application_business (id,site_id,application_id,business_name,business_type,city,kyc_status)
VALUES (83001,991,81001,'Initial Hotel','hotel','Yangon',1),
       (83003,991,81001,'Second Hotel','hotel','Mandalay',1),
       (83002,991,81002,'Initial Rental','car_rental','Yangon',0);
INSERT INTO merchant_info (id,site_id,merchant_name,credit_code,legal_person,contact_name,contact_phone,status,access_code,access_status)
VALUES (82001,991,'Approved Hotel','S1-CREDIT','Owner','Owner','ciphertext',3,'MTRP-HOTEL-S1',1);
INSERT INTO merchant_admin (id,site_id,account_type,merchant_id,username,password,is_owner)
VALUES (82501,991,2,82001,'stage1-owner','not-a-login-hash',1);
INSERT INTO merchant_store (id,site_id,merchant_id,source_business_id,store_name)
VALUES (84001,991,82001,83001,'Initial Hotel'),
       (84002,991,82001,83003,'Second Hotel');
INSERT INTO merchant_verify_document
  (id,site_id,merchant_id,scope_type,property_id,application_id,biz_unit,doc_type,status,file_url)
VALUES
  (85001,991,0,'merchant',0,81001,'','business_reg',2,'/pending.pdf'),
  (85002,991,0,'merchant',0,81001,'83001','business_reg',1,'/approved.pdf'),
  (85003,991,0,'merchant',0,81001,'83001','operating_license',1,'/license.pdf'),
  (85004,991,0,'merchant',0,81001,'99999','tax_cert',2,'/orphan.pdf'),
  (85005,991,82001,'property',84001,0,'','hotel_license',1,'/property.pdf'),
  (85006,992,0,'merchant',0,81001,'83001','operating_license',2,'/cross-site.pdf'),
  (85007,991,82001,'property',84002,0,'','hotel_license',1,'/property-2.pdf');
SQL

legacy_documents="$(cat <<SQL | mysql_exec
USE \`$UPGRADE_DB\`;
SELECT CONCAT(COUNT(*),':',SHA2(GROUP_CONCAT(CONCAT(id,':',status,':',file_url) ORDER BY id SEPARATOR '|'),256))
FROM merchant_verify_document;
SQL
)"
apply_migration "$UPGRADE_DB"

result="$(cat <<SQL | mysql_exec
USE \`$UPGRADE_DB\`;
SELECT CONCAT(registration_status,':',merchant_kyc_status,':',account_status,':',primary_business_type,':',contact_data_status)
FROM merchant_application WHERE id=81001;
SELECT GROUP_CONCAT(CONCAT(id,':',registration_status,':',merchant_kyc_status,':',account_status) ORDER BY id)
FROM merchant_application WHERE id BETWEEN 81002 AND 81006;
SELECT GROUP_CONCAT(CONCAT(id,':',application_business_id,':',scope_resolution_status) ORDER BY id)
FROM merchant_verify_document WHERE id BETWEEN 85001 AND 85007;
SELECT COUNT(*) FROM information_schema.TABLES
WHERE TABLE_SCHEMA='$UPGRADE_DB' AND TABLE_NAME IN ('merchant_onboarding_agreement','merchant_application_signature');
SELECT COUNT(DISTINCT CONCAT(TABLE_NAME, ':', INDEX_NAME)) FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA='$UPGRADE_DB' AND INDEX_NAME IN (
  'idx_onboarding_states','idx_registration_phone','idx_registration_email','uk_final_approval_request',
  'uk_application_client_ref','idx_application_kyc','idx_application_business_document','uk_access_code_normalized'
);
SELECT access_code_normalized FROM merchant_info WHERE id=82001;
SQL
)"
expected="$(cat <<'TXT'
3:5:2:hotel:1
81002:3:1:0,81003:1:0:0,81004:2:0:0,81005:5:0:0,81006:0:0:0
85001:0:2,85002:83001:2,85003:83001:1,85004:0:2,85005:83001:0,85006:0:2,85007:83003:0
2
8
MTRP-HOTEL-S1
TXT
)"
if [ "$result" != "$expected" ]; then
  printf 'Unexpected migration result:\n%s\n' "$result" >&2
  exit 1
fi

current_documents="$(cat <<SQL | mysql_exec
USE \`$UPGRADE_DB\`;
SELECT CONCAT(COUNT(*),':',SHA2(GROUP_CONCAT(CONCAT(id,':',status,':',file_url) ORDER BY id SEPARATOR '|'),256))
FROM merchant_verify_document;
SQL
)"
[ "$current_documents" = "$legacy_documents" ] || { echo 'Migration changed document count or file versions' >&2; exit 1; }

if printf "INSERT INTO \`%s\`.merchant_store (id,site_id,merchant_id,source_business_id,store_name) VALUES (84003,991,82001,83001,'Duplicate source');\n" "$UPGRADE_DB" | mysql_exec >/dev/null 2>&1; then
  echo 'Duplicate application business mapping was accepted' >&2
  exit 1
fi

printf 'UPDATE `%s`.merchant_application SET registration_status=4 WHERE id=81001; UPDATE `%s`.merchant_verify_document SET scope_resolution_status=0 WHERE id=85003;\n' "$UPGRADE_DB" "$UPGRADE_DB" | mysql_exec >/dev/null
apply_migration "$UPGRADE_DB"
preserved="$(printf "SELECT CONCAT(a.registration_status,':',d.scope_resolution_status) FROM \`%s\`.merchant_application a JOIN \`%s\`.merchant_verify_document d ON d.id=85003 WHERE a.id=81001;\n" "$UPGRADE_DB" "$UPGRADE_DB" | mysql_exec)"
[ "$preserved" = "4:0" ] || { echo 'Second migration run overwrote initialized state or scope' >&2; exit 1; }

create_legacy_schema "$CONFLICT_DB"
cat <<SQL | mysql_exec
USE \`$CONFLICT_DB\`;
INSERT INTO merchant_info (site_id,merchant_name,credit_code,legal_person,contact_name,contact_phone,status,access_code,deleted_at)
VALUES (991,'A','S1-A','A','A','',3,'Hab123',NULL),
       (991,'B','S1-B','B','B','',3,'hAB123','2026-09-15 00:00:00');
SQL
if apply_migration "$CONFLICT_DB" 2>/dev/null; then
  echo 'Case-insensitive duplicate access code did not block migration' >&2
  exit 1
fi
partial="$(cat <<SQL | mysql_exec
SELECT CONCAT(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='$CONFLICT_DB'
     AND COLUMN_NAME IN ('registration_status','merchant_kyc_status','account_status','application_business_id','access_code_normalized')),
  ':',
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA='$CONFLICT_DB'
     AND TABLE_NAME IN ('merchant_onboarding_agreement','merchant_application_signature'))
);
SQL
)"
[ "$partial" = "0:0" ] || { echo 'Preflight failure left partial onboarding table changes' >&2; exit 1; }

create_legacy_schema "$CONFLICT_DB"
apply_migration "$CONFLICT_DB"
apply_migration "$CONFLICT_DB"
empty_result="$(printf "SELECT CONCAT((SELECT COUNT(*) FROM \`%s\`.merchant_application),':',(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='%s' AND TABLE_NAME IN ('merchant_onboarding_agreement','merchant_application_signature')));\n" "$CONFLICT_DB" "$CONFLICT_DB" | mysql_exec)"
[ "$empty_result" = "0:2" ] || { echo 'Empty schema migration or second run failed' >&2; exit 1; }

echo 'PASS: onboarding contract migration, deterministic backfill, scope isolation, idempotency and preflight gates'
