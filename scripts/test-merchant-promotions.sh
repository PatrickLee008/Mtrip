#!/usr/bin/env bash
# Clone schema only; fixture writes are restricted to this disposable database.
set -euo pipefail
export MSYS_NO_PATHCONV=1
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB=mtrip_merchant_promotions_test
MYSQL_CONTAINER=mtrip-mysql-1
SERVICE_CONTAINER=mtrip-marketing-service-1
ROOT_PWD="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)"
DB_PASSWORD="$(docker exec "$SERVICE_CONTAINER" printenv DB_PASSWORD)"
export DB_PASSWORD
TEST_FILES="$(mktemp -d)"
mysql_exec() {
  docker exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4
}
if [ -n "$(printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';" "$TEST_DB" | mysql_exec)" ]; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi
printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';' "$TEST_DB" "$TEST_DB" | mysql_exec
cleanup() {
  printf 'REVOKE ALL PRIVILEGES ON `%s`.* FROM '\''mtrip'\''@'\''%%'\'';' "$TEST_DB" | mysql_exec >/dev/null
  printf 'DROP DATABASE IF EXISTS `%s`;' "$TEST_DB" | mysql_exec >/dev/null
  rm -rf "$TEST_FILES"
}
trap cleanup EXIT
printf "SELECT CONCAT('CREATE TABLE $TEST_DB.',TABLE_NAME,' LIKE ',TABLE_SCHEMA,'.',TABLE_NAME,';') FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE';" | mysql_exec | mysql_exec
for pass in 1 2; do
  for migration in "$REPO_ROOT"/database/migrations/V20261105090*.sql; do
    sed -e "s/\`mtrip_business\`/\`$TEST_DB\`/g" -e "s/\`mtrip_system\`/\`$TEST_DB\`/g" "$migration" | mysql_exec >/dev/null
  done
done
sed -e "s/mtrip_m12_s1_test/$TEST_DB/g" -e 's/SCAN_CACHEABLE=true/SCAN_CACHEABLE=false/' \
  "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" > "$TEST_FILES/M12Bootstrap.php"
cp "$REPO_ROOT/backend/services/marketing-service/test/merchant-promotions.php" "$TEST_FILES/merchant-promotions.php"
cp "$REPO_ROOT/backend/services/order-service/test/merchant-promotion-entitlements.php" "$TEST_FILES/merchant-promotion-entitlements.php"
# A separate container keeps DI scan caches independent from the running service.
docker run --rm --network mtrip_default --volumes-from "$SERVICE_CONTAINER:ro" \
  -v "$TEST_FILES:/tests:ro" -e DB_HOST=mysql -e DB_PASSWORD \
  -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" \
  --entrypoint php mtrip-marketing-service /tests/merchant-promotions.php

docker run --rm --network mtrip_default --volumes-from mtrip-order-service-1:ro \
  -v "$TEST_FILES:/tests:ro" -e DB_HOST=mysql -e DB_PASSWORD \
  -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" \
  --entrypoint php mtrip-order-service /tests/merchant-promotion-entitlements.php
