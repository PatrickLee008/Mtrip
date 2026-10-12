#!/usr/bin/env bash
# Preview or reset all merchant/onboarding test data in the Docker dev stack.
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
DOCKER="${DOCKER:-docker}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-mtrip-redis-1}"
GATEWAY_CONTAINER="${GATEWAY_CONTAINER:-mtrip-gateway-1}"
BUSINESS_DB="${DB_BUSINESS_DATABASE:-mtrip_business}"
SYSTEM_DB="${DB_SYSTEM_DATABASE:-mtrip_system}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/deploy/backups}"
MODE=preview
CONFIRM=""
while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) MODE=preview; shift ;;
        --execute) MODE=execute; shift ;;
        --confirm) CONFIRM="${2:-}"; [ $# -ge 2 ] || exit 2; shift 2 ;;
        -h|--help)
            cat <<'HELP'
Preview: bash scripts/reset-merchant-test-data.sh
Execute: bash scripts/reset-merchant-test-data.sh --execute --confirm DELETE_ALL_MERCHANT_TEST_DATA

All sites, including soft-deleted records. Requires the current migrated schema.
Execution pauses running containers connected to either target database, backs up
both databases, deletes in one transaction, clears registration OTPs and removed
accounts' pairing codes, then restarts only those containers.
Keeps platform/admin/customer/supplier/group accounts, built-in roles, templates,
channels, shared storage files, wallet balances/points, and ID/code sequences.
Does not refund payments or delete files from disk/object storage.
ENV: MYSQL_CONTAINER, MYSQL_ROOT_PASSWORD, REDIS_CONTAINER, DB_BUSINESS_DATABASE,
DB_SYSTEM_DATABASE, GATEWAY_CONTAINER, BACKUP_DIR, DOCKER (default: docker).
HELP
            exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 2 ;;
    esac
done
fail() { echo "[FAIL] $*" >&2; exit 1; }
for db in "$BUSINESS_DB" "$SYSTEM_DB"; do
    [[ "$db" =~ ^[A-Za-z0-9_]+$ ]] || fail "Invalid database name"
done
[ "$BUSINESS_DB" != "$SYSTEM_DB" ] || fail "Business and system databases must be different"
if [ "$MODE" = execute ]; then
    [ "$CONFIRM" = DELETE_ALL_MERCHANT_TEST_DATA ] || fail "Use --confirm DELETE_ALL_MERCHANT_TEST_DATA"
fi

$DOCKER ps >/dev/null
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$($DOCKER exec "$MYSQL_CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"
mysql_exec() {
    $DOCKER exec -i -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" \
        mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw
}

# Read the actual writer environments; never trust a caller-supplied APP_ENV.
WRITERS=()
REFRESH_GATEWAY=0
gateway_project="$($DOCKER inspect --format '{{if .State.Running}}{{index .Config.Labels "com.docker.compose.project"}}{{end}}' "$GATEWAY_CONTAINER" 2>/dev/null || true)"
gateway_project="${gateway_project#<no value>}"
REDIS_DB=""
REDIS_AUTH=""
for container in $($DOCKER ps --format '{{.Names}}'); do
    settings="$($DOCKER inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container")"
    writer_business="$(printf '%s\n' "$settings" | sed -n 's/^DB_BUSINESS_DATABASE=//p')"
    writer_system="$(printf '%s\n' "$settings" | sed -n 's/^DB_SYSTEM_DATABASE=//p')"
    if [ "$writer_business" != "$BUSINESS_DB" ] && [ "$writer_system" != "$SYSTEM_DB" ]; then continue; fi
    app_env="$(printf '%s\n' "$settings" | sed -n 's/^APP_ENV=//p')"
    case "$app_env" in dev|local|test|testing) ;; *) fail "Refusing $container: APP_ENV=$app_env" ;; esac
    # Partial matches could pause another stack while leaving its data inconsistent.
    [ "$writer_business" = "$BUSINESS_DB" ] && [ "$writer_system" = "$SYSTEM_DB" ] \
        || fail "Database pair mismatch in $container"
    WRITERS+=("$container")
    if [ -n "$gateway_project" ] && [ "$($DOCKER inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")" = "$gateway_project" ]; then
        REFRESH_GATEWAY=1
    fi
    current_redis_db="$(printf '%s\n' "$settings" | sed -n 's/^REDIS_DB=//p')"
    current_redis_db="${current_redis_db:-0}"
    current_redis_auth="$(printf '%s\n' "$settings" | sed -n 's/^REDIS_AUTH=//p')"
    [ -z "$REDIS_DB" ] || [ "$REDIS_DB" = "$current_redis_db" ] || fail "Redis DB mismatch"
    [ -z "$REDIS_DB" ] || [ "$REDIS_AUTH" = "$current_redis_auth" ] || fail "Redis auth mismatch"
    REDIS_DB="$current_redis_db"
    REDIS_AUTH="$current_redis_auth"
