#!/usr/bin/env bash
# Runs stage 2 registration and base-approval tests in a disposable database.

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
TEST_DB="mtrip_onboarding_registration_test"
MIGRATION="$REPO_ROOT/database/migrations/V20260915150000__add-registration-draft-identity.sql"

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

reapply_migration="$REPO_ROOT/database/migrations/V20261124090000__onboarding-registration-reapply.sql"
for pass in 1 2; do
  sed -e "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" -e "s/USE \`mtrip_system\`;/USE \`$TEST_DB\`;/" "$reapply_migration" | mysql_exec
done
sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$MIGRATION" | mysql_exec
sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$MIGRATION" | mysql_exec

template_migration="$REPO_ROOT/database/migrations/V20261118090000__onboarding-property-kyc-templates.sql"
sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$template_migration" | mysql_exec

for email_migration in "$REPO_ROOT/database/migrations/V20261012130000__add-merchant-email-identity-lock.sql" "$REPO_ROOT/database/migrations/V20261012130100__enforce-merchant-email-uniqueness.sql" "$REPO_ROOT/database/migrations/V20261013130000__add-merchant-phone-identity-and-proofs.sql" "$REPO_ROOT/database/migrations/V20261013130100__enforce-merchant-phone-uniqueness.sql"; do
  sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$email_migration" | mysql_exec
done

management_migration="$REPO_ROOT/database/migrations/V20261118130000__public-kyc-template-management.sql"
for pass in 1 2; do
  sed -e "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" -e "s/USE \`mtrip_system\`;/USE \`$TEST_DB\`;/" "$management_migration" | mysql_exec
done

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" \
  | $DOCKER exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/M12Bootstrap.php'
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-registration.php" "$SERVICE_CONTAINER:/tmp/onboarding-registration.php"
$DOCKER exec \
  -e DB_BUSINESS_DATABASE="$TEST_DB" \
  -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/onboarding-registration.php

echo "Stage 2 onboarding registration tests passed"

delete_migration="$REPO_ROOT/database/migrations/V20261124060000__onboarding-lead-delete-permission.sql"
for pass in 1 2; do
  sed "s/USE \`mtrip_system\`;/USE \`$TEST_DB\`;/" "$delete_migration" | mysql_exec
done
permission_result="$(printf 'SELECT (SELECT COUNT(*) FROM %s.sys_menu WHERE id=20509 AND perm_key="merchant:onboarding:delete"),(SELECT COUNT(*) FROM %s.sys_role_menu WHERE menu_id=20509 AND role_id=1),(SELECT COUNT(*) FROM %s.sys_role_menu WHERE menu_id=20509 AND role_id<>1);\n' "$TEST_DB" "$TEST_DB" "$TEST_DB" | mysql_exec)"
if [ "$permission_result" != $'1\t1\t0' ]; then
  echo "Deletion permission migration failed idempotence or ordinary-role isolation" >&2
  exit 1
fi
echo "PASS: deletion permission migration is idempotent and grants only the super role"

$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-lead-delete.php" "$SERVICE_CONTAINER:/tmp/onboarding-lead-delete.php"
$DOCKER exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/onboarding-lead-delete.php

$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-rejected-queue.php" "$SERVICE_CONTAINER:/tmp/onboarding-rejected-queue.php"
$DOCKER exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/onboarding-rejected-queue.php

$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-reapply-worker.php" "$SERVICE_CONTAINER:/tmp/onboarding-reapply-worker.php"
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-reapply.php" "$SERVICE_CONTAINER:/tmp/onboarding-reapply.php"
$DOCKER exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/onboarding-reapply.php

reopen_permission_result="$(printf 'SELECT (SELECT COUNT(*) FROM %s.sys_menu WHERE id=20510 AND perm_key="merchant:onboarding:reopen"),(SELECT COUNT(*) FROM %s.sys_role_menu WHERE menu_id=20510 AND role_id=1),(SELECT COUNT(*) FROM %s.sys_role_menu WHERE menu_id=20510 AND role_id<>1);\n' "$TEST_DB" "$TEST_DB" "$TEST_DB" | mysql_exec)"
if [ "$reopen_permission_result" != $'1\t1\t0' ]; then
  echo "Reopen permission migration failed idempotence or ordinary-role isolation" >&2
  exit 1
fi
echo "PASS: reopen permission migration is idempotent and grants only the super role"
