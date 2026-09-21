#!/usr/bin/env bash
# Dashboard & Earnings 集成回归(Figma 1306:18423 新增口径)。
# 在隔离库上克隆表结构后运行 order-service / finance-service 两个控制器夹具,不读写业务库。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB=mtrip_dashboard_earnings_test
MYSQL_CONTAINER=mtrip-mysql-1
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

status=0
for entry in 'order:m12-dashboard.php' 'finance:property-earnings.php'; do
  service="${entry%%:*}"
  file="${entry#*:}"
  container="mtrip-$service-service-1"
  sed -e "s/mtrip_m12_s1_test/$TEST_DB/g" -e "s/SCAN_CACHEABLE=true/SCAN_CACHEABLE=false/" \
    "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$container" sh -c 'cat > /tmp/M12Bootstrap.php'
  docker cp "$REPO_ROOT/backend/services/$service-service/test/$file" "$container:/tmp/$file" >/dev/null
  echo "--- $service-service/$file"
  if ! docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$container" php -d display_errors=1 "/tmp/$file"; then
    status=1
  fi
done

exit "$status"
