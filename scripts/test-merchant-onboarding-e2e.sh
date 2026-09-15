#!/usr/bin/env bash
# Runs the complete stage 7 onboarding-to-consumer chain in one disposable database.

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
MERCHANT_CONTAINER="${MERCHANT_SERVICE_CONTAINER:-mtrip-merchant-service-1}"
GOODS_CONTAINER="${GOODS_SERVICE_CONTAINER:-mtrip-goods-service-1}"
USER_CONTAINER="${USER_SERVICE_CONTAINER:-mtrip-user-service-1}"
TEST_DB="mtrip_onboarding_e2e_test"
STAGE7_KEY="$(date +%s)$(printf '%05d' "$RANDOM")"

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

if printf "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='%s';\n" "$TEST_DB" | mysql_exec | rg -q .; then
  echo "Refusing to replace existing $TEST_DB" >&2
  exit 1
fi

printf 'CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL PRIVILEGES ON `%s`.* TO '\''mtrip'\''@'\''%%'\'';\n' "$TEST_DB" "$TEST_DB" | mysql_exec
create_sql="$(cat <<SQL | mysql_exec
SET SESSION group_concat_max_len=1000000;
SELECT CONCAT('CREATE TABLE IF NOT EXISTS ',CHAR(96),'$TEST_DB',CHAR(96),'.',CHAR(96),TABLE_NAME,CHAR(96),' LIKE ',CHAR(96),TABLE_SCHEMA,CHAR(96),'.',CHAR(96),TABLE_NAME,CHAR(96),';')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE'
ORDER BY TABLE_SCHEMA,TABLE_NAME;
SQL
)"
printf '%s\n' "$create_sql" | mysql_exec

for container in "$MERCHANT_CONTAINER" "$GOODS_CONTAINER" "$USER_CONTAINER"; do
  sed "s/mtrip_m12_s1_test/$TEST_DB/g" "$REPO_ROOT/backend/shared/tests/integration/M12Bootstrap.php" \
    | $DOCKER exec -i "$container" sh -c 'cat > /tmp/M12Bootstrap.php'
done

$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-e2e.php" "$MERCHANT_CONTAINER:/tmp/onboarding-e2e.php"
$DOCKER cp "$REPO_ROOT/backend/services/merchant-service/test/onboarding-final-approval-worker.php" "$MERCHANT_CONTAINER:/tmp/onboarding-final-approval-worker.php"
$DOCKER cp "$REPO_ROOT/backend/services/goods-service/test/onboarding-e2e.php" "$GOODS_CONTAINER:/tmp/onboarding-e2e.php"
$DOCKER cp "$REPO_ROOT/backend/services/user-service/test/onboarding-e2e.php" "$USER_CONTAINER:/tmp/onboarding-e2e.php"

for target in \
  "$MERCHANT_CONTAINER:/tmp/onboarding-e2e.php" \
  "$MERCHANT_CONTAINER:/tmp/onboarding-final-approval-worker.php" \
  "$GOODS_CONTAINER:/tmp/onboarding-e2e.php" \
  "$USER_CONTAINER:/tmp/onboarding-e2e.php"; do
  container="${target%%:*}"
  path="${target#*:}"
  $DOCKER exec "$container" php -l "$path"
done

run_stage7() {
  local container="$1"
  local mode="$2"
  $DOCKER exec \
    -e DB_BUSINESS_DATABASE="$TEST_DB" \
    -e DB_SYSTEM_DATABASE="$TEST_DB" \
    -e MTRIP_STAGE7_E2E=1 \
    -e MTRIP_STAGE7_KEY="$STAGE7_KEY" \
    "$container" php -d display_errors=1 /tmp/onboarding-e2e.php "$mode"
}

run_stage7 "$MERCHANT_CONTAINER" start
run_stage7 "$GOODS_CONTAINER" room
run_stage7 "$MERCHANT_CONTAINER" publish
run_stage7 "$GOODS_CONTAINER" visible
run_stage7 "$USER_CONTAINER" visible
run_stage7 "$MERCHANT_CONTAINER" suspend
run_stage7 "$GOODS_CONTAINER" hidden
run_stage7 "$MERCHANT_CONTAINER" activate
run_stage7 "$GOODS_CONTAINER" visible
run_stage7 "$MERCHANT_CONTAINER" offline
run_stage7 "$GOODS_CONTAINER" hidden
run_stage7 "$USER_CONTAINER" hidden
run_stage7 "$MERCHANT_CONTAINER" publish
run_stage7 "$GOODS_CONTAINER" visible

echo "Stage 7 onboarding-to-consumer E2E passed with key $STAGE7_KEY"