done
[ ${#WRITERS[@]} -gt 0 ] || fail "No running dev/test writer found; start the target stack first"
[[ "$REDIS_DB" =~ ^[0-9]+$ ]] || fail "Invalid Redis DB"
redis_exec() {
    if [ -n "$REDIS_AUTH" ]; then
        $DOCKER exec -e "REDISCLI_AUTH=$REDIS_AUTH" "$REDIS_CONTAINER" redis-cli -n "$REDIS_DB" --raw "$@"
    else
        $DOCKER exec "$REDIS_CONTAINER" redis-cli -n "$REDIS_DB" --raw "$@"
    fi
}
[ "$(redis_exec PING)" = PONG ] || fail "Cannot connect to Redis"

WORK_DIR="$(mktemp -d)"
STOPPED=()
cleanup() {
    local status=$?
    trap - EXIT
    if [ ${#STOPPED[@]} -gt 0 ]; then
        echo "Restoring previously running containers..."
        $DOCKER start "${STOPPED[@]}" || status=1
        if [ "$REFRESH_GATEWAY" = 1 ]; then
            $DOCKER exec "$GATEWAY_CONTAINER" /usr/local/openresty/nginx/sbin/nginx -s reload || status=1
        fi
    fi
    rm -rf "$WORK_DIR"
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Explicit table/predicate manifest, ordered children before parents.
cat > "$WORK_DIR/plan" <<'PLAN'
merchant_notify_read|notify_id IN (SELECT id FROM reset_notifies) OR account_id IN (SELECT id FROM reset_admins)
merchant_notify_delivery|notify_id IN (SELECT id FROM reset_notifies)
merchant_admin_role|admin_id IN (SELECT id FROM reset_admins) OR role_id IN (SELECT id FROM reset_roles)
merchant_role_menu|role_id IN (SELECT id FROM reset_roles)
merchant_employee_property|admin_id IN (SELECT id FROM reset_admins) OR property_id>0
merchant_auth_challenge|account_id IN (SELECT id FROM reset_admins)
merchant_credential_delivery|1=1
merchant_impersonation_session|merchant_id>0 OR target_account_id IN (SELECT id FROM reset_admins)
merchant_document_event|1=1
merchant_verify_document_revision|1=1
merchant_verify_document|1=1
merchant_verify_timeline|1=1
merchant_application_note|1=1
merchant_application_signature|1=1
merchant_application_business|1=1
merchant_application|1=1
merchant_property_kyc_event|1=1
merchant_property_content_revision|1=1
merchant_property_history|1=1
merchant_access_code_log|merchant_id>0
merchant_activity_log|merchant_id>0 OR target_account_id IN (SELECT id FROM reset_admins) OR (actor_type='merchant' AND performed_by_id IN (SELECT id FROM reset_actors))
merchant_notify|id IN (SELECT id FROM reset_notifies)
compliance_history|merchant_id>0
merchant_warning|merchant_id>0
merchant_violation|merchant_id>0
merchant_status_history|merchant_id>0
merchant_blacklist|merchant_id>0
merchant_account|merchant_id>0
merchant_module_grant|merchant_id>0
merchant_store_goods|merchant_id>0 OR store_id>0 OR goods_id IN (SELECT id FROM reset_goods)
chat_message|conversation_id IN (SELECT id FROM reset_conversations)
chat_conversation|id IN (SELECT id FROM reset_conversations)
notify_record|biz_type=1 AND biz_id IN (SELECT id FROM reset_orders)
order_sync_log|order_id IN (SELECT id FROM reset_orders)
order_sync_task|merchant_id>0 OR order_id IN (SELECT id FROM reset_orders)
order_booking_event|merchant_id>0 OR order_id IN (SELECT id FROM reset_orders)
order_internal_note|merchant_id>0 OR order_id IN (SELECT id FROM reset_orders)
order_verify_log|merchant_id>0 OR order_id IN (SELECT id FROM reset_orders)
order_refund|merchant_id>0 OR property_id>0 OR order_id IN (SELECT id FROM reset_orders)
finance_account_entry|merchant_id>0 OR property_id>0 OR order_id IN (SELECT id FROM reset_orders)
finance_flow|merchant_id>0 OR property_id>0 OR order_id IN (SELECT id FROM reset_orders)
finance_merchant_settle|merchant_id>0 OR property_id>0
finance_withdraw|merchant_id>0
user_balance_log|(change_type=2 AND remark LIKE '行程 %' AND order_id IN (SELECT id FROM reset_trips)) OR ((change_type<>2 OR remark NOT LIKE '行程 %') AND order_id IN (SELECT id FROM reset_orders))
user_points_log|order_id IN (SELECT id FROM reset_orders)
user_feedback|order_id IN (SELECT id FROM reset_orders)
user_referral|reward_order_id IN (SELECT id FROM reset_orders)
affiliate_commission_log|order_id IN (SELECT id FROM reset_orders)
order_main|id IN (SELECT id FROM reset_orders)
order_trip|id IN (SELECT id FROM reset_trips)
goods_stock_log|property_id>0 OR goods_id IN (SELECT id FROM reset_goods) OR order_id IN (SELECT id FROM reset_orders)
goods_review|property_id>0 OR goods_id IN (SELECT id FROM reset_goods) OR order_id IN (SELECT id FROM reset_orders)
goods_daily_stock|property_id>0 OR goods_id IN (SELECT id FROM reset_goods)
goods_refund_rule|property_id>0 OR goods_id IN (SELECT id FROM reset_goods)
user_favorite|property_id>0 OR goods_id IN (SELECT id FROM reset_goods)
hotel_room_type_revision|1=1
hotel_room_media|1=1
hotel_room_type|1=1
hotel_property_legacy_map|1=1
hotel_goods_archive|merchant_id>0
ticket_type|goods_id IN (SELECT id FROM reset_goods)
supplier_goods|goods_id IN (SELECT id FROM reset_goods)
marketing_activity_goods|property_id>0 OR goods_id IN (SELECT id FROM reset_goods) OR room_type_id IN (SELECT id FROM reset_rooms)
marketing_promo_code_redeem|promo_code_id IN (SELECT id FROM reset_promos) OR coupon_id IN (SELECT id FROM reset_coupons) OR receive_id IN (SELECT id FROM reset_receives)
marketing_promo_code|id IN (SELECT id FROM reset_promos)
marketing_promotion_impression|coupon_id IN (SELECT id FROM reset_coupons)
marketing_coupon_receive|id IN (SELECT id FROM reset_receives)
marketing_coupon|id IN (SELECT id FROM reset_coupons)
marketing_campaign_participant|merchant_id>0
ranking_history|entity_type='listing'
ranking_listing|1=1
ranking_market|entity_type='listing'
verify_device|merchant_id>0
goods_info|id IN (SELECT id FROM reset_goods)
merchant_role|id IN (SELECT id FROM reset_roles)
merchant_admin|id IN (SELECT id FROM reset_admins)
merchant_store|1=1
merchant_info|1=1
PLAN

# Refuse new merchant tables until their ownership and cleanup rules are reviewed.
known="'merchant_menu','merchant_group','merchant_kyc_template','merchant_onboarding_agreement','merchant_code_sequence','merchant_email_identity_lock'"
while IFS='|' read -r table predicate; do known="$known,'$table'"; done < "$WORK_DIR/plan"
unknown="$(printf "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='%s' AND TABLE_NAME LIKE 'merchant\\_%%' AND TABLE_NAME NOT IN (%s);\n" "$BUSINESS_DB" "$known" | mysql_exec)"
[ -z "$unknown" ] || fail "Unmapped merchant tables: $unknown"

build_sql() {
    cat <<SQL
SET NAMES utf8mb4;
USE \`$BUSINESS_DB\`;
START TRANSACTION;
CREATE TEMPORARY TABLE reset_admins AS SELECT id FROM merchant_admin WHERE merchant_id>0 OR account_type IN (2,3) OR store_id>0;
CREATE TEMPORARY TABLE reset_actors AS SELECT id FROM reset_admins;
CREATE TEMPORARY TABLE reset_roles AS SELECT id FROM merchant_role WHERE is_builtin=0 AND (merchant_id>0 OR account_type IN (2,3));
CREATE TEMPORARY TABLE reset_rooms AS SELECT id FROM hotel_room_type;
CREATE TEMPORARY TABLE reset_goods AS SELECT id FROM goods_info WHERE merchant_id>0 UNION SELECT id FROM hotel_goods_archive WHERE merchant_id>0 UNION SELECT goods_id FROM hotel_property_legacy_map;
CREATE TEMPORARY TABLE reset_tickets AS SELECT id FROM ticket_type WHERE goods_id IN (SELECT id FROM reset_goods);
CREATE TEMPORARY TABLE reset_orders AS SELECT id FROM order_main WHERE merchant_id>0 OR property_id>0 OR goods_id IN (SELECT id FROM reset_goods);
CREATE TEMPORARY TABLE reset_trips AS SELECT DISTINCT trip_id AS id FROM order_main WHERE id IN (SELECT id FROM reset_orders) AND trip_id>0;
-- Mixed trips must be reviewed rather than deleting unrelated supplier orders.
CREATE TEMPORARY TABLE reset_guard (unrelated_orders BIGINT CHECK (unrelated_orders=0));
INSERT INTO reset_guard SELECT COUNT(*) FROM order_main WHERE trip_id IN (SELECT id FROM reset_trips) AND id NOT IN (SELECT id FROM reset_orders);
SET @reset_goods=(SELECT COALESCE(JSON_ARRAYAGG(id),JSON_ARRAY()) FROM reset_goods);
SET @reset_rooms=(SELECT COALESCE(JSON_ARRAYAGG(id),JSON_ARRAY()) FROM reset_rooms);
SET @reset_tickets=(SELECT COALESCE(JSON_ARRAYAGG(id),JSON_ARRAY()) FROM reset_tickets);
CREATE TEMPORARY TABLE reset_coupons AS SELECT id FROM marketing_coupon WHERE merchant_id>0 OR created_by_merchant_admin IN (SELECT id FROM reset_admins) OR COALESCE(JSON_LENGTH(property_ids),0)>0 OR JSON_OVERLAPS(goods_ids,@reset_goods) OR JSON_OVERLAPS(room_type_ids,@reset_rooms) OR JSON_OVERLAPS(sku_ids,@reset_tickets);
SET @reset_coupons=(SELECT COALESCE(JSON_ARRAYAGG(id),JSON_ARRAY()) FROM reset_coupons);
CREATE TEMPORARY TABLE reset_receives AS SELECT id FROM marketing_coupon_receive WHERE coupon_id IN (SELECT id FROM reset_coupons) UNION SELECT coupon_id FROM order_main WHERE id IN (SELECT id FROM reset_orders) AND coupon_id>0 UNION SELECT coupon_id FROM order_trip WHERE id IN (SELECT id FROM reset_trips) AND coupon_id>0;
CREATE TEMPORARY TABLE reset_coupon_counts AS SELECT coupon_id,COUNT(*) AS received,SUM(status=1) AS used FROM marketing_coupon_receive WHERE id IN (SELECT id FROM reset_receives) AND deleted_at IS NULL GROUP BY coupon_id;
CREATE TEMPORARY TABLE reset_promos AS SELECT id FROM marketing_promo_code WHERE coupon_id IN (SELECT id FROM reset_coupons);
CREATE TEMPORARY TABLE reset_notifies AS SELECT id FROM merchant_notify WHERE merchant_id>0 OR property_id>0;
CREATE TEMPORARY TABLE reset_conversations AS SELECT id FROM chat_conversation WHERE order_id IN (SELECT id FROM reset_orders) OR (type=1 AND (target_id IN (SELECT id FROM reset_goods) OR target_id IN (SELECT id FROM merchant_store)));
SELECT 'marketing_campaign (remove coupon references)',COUNT(*) FROM marketing_campaign WHERE JSON_OVERLAPS(coupon_ids,@reset_coupons);
SELECT IF(ENGINE='InnoDB',1,0) INTO @reset_engine FROM information_schema.TABLES WHERE TABLE_SCHEMA='$BUSINESS_DB' AND TABLE_NAME='marketing_campaign';
INSERT INTO reset_guard VALUES (1-COALESCE(@reset_engine,0));
SQL
    while IFS='|' read -r table predicate; do
        # Missing columns/tables fail during preview, before the first permanent DELETE.
        printf "SELECT '%s',COUNT(*) FROM \`%s\` WHERE %s;\n" "$table" "$table" "$predicate"
        printf "SELECT IF(ENGINE='InnoDB',1,0) INTO @reset_engine FROM information_schema.TABLES WHERE TABLE_SCHEMA='%s' AND TABLE_NAME='%s'; INSERT INTO reset_guard VALUES (1-COALESCE(@reset_engine,0));\n" "$BUSINESS_DB" "$table"
    done < "$WORK_DIR/plan"
    for table in sys_email_log sys_sms_log; do
        printf "SELECT '%s',COUNT(*) FROM \`%s\`.\`%s\` WHERE LEFT(scene,9)='merchant_';\n" "$table" "$SYSTEM_DB" "$table"
        printf "SELECT IF(ENGINE='InnoDB',1,0) INTO @reset_engine FROM information_schema.TABLES WHERE TABLE_SCHEMA='%s' AND TABLE_NAME='%s'; INSERT INTO reset_guard VALUES (1-COALESCE(@reset_engine,0));\n" "$SYSTEM_DB" "$table"
    done
    if [ "$1" = execute ]; then
        cat <<'SQL'
UPDATE marketing_coupon c JOIN reset_coupon_counts n ON n.coupon_id=c.id SET c.received_count=GREATEST(0,c.received_count-n.received),c.used_count=GREATEST(0,c.used_count-n.used);
UPDATE marketing_campaign SET coupon_ids=(SELECT COALESCE(JSON_ARRAYAGG(j.id),JSON_ARRAY()) FROM JSON_TABLE(coupon_ids,'$[*]' COLUMNS(id BIGINT PATH '$')) j WHERE j.id NOT IN (SELECT id FROM reset_coupons)) WHERE JSON_OVERLAPS(coupon_ids,@reset_coupons);
SQL
        while IFS='|' read -r table predicate; do
            printf 'DELETE FROM `%s` WHERE %s;\n' "$table" "$predicate"
        done < "$WORK_DIR/plan"
        for table in sys_email_log sys_sms_log; do
            printf "DELETE FROM \`%s\`.\`%s\` WHERE LEFT(scene,9)='merchant_';\n" "$SYSTEM_DB" "$table"
        done
        printf 'COMMIT;\n'
    else
        printf 'ROLLBACK;\n'
    fi
}

echo "[$MODE] $MYSQL_CONTAINER: $BUSINESS_DB + $SYSTEM_DB (ALL sites)"
build_sql preview > "$WORK_DIR/preview.sql"
mysql_exec < "$WORK_DIR/preview.sql"
echo "Preserved: platform/customer/supplier/group accounts, templates, channels, wallet balances/points, shared files, ID/code sequences."
[ "$MODE" = execute ] || { echo "Preview only; no persistent data changed."; exit 0; }

echo "Pausing writers..."
for container in "${WRITERS[@]}"; do
    STOPPED+=("$container")
    $DOCKER stop "$container" >/dev/null
done

# Capture account IDs for selective Redis pairing cleanup before deleting accounts.
account_ids="$(printf 'SELECT COALESCE(JSON_ARRAYAGG(id),JSON_ARRAY()) FROM `%s`.merchant_admin WHERE merchant_id>0 OR account_type IN (2,3) OR store_id>0;\n' "$BUSINESS_DB" | mysql_exec)"
umask 077
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/merchant-reset-$(date '+%Y%m%d-%H%M%S')-$$.sql.gz"
echo "Backing up both databases to $BACKUP"
$DOCKER exec -e "MYSQL_PWD=$ROOT_PWD" "$MYSQL_CONTAINER" mysqldump -uroot \
    --single-transaction --quick --routines --triggers --events --hex-blob \
    --set-gtid-purged=OFF --default-character-set=utf8mb4 --databases "$BUSINESS_DB" "$SYSTEM_DB" \
    | gzip > "$BACKUP.part"
gzip -t "$BACKUP.part"
mv "$BACKUP.part" "$BACKUP"

build_sql execute > "$WORK_DIR/delete.sql"
mysql_exec < "$WORK_DIR/delete.sql" || fail "SQL failed; disconnected transaction rolled back. Backup: $BACKUP"
echo "Database transaction committed."

# SCAN and bounded per-key DEL; preserve unrelated Redis databases and sessions.
for pattern in 'mtrip:merchant:registration:*' 'mtrip:merchant:2fa:pairing:*'; do
    redis_exec --scan --pattern "$pattern" > "$WORK_DIR/redis-keys"
    while IFS= read -r key; do
        [ -n "$key" ] || continue
        if [[ "$key" = mtrip:merchant:registration:* ]]; then
            result="$(redis_exec DEL "$key")"
            case "$result" in 0|1) ;; *) fail "Database committed but Redis cleanup failed: $result. Backup: $BACKUP" ;; esac
        else
            result="$(redis_exec EVAL 'local v=redis.call("GET",KEYS[1]); if not v then return 0 end; local p=cjson.decode(v); for _,id in ipairs(cjson.decode(ARGV[1])) do if p.adminId==id then return redis.call("DEL",KEYS[1]) end end; return 0' 1 "$key" "$account_ids")"
            case "$result" in 0|1) ;; *) fail "Database committed but Redis cleanup failed: $result. Backup: $BACKUP" ;; esac
        fi
    done < "$WORK_DIR/redis-keys"
done
echo "Reset complete. Backup: $BACKUP"
