#!/usr/bin/env bash
# 取消 / 全额退款返还优惠券专项:克隆表结构到一次性隔离库,不读写开发库业务数据(同 test-booking-remediation.sh)。
set -euo pipefail
# Git Bash 会把 /tmp 等容器内路径改写成 Windows 路径
export MSYS_NO_PATHCONV=1

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB=mtrip_coupon_release_test
MYSQL_CONTAINER=mtrip-mysql-1
CONTAINER=mtrip-order-service-1
ROOT_PWD="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)"

mysql_exec() {
  docker exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4
}

if [ -n "$(printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';" "$TEST_DB" | mysql_exec)" ]; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi

printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';' "$TEST_DB" "$TEST_DB" | mysql_exec
trap 'printf "DROP DATABASE IF EXISTS %s;" "$TEST_DB" | mysql_exec >/dev/null' EXIT
printf "SELECT CONCAT('CREATE TABLE $TEST_DB.',TABLE_NAME,' LIKE ',TABLE_SCHEMA,'.',TABLE_NAME,';') FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE';" | mysql_exec | mysql_exec

sed -e "s/mtrip_m12_s1_test/$TEST_DB/g" -e "s/SCAN_CACHEABLE=true/SCAN_CACHEABLE=false/" \
  "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$CONTAINER" sh -c 'cat > /tmp/M12Bootstrap.php'
docker exec -i "$CONTAINER" sh -c 'cat > /tmp/coupon-release.php' < "$REPO_ROOT/backend/services/order-service/test/coupon-release.php"
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$CONTAINER" php -d display_errors=1 /tmp/coupon-release.php
