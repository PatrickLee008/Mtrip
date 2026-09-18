#!/usr/bin/env bash
# Runs the merchant authentication test-mode config checks in a disposable database.

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${SYSTEM_SERVICE_CONTAINER:-mtrip-system-service-1}"
TEST_DB="mtrip_global_config_test"

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

printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL PRIVILEGES ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';\n' "$TEST_DB" "$TEST_DB" | mysql_exec
printf 'CREATE TABLE `%s`.`sys_config` LIKE `mtrip_system`.`sys_config`;\n' "$TEST_DB" | mysql_exec

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" \
  | $DOCKER exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/M12Bootstrap.php'
$DOCKER cp "$REPO_ROOT/backend/services/system-service/test/global-config-merchant-test-mode.php" "$SERVICE_CONTAINER:/tmp/global-config-merchant-test-mode.php"
$DOCKER exec \
  -e DB_BUSINESS_DATABASE="$TEST_DB" \
  -e DB_SYSTEM_DATABASE="$TEST_DB" \
  "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/global-config-merchant-test-mode.php

echo "Global config merchant test-mode tests passed"
