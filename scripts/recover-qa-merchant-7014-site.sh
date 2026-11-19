#!/usr/bin/env bash
# Audited recovery of the published QA7014 migration; default mode is read-only.
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail
umask 077

MODE=check
case "${1:---check}" in
    --check) ;;
    --apply) MODE=apply ;;
    -h|--help)
        echo 'Check: bash scripts/recover-qa-merchant-7014-site.sh --check'
        echo 'Recover: bash scripts/recover-qa-merchant-7014-site.sh --apply'
        echo 'Apply backs up both databases, executes the reviewed replacement, and audits completion of the original intent.'
        exit 0 ;;
    *) echo 'Use --check or --apply' >&2; exit 2 ;;
esac
[ $# -le 1 ] || { echo 'Too many arguments' >&2; exit 2; }
ROOT="${MTRIP_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd -P)}"
DOCKER="${DOCKER:-docker}"
CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
BUSINESS="${DB_BUSINESS_DATABASE:-mtrip_business}"
SYSTEM="${DB_SYSTEM_DATABASE:-mtrip_system}"
OLD_VERSION=20261119073300
NEW_VERSION=20261119090000
OLD_NAME=V20261119073300__move-qa-merchant-7014-to-yangon.sql
NEW_NAME=V20261119090000__recover-qa-merchant-site-notification-reads.sql
OLD_SQL="$ROOT/database/migrations/$OLD_NAME"
NEW_SQL="$ROOT/database/migrations/$NEW_NAME"
LOCK_TIMEOUT="${MYSQL_MIGRATION_LOCK_TIMEOUT:-15}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/deploy/backups}"
fail() { echo "[FAIL] $*" >&2; exit 1; }
for database in "$BUSINESS" "$SYSTEM"; do
    [[ "$database" =~ ^[A-Za-z0-9_]+$ ]] || fail 'Invalid database identifier'
done
[ "$BUSINESS" != "$SYSTEM" ] || fail 'Database names must differ'
[[ "$LOCK_TIMEOUT" =~ ^[0-9]+$ ]] || fail 'Invalid migration lock timeout'
[ -f "$OLD_SQL" ] && [ -f "$NEW_SQL" ] || fail 'Fetch the original and corrective migration files first'
hash_file() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
    else shasum -a 256 "$1" | awk '{print $1}'; fi
}
OLD_HASH="$(hash_file "$OLD_SQL")"
NEW_HASH="$(hash_file "$NEW_SQL")"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-$($DOCKER exec "$CONTAINER" printenv MYSQL_ROOT_PASSWORD)}"
mysql_exec() {
    $DOCKER exec -i -e "MYSQL_PWD=$ROOT_PWD" "$CONTAINER" \
        mysql -uroot --skip-force --default-character-set=utf8mb4 --batch --skip-column-names --raw
}
query() { printf '%s\n' "$1" | mysql_exec; }
old_state="$(query "SELECT CONCAT_WS(CHAR(9),checksum,status,script_path) FROM $SYSTEM.schema_migrations WHERE version='$OLD_VERSION';")"
IFS=$'\t' read -r recorded_hash old_status old_path <<< "$old_state"
[ "$recorded_hash" = "$OLD_HASH" ] && [ "$old_path" = "database/migrations/$OLD_NAME" ] \
    || fail 'Original ledger/file identity mismatch; no checksum is changed by this recovery'
new_state="$(query "SELECT CONCAT_WS(CHAR(9),checksum,status,script_path) FROM $SYSTEM.schema_migrations WHERE version='$NEW_VERSION';")"
new_status=''
if [ -n "$new_state" ]; then
    IFS=$'\t' read -r recorded_new_hash new_status new_path <<< "$new_state"
    [ "$recorded_new_hash" = "$NEW_HASH" ] && [ "$new_path" = "database/migrations/$NEW_NAME" ] \
        || fail 'Corrective ledger/file identity mismatch'
