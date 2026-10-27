#!/usr/bin/env bash
# Employee writes run only against a disposable structure-only database.
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
TEST_DB="mtrip_employee_management_test"
TEST_DIR="/tmp/mtrip-employee-management-test"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"
mysql_exec() {
  docker exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}
if printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';\n" "$TEST_DB" | mysql_exec | rg -q .; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi
cleanup() {
  printf 'DROP DATABASE IF EXISTS `%s`;\n' "$TEST_DB" | mysql_exec >/dev/null 2>&1 || true
  docker exec "$SERVICE_CONTAINER" rm -rf "$TEST_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT
printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL PRIVILEGES ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';\n' "$TEST_DB" "$TEST_DB" | mysql_exec
for table in merchant_info merchant_group merchant_store merchant_blacklist merchant_admin merchant_role merchant_menu merchant_admin_role merchant_role_menu merchant_employee_property merchant_activity_log; do
  printf 'CREATE TABLE `%s`.`%s` LIKE `mtrip_business`.`%s`;\n' "$TEST_DB" "$table" "$table" | mysql_exec
done
for pass in 1 2; do
  sed "s/USE \`mtrip_business\`;/USE \`$TEST_DB\`;/" "$REPO_ROOT/database/migrations/V20261027160000__merchant-employee-delete.sql" | mysql_exec
done
docker exec "$SERVICE_CONTAINER" mkdir -p "$TEST_DIR"
sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" \
  | docker exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/mtrip-employee-management-test/M12Bootstrap.php'
docker cp "$REPO_ROOT/backend/services/merchant-service/test/employee-management.php" "$SERVICE_CONTAINER:$TEST_DIR/employee-management.php"
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$SERVICE_CONTAINER" php "$TEST_DIR/employee-management.php"
