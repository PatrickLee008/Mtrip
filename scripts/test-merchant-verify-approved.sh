#!/usr/bin/env bash
# Verify the approved read model using empty schema clones in a disposable database.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB="mtrip_verify_approved_test"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
ROOT_PWD="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)"
mysql_exec() {
  docker exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}
if printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';\n" "$TEST_DB" | mysql_exec | rg -q .; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi
cleanup() { printf 'DROP DATABASE IF EXISTS `%s`;\n' "$TEST_DB" | mysql_exec >/dev/null; }
trap cleanup EXIT
printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL PRIVILEGES ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';\n' "$TEST_DB" "$TEST_DB" | mysql_exec
for table in merchant_info merchant_application merchant_application_business merchant_verify_document merchant_verify_document_revision merchant_verify_timeline merchant_kyc_template merchant_access_code_log merchant_credential_delivery; do
  printf 'CREATE TABLE `%s`.`%s` LIKE mtrip_business.`%s`;\n' "$TEST_DB" "$table" "$table" | mysql_exec
done
printf 'CREATE TABLE `%s`.sys_config LIKE mtrip_system.sys_config;\n' "$TEST_DB" | mysql_exec
sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/M12Bootstrap.php'
sed 's/class VerifyController extends/class ApprovedUiVerifyController extends/' "$REPO_ROOT/backend/services/merchant-service/app/Controller/Admin/VerifyController.php" | docker exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/ApprovedUiVerifyController.php'
docker cp "$REPO_ROOT/backend/services/merchant-service/test/verify-approved-detail.php" "$SERVICE_CONTAINER:/tmp/verify-approved-detail.php"
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/verify-approved-detail.php