fi
if [ "$old_status" = applied ]; then
    if [ "$new_status" = applied ]; then echo '[OK] Recovery is already recorded; no changes';
    elif [ -z "$new_status" ]; then echo '[OK] Original migration is applied; continue the normal deployment';
    else fail 'Corrective ledger is incomplete; inspect its actual state'; fi
    exit 0
fi
[ "$old_status" = failed ] || fail 'Only the known failed original migration can be recovered'
case "$new_status" in ''|failed) ;; *) fail 'Corrective migration is running/applied; inspect before retrying' ;; esac
[ "$(query "SELECT COUNT(*) FROM $SYSTEM.schema_migrations WHERE status<>'applied' AND version NOT IN ('$OLD_VERSION','$NEW_VERSION');")" = 0 ] \
    || fail 'Other incomplete migration versions require separate review'
for prerequisite in "$ROOT"/database/migrations/V*.sql; do
    name="$(basename "$prerequisite")"
    version="${name:1:14}"
    if [[ "$version" < "$NEW_VERSION" ]] && [ "$version" != "$OLD_VERSION" ]; then
        expected_hash="$(hash_file "$prerequisite")"
        [ "$(query "SELECT CONCAT_WS(':',checksum,status,script_path) FROM $SYSTEM.schema_migrations WHERE version='$version';")" = "$expected_hash:applied:database/migrations/$name" ] \
            || fail "Prerequisite $version is absent, incomplete, or differs from its published file"
    fi
done

scope="$(query "SELECT CONCAT_WS(',',(SELECT site_id FROM $BUSINESS.merchant_info WHERE id=7014 AND merchant_code='MCH-0010'),(SELECT site_id FROM $BUSINESS.merchant_application WHERE id=1041 AND merchant_id=7014),(SELECT site_id FROM $BUSINESS.merchant_application_business WHERE id=2080 AND application_id=1041),(SELECT site_id FROM $BUSINESS.merchant_store WHERE id=7522 AND merchant_id=7014),(SELECT site_id FROM $BUSINESS.merchant_admin WHERE id=4716 AND merchant_id=7014),(SELECT site_id FROM $BUSINESS.hotel_room_type WHERE id=7021 AND property_id=7522));")"
backup_exists="$(query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$BUSINESS' AND TABLE_NAME='migration_merchant_site_backup';")"
[ "$backup_exists" = 1 ] || fail 'Original backup table is missing; verify the failed attempt manually'
case "$scope" in
    1,1,1,1,1,1)
        [ "$(query "SELECT COUNT(*) FROM $BUSINESS.migration_merchant_site_backup WHERE migration_version='$OLD_VERSION';")" = 0 ] \
            || fail 'Source scope has committed backups; partial state needs review' ;;
    7,7,7,7,7,7)
        [ "$(query "SELECT COUNT(*) FROM $BUSINESS.migration_merchant_site_backup WHERE migration_version='$OLD_VERSION' AND source_site_id=1 AND target_site_id=7 AND ((table_name='merchant_info' AND row_id=7014) OR (table_name='merchant_application' AND row_id=1041) OR (table_name='merchant_application_business' AND row_id=2080) OR (table_name='merchant_store' AND row_id=7522) OR (table_name='merchant_admin' AND row_id=4716) OR (table_name='hotel_room_type' AND row_id=7021));")" = 6 ] \
            || fail 'Completed business state lacks the six original before-images' ;;
    *) fail "Mixed or missing core scope ($scope); no automatic recovery" ;;
esac
echo "[OK] Original checksum unchanged; failed intent verified; core sites: $scope"
query "SELECT 'notification read/hidden links retained',COUNT(*) FROM $BUSINESS.merchant_notify_read WHERE account_id=4716;"
if [ "$MODE" = check ]; then
    echo '[CHECK] No data/ledger changes. Use --apply in the deployment maintenance window.'
    exit 0
