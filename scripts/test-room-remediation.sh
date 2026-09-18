#!/usr/bin/env bash
# Disposable schema only: never copies or changes business records.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB=mtrip_room_remediation_test
MYSQL_CONTAINER=mtrip-mysql-1
ROOT_PWD="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)"
mysql_exec() { docker exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --batch --skip-column-names; }
if [ -n "$(printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';" "$TEST_DB" | mysql_exec)" ]; then
  echo "Refusing to replace existing $TEST_DB" >&2; exit 1
fi
printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';' "$TEST_DB" "$TEST_DB" | mysql_exec
trap 'printf "DROP DATABASE IF EXISTS %s;" "$TEST_DB" | mysql_exec >/dev/null' EXIT
printf "SELECT CONCAT('CREATE TABLE $TEST_DB.',TABLE_NAME,' LIKE ',TABLE_SCHEMA,'.',TABLE_NAME,';') FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE';" | mysql_exec | mysql_exec
# The migration is run twice to exercise repeatability.
for pass in 1 2; do
  sed "s/USE mtrip_business;/USE $TEST_DB;/" "$REPO_ROOT/database/migrations/V20260916005000__add-room-content-media.sql" | mysql_exec >/dev/null
done
sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/services/goods-service/test/RoomReviewBootstrap.php" | docker exec -i mtrip-goods-service-1 sh -c 'cat > /tmp/RoomReviewBootstrap.php'
for test in room-review room-list-availability room-content room-media; do
  sed "/declare(strict_types=1);/a\\
 define('BASE_PATH', '/opt/www');" "$REPO_ROOT/backend/services/goods-service/test/$test.php" | docker exec -i mtrip-goods-service-1 sh -c "cat > /tmp/$test.php"
  docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" mtrip-goods-service-1 php "/tmp/$test.php"
done

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/services/goods-service/test/RoomReviewBootstrap.php" | docker exec -i mtrip-order-service-1 sh -c 'cat > /tmp/RoomReviewBootstrap.php'
sed "/declare(strict_types=1);/a\\
 define('BASE_PATH', '/opt/www');" "$REPO_ROOT/backend/services/order-service/test/room-contract.php" | docker exec -i mtrip-order-service-1 sh -c 'cat > /tmp/room-contract.php'
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" mtrip-order-service-1 php /tmp/room-contract.php
