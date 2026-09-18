#!/usr/bin/env bash
# Isolated M4 remediation suite: clones table structures only and never reads or writes business rows.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB=mtrip_booking_remediation_test
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

MIGRATION="$REPO_ROOT/database/migrations/V20260918010000__booking-management-remediation.sql"
if [ -f "$MIGRATION" ]; then
  printf "USE %s; INSERT INTO merchant_notify(site_id,merchant_id,category,title,message,deep_link_type,deep_link_value,channels,send_type,send_at,status) VALUES(991,999999,'booking','Legacy link','Legacy link','booking_detail','/order?notificationTarget=4242','inapp',1,NOW(),1);" "$TEST_DB" | mysql_exec >/dev/null
  for pass in 1 2; do
    sed "s/USE mtrip_business;/USE $TEST_DB;/" "$MIGRATION" | mysql_exec >/dev/null
  done
  normalized="$(printf "USE %s; SELECT deep_link_value FROM merchant_notify WHERE merchant_id=999999;" "$TEST_DB" | mysql_exec)"
  if [ "$normalized" != 4242 ]; then
    echo "Historical booking deep link was not normalized: $normalized" >&2
    exit 1
  fi
fi

status=0
for entry in 'order:booking-remediation.php' 'merchant:booking-notification-scope.php' 'merchant:property-scope.php'; do
  service="${entry%%:*}"
  file="${entry#*:}"
  container="mtrip-$service-service-1"
  if [ "$service" = order ]; then
    for source in \
      app/Constants/BookingConst.php \
      app/Service/Booking/BookingRefundService.php \
      app/Service/Booking/BookingLifecycleService.php \
      app/Service/Booking/BookingNotificationService.php \
      app/Controller/App/OrderController.php \
      app/Controller/Merchant/BookingController.php \
      app/Controller/Merchant/OrderController.php \
      app/Controller/Admin/AdminVerifyController.php \
      app/Controller/Admin/AdminOrderController.php; do
      docker cp "$REPO_ROOT/backend/services/order-service/$source" "$container:/opt/www/$source" >/dev/null
    done
  else
    for source in \
      app/Controller/Merchant/NotificationController.php \
      app/Service/MerchantNotificationService.php; do
      docker cp "$REPO_ROOT/backend/services/merchant-service/$source" "$container:/opt/www/$source" >/dev/null
    done
  fi
  sed -e "s/mtrip_m12_s1_test/$TEST_DB/g" -e "s/SCAN_CACHEABLE=true/SCAN_CACHEABLE=false/" \
    "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$container" sh -c 'cat > /tmp/M12Bootstrap.php'
  docker cp "$REPO_ROOT/backend/services/$service-service/test/$file" "$container:/tmp/$file" >/dev/null
  if ! docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$container" php -d display_errors=1 "/tmp/$file"; then
    status=1
  fi
done

exit "$status"
