#!/usr/bin/env bash
# Runs global merchant email identity tests in a disposable database.

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
TEST_DB="mtrip_merchant_email_identity_test"
MIGRATION="$REPO_ROOT/database/migrations/V20261012130000__add-merchant-email-identity-lock.sql"

$DOCKER ps >/dev/null
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$($DOCKER exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"

mysql_exec() {
  $DOCKER exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" \
    mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}

cleanup() {
  printf 'DROP DATABASE IF EXISTS `%s`;\n' "$TEST_DB" | mysql_exec >/dev/null 2>&1 || true
}

if printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';\n" "$TEST_DB" | mysql_exec | grep -q .; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi

trap cleanup EXIT
printf 'CREATE DATABASE %s CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL PRIVILEGES ON %s.* TO '\''mtrip'\''@'\''%%'\'';\n' "$TEST_DB" "$TEST_DB" | mysql_exec

create_sql="$(cat <<SQL | mysql_exec
SET SESSION group_concat_max_len=1000000;
SELECT CONCAT('CREATE TABLE IF NOT EXISTS ',CHAR(96),'$TEST_DB',CHAR(96),'.',CHAR(96),TABLE_NAME,CHAR(96),' LIKE ',CHAR(96),TABLE_SCHEMA,CHAR(96),'.',CHAR(96),TABLE_NAME,CHAR(96),';')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE'
ORDER BY TABLE_SCHEMA,TABLE_NAME;
SQL
)"
printf '%s\n' "$create_sql" | mysql_exec
sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$MIGRATION" | mysql_exec
sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$MIGRATION" | mysql_exec

cat <<SQL | mysql_exec
USE \`$TEST_DB\`;
SET @ddl=IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND INDEX_NAME='uk_registration_email_identity'),
 'ALTER TABLE merchant_application DROP INDEX uk_registration_email_identity, DROP COLUMN registration_email_identity_key','SELECT 1');
PREPARE email_stmt FROM @ddl; EXECUTE email_stmt; DEALLOCATE PREPARE email_stmt;
SET @ddl=IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND INDEX_NAME='uk_merchant_account_email_identity'),
 'ALTER TABLE merchant_admin DROP INDEX uk_merchant_account_email_identity, DROP COLUMN email_identity_key','SELECT 1');
PREPARE email_stmt FROM @ddl; EXECUTE email_stmt; DEALLOCATE PREPARE email_stmt;
INSERT INTO merchant_application (site_id, app_no, company_name, registration_email, registration_email_index)
VALUES (991, 'EMAIL-CONFLICT-A', 'Conflict A', 'fixture', REPEAT('a',64)),
       (992, 'EMAIL-CONFLICT-B', 'Conflict B', 'fixture', REPEAT('a',64));
SQL
if sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$REPO_ROOT/database/migrations/V20261012130100__enforce-merchant-email-uniqueness.sql" | mysql_exec >/dev/null 2>&1; then
  echo "FAIL: migration accepted duplicate email owners" >&2
  exit 1
fi
column_count="$(printf "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='%s' AND COLUMN_NAME IN ('email_identity_key','registration_email_identity_key');\n" "$TEST_DB" | mysql_exec)"
[ "$column_count" = "0" ] || { echo "FAIL: guarded migration partially modified tables" >&2; exit 1; }
cat <<SQL | mysql_exec
USE \`$TEST_DB\`;
DELETE FROM merchant_application WHERE app_no IN ('EMAIL-CONFLICT-A','EMAIL-CONFLICT-B');
SQL
echo "PASS: dirty migration stops before table changes and preserves both rows"

for email_migration in "$REPO_ROOT/database/migrations/V20261012130000__add-merchant-email-identity-lock.sql" "$REPO_ROOT/database/migrations/V20261012130100__enforce-merchant-email-uniqueness.sql" "$REPO_ROOT/database/migrations/V20261013130000__add-merchant-phone-identity-and-proofs.sql" "$REPO_ROOT/database/migrations/V20261013130100__enforce-merchant-phone-uniqueness.sql"; do
  sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$email_migration" | mysql_exec
  sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$email_migration" | mysql_exec
done

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" \
  | $DOCKER exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/M12Bootstrap.php'
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/email-identity.php" "$SERVICE_CONTAINER:/tmp/email-identity.php"
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/email-identity-worker.php" "$SERVICE_CONTAINER:/tmp/email-identity-worker.php"
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/bin/audit-email-identities.php" "$SERVICE_CONTAINER:/opt/www/bin/audit-email-identities.php"
$DOCKER exec \
  -e DB_BUSINESS_DATABASE="$TEST_DB" \
  -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/email-identity.php

echo "Global merchant email identity tests passed"
