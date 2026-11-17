#!/usr/bin/env bash
# Only empty schema clones; never fixtures or migration writes against main databases.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_DB="mtrip_commercial_settings_test"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
SERVICE_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
ORDER_CONTAINER="${ORDER_SERVICE_CONTAINER:-mtrip-order-service-1}"
MARKETING_CONTAINER="${MARKETING_SERVICE_CONTAINER:-mtrip-marketing-service-1}"
ROOT_PWD="$(docker exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)"
mysql_exec() {
  docker exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}
if printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';\n" "$TEST_DB" | mysql_exec | rg -q .; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi
# Acquire ownership atomically before registering cleanup: a racing CREATE must never drop another run's DB.
printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;\n' "$TEST_DB" | mysql_exec
cleanup() { printf 'DROP DATABASE IF EXISTS `%s`;\n' "$TEST_DB" | mysql_exec >/dev/null; }
trap cleanup EXIT
printf 'GRANT ALL PRIVILEGES ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';\n' "$TEST_DB" | mysql_exec
for table in merchant_info merchant_activity_log order_main order_booking_event goods_daily_stock goods_stock_log merchant_application merchant_application_business merchant_admin merchant_blacklist merchant_store merchant_account merchant_module_grant hotel_room_type; do
  printf 'CREATE TABLE `%s`.`%s` LIKE mtrip_business.`%s`;\n' "$TEST_DB" "$table" "$table" | mysql_exec
done
for table in sys_site sys_site_config; do
  printf 'CREATE TABLE `%s`.`%s` LIKE mtrip_system.`%s`;\n' "$TEST_DB" "$table" "$table" | mysql_exec
done
# Explicit database substitution covers USE and information_schema guards; no main DB target reaches mysql.
for pass in 1 2; do
  sed "s/mtrip_business/$TEST_DB/g" "$REPO_ROOT/database/migrations/V20261117100000__merchant-commercial-settings.sql" | mysql_exec >/dev/null
done
sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/M12CommercialBootstrap.php'
sed 's/class MerchantController extends/class CommercialMerchantController extends/' "$REPO_ROOT/backend/services/merchant-service/app/Controller/Admin/MerchantController.php" | docker exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/CommercialMerchantController.php'
docker cp "$REPO_ROOT/backend/services/merchant-service/test/commercial-settings.php" "$SERVICE_CONTAINER:/tmp/commercial-settings.php"
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/commercial-settings.php

sed -e "s@require __DIR__ . '/M12Bootstrap.php';@require '/tmp/M12CommercialBootstrap.php'; require '/tmp/CommercialMerchantController.php';@" -e 's/use App\\Controller\\Admin\\MerchantController;/use App\\Controller\\Admin\\CommercialMerchantController as MerchantController;/' "$REPO_ROOT/backend/services/merchant-service/test/m12-directory-ui.php" | docker exec -i "$SERVICE_CONTAINER" sh -c 'cat > /tmp/commercial-directory-ui.php'
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$SERVICE_CONTAINER" php -d display_errors=1 /tmp/commercial-directory-ui.php

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$ORDER_CONTAINER" sh -c 'cat > /tmp/M12CommercialBootstrap.php'
sed 's/class PaymentResultHandler/class CommercialPaymentResultHandler/' "$REPO_ROOT/backend/services/order-service/app/Service/PaymentResultHandler.php" | docker exec -i "$ORDER_CONTAINER" sh -c 'cat > /tmp/CommercialPaymentResultHandler.php'
sed 's/class BookingLifecycleService/class CommercialBookingLifecycleService/' "$REPO_ROOT/backend/services/order-service/app/Service/Booking/BookingLifecycleService.php" | docker exec -i "$ORDER_CONTAINER" sh -c 'cat > /tmp/CommercialBookingLifecycleService.php'
sed 's/class OrderController extends/class CommercialOrderController extends/' "$REPO_ROOT/backend/services/order-service/app/Controller/App/OrderController.php" | docker exec -i "$ORDER_CONTAINER" sh -c 'cat > /tmp/CommercialOrderController.php'
docker cp "$REPO_ROOT/backend/services/order-service/test/commercial-snapshots.php" "$ORDER_CONTAINER:/tmp/commercial-snapshots.php"
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$ORDER_CONTAINER" php -d display_errors=1 /tmp/commercial-snapshots.php

sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" | docker exec -i "$MARKETING_CONTAINER" sh -c 'cat > /tmp/M12CommercialBootstrap.php'
sed 's/class PromotionController extends/class CommercialPromotionController extends/' "$REPO_ROOT/backend/services/marketing-service/app/Controller/Merchant/PromotionController.php" | docker exec -i "$MARKETING_CONTAINER" sh -c 'cat > /tmp/CommercialPromotionController.php'
docker cp "$REPO_ROOT/backend/services/marketing-service/test/commercial-commission-readers.php" "$MARKETING_CONTAINER:/tmp/commercial-commission-readers.php"
docker exec -e DB_BUSINESS_DATABASE="$TEST_DB" -e DB_SYSTEM_DATABASE="$TEST_DB" "$MARKETING_CONTAINER" php -d display_errors=1 /tmp/commercial-commission-readers.php
