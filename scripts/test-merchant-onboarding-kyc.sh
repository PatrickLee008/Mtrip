#!/usr/bin/env bash
# Runs stage 3 KYC, agreement, review and resubmission tests in a disposable database.

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
TEST_DB="mtrip_onboarding_kyc_test"
MIGRATION="$REPO_ROOT/database/migrations/V20260915180000__complete-onboarding-kyc.sql"

$DOCKER ps >/dev/null
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$($DOCKER exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"

mysql_exec() {
  $DOCKER exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" \
    mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}

cleanup() {
  printf 'DROP DATABASE IF EXISTS `%s`;\n' "$TEST_DB" | mysql_exec >/dev/null 2>&1 || true
}
trap cleanup EXIT

if printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';\n" "$TEST_DB" | mysql_exec | grep -q .; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi

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

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" \
  | $DOCKER exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/M12Bootstrap.php'
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-kyc.php" "$SERVICE_CONTAINER:/tmp/onboarding-kyc.php"
$DOCKER exec \
  -e DB_BUSINESS_DATABASE="$TEST_DB" \
  -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/onboarding-kyc.php

echo "Stage 3 onboarding KYC tests passed"
