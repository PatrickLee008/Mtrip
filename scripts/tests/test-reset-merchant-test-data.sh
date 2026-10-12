#!/usr/bin/env bash
# Integration coverage using cloned schemas/data and disposable containers only.
set -euo pipefail
trap 'echo "Test failed at line $LINENO" >&2' ERR
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$($DOCKER exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"
TEST_DB=mtrip_merchant_reset_test
TEST_SYSTEM=mtrip_merchant_reset_system_test
TEST_WRITER="mtrip-reset-test-writer-$$"
TEST_REDIS="mtrip-reset-test-redis-$$"
TEST_PROD="mtrip-reset-test-prod-$$"
TEST_DIR="$(mktemp -d)"
mysql_exec() {
    $DOCKER exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}
sql() { printf '%s\n' "$1" | mysql_exec; }
for db in "$TEST_DB" "$TEST_SYSTEM"; do
    [ "$(sql "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$db';")" = 0 ] \
        || { echo "Refusing existing $db" >&2; exit 1; }
done
cleanup() {
    $DOCKER rm -f "$TEST_WRITER" "$TEST_REDIS" "$TEST_PROD" >/dev/null 2>&1 || true
    sql "DROP DATABASE IF EXISTS $TEST_DB; DROP DATABASE IF EXISTS $TEST_SYSTEM;" >/dev/null
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT
sql "CREATE DATABASE $TEST_DB CHARACTER SET utf8mb4; CREATE DATABASE $TEST_SYSTEM CHARACTER SET utf8mb4;" >/dev/null

# Exclude generated columns while cloning; no writes to either source database.
clone_sql="$(sql "SET SESSION group_concat_max_len=1000000;
SELECT CONCAT('CREATE TABLE ',IF(TABLE_SCHEMA='mtrip_business','$TEST_DB','$TEST_SYSTEM'),'.',TABLE_NAME,' LIKE ',TABLE_SCHEMA,'.',TABLE_NAME,';') FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE';
SELECT CONCAT('INSERT INTO ',IF(TABLE_SCHEMA='mtrip_business','$TEST_DB','$TEST_SYSTEM'),'.',TABLE_NAME,' (',GROUP_CONCAT(CONCAT(CHAR(96),COLUMN_NAME,CHAR(96)) ORDER BY ORDINAL_POSITION),') SELECT ',GROUP_CONCAT(CONCAT(CHAR(96),COLUMN_NAME,CHAR(96)) ORDER BY ORDINAL_POSITION),' FROM ',TABLE_SCHEMA,'.',TABLE_NAME,';') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND EXTRA NOT LIKE '%STORED GENERATED%' AND EXTRA NOT LIKE '%VIRTUAL GENERATED%' GROUP BY TABLE_SCHEMA,TABLE_NAME;")"
printf '%s\n' "$clone_sql" | mysql_exec
sql "USE $TEST_DB;
INSERT INTO merchant_group(id,group_name,contact_name,contact_phone) VALUES(900000,'keep-group','Tester','test');
INSERT INTO merchant_admin(id,account_type,merchant_id,group_id,username,password) VALUES(900000,1,0,900000,'reset-keep-group','test'),(900001,3,0,0,'reset-orphan-store','test');
INSERT INTO merchant_role(id,account_type,group_id,is_builtin,role_name) VALUES(900000,1,900000,0,'keep-group-role'),(900001,2,0,1,'keep-builtin'),(900002,2,0,0,'remove-orphan-role');
INSERT INTO merchant_role_menu(role_id,menu_id) VALUES(900000,100),(900001,100),(900002,100);
INSERT INTO merchant_admin_role(admin_id,role_id) VALUES(900000,900000),(900001,900002);
INSERT INTO merchant_auth_challenge(account_id,purpose,method,token_hash,expires_at) VALUES(900000,'login','email',REPEAT('a',64),NOW()),(900001,'login','email',REPEAT('b',64),NOW());
INSERT INTO goods_info(id,merchant_id,supplier_id,goods_type,goods_name) VALUES(900000,0,900000,2,'keep-supplier-ticket'),(900001,999999,0,2,'remove-orphan-merchant-ticket');
INSERT INTO ticket_type(id,goods_id,ticket_name) VALUES(900000,900000,'keep-ticket'),(900001,900001,'remove-ticket');
INSERT INTO hotel_room_type(id,property_id,room_name) VALUES(900000,900000,'remove-orphan-room');
INSERT INTO order_trip(id,trip_no) VALUES(900010,'keep-supplier-trip'),(900012,'remove-merchant-trip');
INSERT INTO order_main(id,order_no,merchant_id,supplier_id,goods_id,trip_id,goods_name,sku_name,contact_name,contact_phone,coupon_id) VALUES(900010,'reset-remove-order',999999,0,900001,0,'test','test','test','test',900010),(900011,'reset-keep-trip-order',0,900000,900000,900010,'test','test','test','test',0),(900012,'reset-keep-order',0,900000,900000,0,'test','test','test','test',0),(900013,'reset-remove-trip-order',999999,0,900001,900012,'test','test','test','test',0);
INSERT INTO user_balance_log(user_id,order_id,change_type,remark) VALUES(900000,900010,2,'行程 keep-supplier-trip 钱包支付'),(900000,900010,2,'订单 reset-remove-order 钱包支付'),(900000,900012,2,'订单 reset-keep-order 钱包支付'),(900000,900012,2,'行程 remove-merchant-trip 钱包支付');
INSERT INTO finance_flow(flow_no,order_id,merchant_id) VALUES('reset-keep-flow',900012,0),('reset-remove-flow',900010,999999);
INSERT INTO marketing_coupon(id,merchant_id,coupon_name,received_count,used_count) VALUES(900000,0,'keep-platform-coupon',2,1),(900001,999999,'remove-orphan-coupon',0,0);
INSERT INTO marketing_coupon(id,merchant_id,coupon_name,goods_scope,sku_ids) VALUES(900002,0,'keep-supplier-ticket-coupon',2,JSON_ARRAY(900000));
INSERT INTO marketing_coupon_receive(id,coupon_id,user_id,coupon_code,status) VALUES(900010,900000,900000,'reset-remove-receive',1),(900011,900000,900000,'reset-keep-receive',0);
INSERT INTO marketing_campaign(id,title,coupon_ids) VALUES(900000,'keep-campaign',JSON_ARRAY(900000,900001));
INSERT INTO chat_conversation(id,user_id,type,target_id,order_id) VALUES(900000,900000,2,0,0),(900001,900000,1,900001,900010);
INSERT INTO chat_message(conversation_id,content) VALUES(900000,'keep-support'),(900001,'remove-merchant-chat');
INSERT INTO user_favorite(user_id,goods_id) VALUES(900000,900000),(900000,900001);
INSERT INTO $TEST_SYSTEM.sys_email_log(scene) VALUES('customer_login'),('merchant_register');
INSERT INTO $TEST_SYSTEM.sys_sms_log(scene) VALUES('admin_channel_test'),('merchant_activation');" >/dev/null

writer_image="$($DOCKER inspect --format '{{.Config.Image}}' mtrip-merchant-service-1)"
redis_image="$($DOCKER inspect --format '{{.Config.Image}}' mtrip-redis-1)"
$DOCKER run -d --name "$TEST_REDIS" "$redis_image" >/dev/null
$DOCKER run -d --name "$TEST_WRITER" --entrypoint sh -e APP_ENV=test \
    -e "DB_BUSINESS_DATABASE=$TEST_DB" -e "DB_SYSTEM_DATABASE=$TEST_SYSTEM" -e REDIS_DB=0 \
    "$writer_image" -c 'while :; do sleep 1; done' >/dev/null
for attempt in 1 2 3 4 5; do
    if [ "$($DOCKER exec "$TEST_REDIS" redis-cli PING 2>/dev/null || true)" = PONG ]; then break; fi
    sleep 1
done
$DOCKER exec "$TEST_REDIS" redis-cli MSET \
    mtrip:merchant:registration:otp:test otp \
    mtrip:merchant:2fa:pairing:removed '{"adminId":900001}' \
    mtrip:merchant:2fa:pairing:group '{"adminId":900000}' \
    customer:keep yes >/dev/null
run_reset() {
    DB_BUSINESS_DATABASE="$TEST_DB" DB_SYSTEM_DATABASE="$TEST_SYSTEM" REDIS_CONTAINER="$TEST_REDIS" GATEWAY_CONTAINER="$TEST_WRITER-gateway" \
        BACKUP_DIR="${TEST_BACKUP_DIR:-$TEST_DIR/backups}" bash "$REPO_ROOT/scripts/reset-merchant-test-data.sh" "$@"
}
expect_failure() {
    if run_reset "$@" > "$TEST_DIR/failure.log" 2>&1; then echo 'Expected rejection' >&2; exit 1; fi
}
assert_sql() {
    [ "$(sql "USE $TEST_DB; $1")" = "$2" ] || { echo "Assertion failed: $1" >&2; exit 1; }
}
preserved_checksums() {
    sql "CHECKSUM TABLE $TEST_DB.user_info,$TEST_DB.merchant_group,$TEST_DB.merchant_menu,$TEST_DB.merchant_kyc_template,$TEST_DB.merchant_onboarding_agreement,$TEST_DB.merchant_code_sequence,$TEST_DB.supplier_info,$TEST_DB.ranking_destination,$TEST_SYSTEM.sys_admin,$TEST_SYSTEM.sys_sms_channel,$TEST_SYSTEM.sys_email_channel,$TEST_SYSTEM.sys_pay_channel,$TEST_SYSTEM.schema_migrations;"
}
preserved_checksums > "$TEST_DIR/before"
run_reset --dry-run > "$TEST_DIR/preview"
assert_sql 'SELECT COUNT(*)>0 FROM merchant_info;' 1
[ "$($DOCKER inspect --format '{{.State.Running}}' "$TEST_WRITER")" = true ]
[ ! -d "$TEST_DIR/backups" ]
echo 'PASS preview leaves data/services unchanged'
expect_failure --execute
echo 'PASS explicit confirmation required'

$DOCKER run -d --name "$TEST_PROD" --entrypoint sh -e APP_ENV=prod \
    -e "DB_BUSINESS_DATABASE=$TEST_DB" -e "DB_SYSTEM_DATABASE=$TEST_SYSTEM" \
    "$writer_image" -c 'while :; do sleep 1; done' >/dev/null
expect_failure --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA
rg -q 'APP_ENV=prod' "$TEST_DIR/failure.log"
$DOCKER rm -f "$TEST_PROD" >/dev/null
echo 'PASS actual production writer rejected'

sql "CREATE TABLE $TEST_DB.merchant_unmapped_test(id BIGINT);" >/dev/null
expect_failure --dry-run
rg -q 'Unmapped merchant tables' "$TEST_DIR/failure.log"
sql "DROP TABLE $TEST_DB.merchant_unmapped_test;" >/dev/null
echo 'PASS unknown merchant table rejected'

sql "UPDATE $TEST_DB.order_main SET trip_id=900012 WHERE id=900012;" >/dev/null
expect_failure --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA
assert_sql 'SELECT COUNT(*) FROM order_main WHERE id=900012;' 1
sql "UPDATE $TEST_DB.order_main SET trip_id=0 WHERE id=900012;" >/dev/null
echo 'PASS mixed trip rejected before deletion'

printf 'not a directory\n' > "$TEST_DIR/backup-blocker"
TEST_BACKUP_DIR="$TEST_DIR/backup-blocker" expect_failure --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA
assert_sql 'SELECT COUNT(*) FROM order_main WHERE id=900010;' 1
[ "$($DOCKER inspect --format '{{.State.Running}}' "$TEST_WRITER")" = true ]
echo 'PASS backup failure prevents deletion and restores writer'

sql "CREATE TRIGGER $TEST_DB.reset_fail BEFORE DELETE ON $TEST_DB.merchant_info FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rollback';" >/dev/null
expect_failure --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA
assert_sql 'SELECT COUNT(*) FROM order_main WHERE id=900010;' 1
assert_sql 'SELECT COUNT(*) FROM merchant_admin WHERE id=900001;' 1
[ "$($DOCKER inspect --format '{{.State.Running}}' "$TEST_WRITER")" = true ]
sql "DROP TRIGGER $TEST_DB.reset_fail;" >/dev/null
echo 'PASS late SQL failure rolls back and restores writer'

run_reset --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA > "$TEST_DIR/execute"
assert_sql 'SELECT COUNT(*) FROM merchant_info;' 0
assert_sql 'SELECT COUNT(*) FROM merchant_application;' 0
assert_sql 'SELECT COUNT(*) FROM merchant_store;' 0
assert_sql 'SELECT COUNT(*) FROM merchant_verify_document;' 0
assert_sql 'SELECT COUNT(*) FROM merchant_admin WHERE id IN(900000,900001);' 1
assert_sql 'SELECT COUNT(*) FROM merchant_role WHERE id IN(900000,900001,900002);' 2
assert_sql 'SELECT COUNT(*) FROM merchant_admin_role WHERE admin_id=900000;' 1
assert_sql 'SELECT COUNT(*) FROM merchant_role_menu WHERE role_id IN(900000,900001);' 2
assert_sql 'SELECT COUNT(*) FROM merchant_auth_challenge WHERE account_id=900000;' 1
assert_sql 'SELECT COUNT(*) FROM goods_info WHERE id IN(900000,900001);' 1
assert_sql 'SELECT COUNT(*) FROM ticket_type WHERE goods_id IN(900000,900001);' 1
assert_sql 'SELECT COUNT(*) FROM order_main;' 2
assert_sql 'SELECT COUNT(*) FROM order_trip;' 1
assert_sql 'SELECT COUNT(*) FROM finance_flow WHERE flow_no IN("reset-keep-flow","reset-remove-flow");' 1
assert_sql 'SELECT COUNT(*) FROM user_balance_log WHERE order_id IN(900010,900012);' 2
assert_sql "SELECT COUNT(*) FROM user_balance_log WHERE remark IN ('行程 keep-supplier-trip 钱包支付','订单 reset-keep-order 钱包支付');" 2
assert_sql 'SELECT CONCAT(received_count,":",used_count) FROM marketing_coupon WHERE id=900000;' '1:0'
assert_sql 'SELECT COUNT(*) FROM marketing_coupon WHERE id=900002;' 1
assert_sql 'SELECT coupon_ids FROM marketing_campaign WHERE id=900000;' '[900000]'
assert_sql 'SELECT COUNT(*) FROM chat_message WHERE content IN("keep-support","remove-merchant-chat");' 1
assert_sql 'SELECT COUNT(*) FROM user_favorite WHERE user_id=900000;' 1
assert_sql "SELECT COUNT(*) FROM $TEST_SYSTEM.sys_email_log WHERE LEFT(scene,9)='merchant_';" 0
assert_sql "SELECT COUNT(*) FROM $TEST_SYSTEM.sys_email_log WHERE scene='customer_login';" 1
assert_sql "SELECT COUNT(*) FROM $TEST_SYSTEM.sys_sms_log WHERE scene='admin_channel_test';" 1
preserved_checksums > "$TEST_DIR/after"
diff -u "$TEST_DIR/before" "$TEST_DIR/after"
[ "$($DOCKER exec "$TEST_REDIS" redis-cli EXISTS mtrip:merchant:registration:otp:test mtrip:merchant:2fa:pairing:removed)" = 0 ]
[ "$($DOCKER exec "$TEST_REDIS" redis-cli EXISTS mtrip:merchant:2fa:pairing:group customer:keep)" = 2 ]
[ "$($DOCKER inspect --format '{{.State.Running}}' "$TEST_WRITER")" = true ]
for backup in "$TEST_DIR"/backups/*.sql.gz; do gzip -t "$backup"; done
echo 'PASS cleanup, preservation, selective Redis, backup, and service restoration'
run_reset --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA > "$TEST_DIR/repeat"
assert_sql 'SELECT COUNT(*) FROM order_main;' 2
assert_sql 'SELECT CONCAT(received_count,":",used_count) FROM marketing_coupon WHERE id=900000;' '1:0'
echo 'PASS repeated execution is idempotent'