fi

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"
backup="$BACKUP_DIR/qa7014-recovery-$(date +%Y%m%d-%H%M%S)-$$.sql"
if ! $DOCKER exec -e "MYSQL_PWD=$ROOT_PWD" "$CONTAINER" \
    mysqldump -uroot --single-transaction --routines --events --triggers --no-tablespaces --databases "$SYSTEM" "$BUSINESS" > "$backup"; then
    fail "Backup failed: $backup"
fi
[ -s "$backup" ] || fail 'Backup is empty'
hash_file "$backup" > "$backup.sha256"
echo "[OK] Full database backup: $backup"
work_dir="$(mktemp -d "$BACKUP_DIR/.qa7014-control.XXXXXX")"
control="$work_dir/control.sql"
attempt="$(date +%s%N)-$$-${RANDOM:-0}"
actor="$(printf '%s' "${DEPLOY_ACTOR:-$(id -un)@$(hostname)}" | tr -c 'A-Za-z0-9._@:-' '_' | cut -c 1-128)"
commit="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
case "$commit" in *[!0-9a-f]*|'') commit='' ;; esac
backup_hex="$(printf '%s' "$backup" | od -An -tx1 | tr -d ' \n')"
remote_control="/tmp/mtrip-qa7014-recovery-$attempt.sql"
cleanup() {
    local code=$?
    $DOCKER exec "$CONTAINER" rm -f "$remote_control" >/dev/null 2>&1 || true
    case "$work_dir" in "$BACKUP_DIR"/.qa7014-control.*) rm -rf -- "$work_dir" ;; esac
    return "$code"
}
trap cleanup EXIT
ledger_json="JSON_OBJECT('version',version,'description',description,'script_path',script_path,'checksum',checksum,'status',status,'attempt_id',attempt_id,'git_commit',git_commit,'applied_by',applied_by,'started_at',started_at,'finished_at',finished_at,'execution_ms',execution_ms,'error_message',error_message)"
cat > "$control" <<SQL
SET NAMES utf8mb4;
USE \`$SYSTEM\`;
SET @qa_lock=GET_LOCK('mtrip_schema_migrations',$LOCK_TIMEOUT);
CREATE TEMPORARY TABLE qa_recovery_guard(ok TINYINT NOT NULL CHECK(ok=1));
INSERT INTO qa_recovery_guard VALUES(IF(@qa_lock=1,1,0));
INSERT INTO qa_recovery_guard SELECT IF(COUNT(*)=1,1,0) FROM $SYSTEM.schema_migrations WHERE version='$OLD_VERSION' AND checksum='$OLD_HASH' AND status='failed' AND script_path='database/migrations/$OLD_NAME';
INSERT INTO qa_recovery_guard SELECT IF(COUNT(*)=0,1,0) FROM $SYSTEM.schema_migrations WHERE version='$NEW_VERSION' AND NOT (checksum='$NEW_HASH' AND status='failed' AND script_path='database/migrations/$NEW_NAME');
SET @qa_original_ledger=(SELECT $ledger_json FROM $SYSTEM.schema_migrations WHERE version='$OLD_VERSION');
SET @qa_previous_recovery=(SELECT $ledger_json FROM $SYSTEM.schema_migrations WHERE version='$NEW_VERSION');
INSERT INTO $SYSTEM.schema_migrations(version,description,script_path,checksum,status,attempt_id,git_commit,applied_by,started_at)
VALUES('$NEW_VERSION','recover-qa-merchant-site-notification-reads','database/migrations/$NEW_NAME','$NEW_HASH','running','$attempt','$commit','$actor',NOW(6))
ON DUPLICATE KEY UPDATE status='running',attempt_id='$attempt',git_commit='$commit',applied_by='$actor',started_at=NOW(6),finished_at=NULL,execution_ms=0,error_message='';
SQL
cat "$NEW_SQL" >> "$control"
cat >> "$control" <<SQL

-- Only a successfully executed corrective SQL with verified postconditions can
-- resolve the original intent; both ledger states and its audit commit together.
USE \`$SYSTEM\`;
START TRANSACTION;
INSERT INTO qa_recovery_guard SELECT IF(COUNT(*)=1,1,0) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$SYSTEM' AND TABLE_NAME='schema_migration_recovery' AND ENGINE='InnoDB';
INSERT INTO qa_recovery_guard VALUES(IF((SELECT site_id FROM $BUSINESS.merchant_info WHERE id=7014)=7 AND (SELECT site_id FROM $BUSINESS.merchant_application WHERE id=1041 AND merchant_id=7014)=7 AND (SELECT site_id FROM $BUSINESS.merchant_application_business WHERE id=2080 AND application_id=1041)=7 AND (SELECT site_id FROM $BUSINESS.merchant_store WHERE id=7522)=7 AND (SELECT site_id FROM $BUSINESS.merchant_admin WHERE id=4716 AND merchant_id=7014)=7 AND (SELECT site_id FROM $BUSINESS.hotel_room_type WHERE id=7021)=7,1,0));
INSERT INTO qa_recovery_guard SELECT IF(COUNT(*)=6,1,0) FROM $BUSINESS.migration_merchant_site_backup WHERE migration_version='$OLD_VERSION' AND source_site_id=1 AND target_site_id=7 AND ((table_name='merchant_info' AND row_id=7014) OR (table_name='merchant_application' AND row_id=1041) OR (table_name='merchant_application_business' AND row_id=2080) OR (table_name='merchant_store' AND row_id=7522) OR (table_name='merchant_admin' AND row_id=4716) OR (table_name='hotel_room_type' AND row_id=7021));
INSERT INTO $SYSTEM.schema_migration_recovery(recovery_version,recovery_attempt_id,original_version,original_ledger,previous_recovery_ledger,recovery_checksum,backup_path,recovered_by)
VALUES('$NEW_VERSION','$attempt','$OLD_VERSION',@qa_original_ledger,@qa_previous_recovery,'$NEW_HASH',CONVERT(0x$backup_hex USING utf8mb4),'$actor');
UPDATE $SYSTEM.schema_migrations SET status='applied',finished_at=NOW(6),applied_by='recovered-by:$NEW_VERSION',error_message='Original failed attempt archived; intent completed by reviewed recovery $NEW_VERSION'
WHERE version='$OLD_VERSION' AND checksum='$OLD_HASH' AND status='failed';
INSERT INTO qa_recovery_guard VALUES(IF(ROW_COUNT()=1,1,0));
UPDATE $SYSTEM.schema_migrations SET status='applied',finished_at=NOW(6),execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND,started_at,NOW(6))/1000),error_message=''
WHERE version='$NEW_VERSION' AND checksum='$NEW_HASH' AND attempt_id='$attempt' AND status='running';
INSERT INTO qa_recovery_guard VALUES(IF(ROW_COUNT()=1,1,0));
COMMIT;
DO RELEASE_LOCK('mtrip_schema_migrations');
SELECT 'QA7014 recovery recorded; original checksum retained; resume Ops deployment';
SQL
control_host="$control"
if command -v cygpath >/dev/null 2>&1; then control_host="$(cygpath -w "$control")"; fi
$DOCKER cp "$control_host" "$CONTAINER:$remote_control" >/dev/null
if ! $DOCKER exec -e "MYSQL_PWD=$ROOT_PWD" "$CONTAINER" sh -c "mysql -uroot --skip-force --default-character-set=utf8mb4 < '$remote_control'"; then
    query "UPDATE $SYSTEM.schema_migrations SET status='failed',finished_at=NOW(6),error_message='QA7014 corrective SQL failed; original failed intent retained; inspect backup before retry' WHERE version='$NEW_VERSION' AND checksum='$NEW_HASH' AND attempt_id='$attempt' AND status='running';" >/dev/null || true
    fail "Recovery stopped; original intent was not cleared. Backup: $backup"
fi
query "SELECT version,status,checksum,applied_by FROM $SYSTEM.schema_migrations WHERE version IN ('$OLD_VERSION','$NEW_VERSION') ORDER BY version;"
