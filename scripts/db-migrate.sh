#!/usr/bin/env bash
# 按 database/migrations 的全局版本增量执行 SQL，并记录生产执行账本。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail

MODE="apply"
case "${1:-}" in
    "") ;;
    --validate) MODE="validate" ;;
    --status)   MODE="status" ;;
    --dry-run)  MODE="dry-run" ;;
    -h|--help)
        sed -n '1,80s/^# \{0,1\}//p' "$0"
        exit 0
        ;;
    *) echo "未知参数: $1 (支持 --validate|--status|--dry-run)" >&2; exit 2 ;;
esac
[ $# -le 1 ] || { echo "参数过多" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${MTRIP_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
MIGRATION_DIR="$REPO_ROOT/database/migrations"
LEDGER_DDL="$REPO_ROOT/database/init/01-schema-migrations.sql"
CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-}"
DOCKER="${DOCKER:-docker}"
LOCK_TIMEOUT="${MYSQL_MIGRATION_LOCK_TIMEOUT:-60}"
DEPLOY_ACTOR="${DEPLOY_ACTOR:-$(id -un 2>/dev/null || echo unknown)@$(hostname 2>/dev/null || echo unknown)}"
DEPLOY_ACTOR="$(printf '%s' "$DEPLOY_ACTOR" | tr -c 'A-Za-z0-9._@:-' '_' | cut -c 1-128)"
GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
case "$GIT_COMMIT" in (*[!0-9a-f]*|'') GIT_COMMIT="" ;; esac

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [FAIL] $*" >&2; }

[ -d "$MIGRATION_DIR" ] || { fail "迁移目录不存在: $MIGRATION_DIR"; exit 1; }
[ -f "$LEDGER_DDL" ] || { fail "账本定义不存在: $LEDGER_DDL"; exit 1; }
case "$LOCK_TIMEOUT" in (*[!0-9]*|'') fail "MYSQL_MIGRATION_LOCK_TIMEOUT 必须是非负整数"; exit 2 ;; esac

if command -v sha256sum >/dev/null 2>&1; then
    checksum_file() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
    checksum_file() { shasum -a 256 "$1" | awk '{print $1}'; }
else
    fail "缺少 sha256sum 或 shasum，无法校验迁移文件"
    exit 1
fi
read_checksum() {
    local checksum
    checksum="$(checksum_file "$1")" || return 1
    [[ "$checksum" =~ ^[0-9a-f]{64}$ ]] || return 1
    printf '%s' "$checksum"
}

valid_utc_version() {
    local value="$1" year month day hour minute second max_day
    year=$((10#${value:0:4}))
    month=$((10#${value:4:2}))
    day=$((10#${value:6:2}))
    hour=$((10#${value:8:2}))
    minute=$((10#${value:10:2}))
    second=$((10#${value:12:2}))
    [ "$year" -ge 1000 ] && [ "$month" -ge 1 ] && [ "$month" -le 12 ] \
        && [ "$hour" -le 23 ] && [ "$minute" -le 59 ] && [ "$second" -le 59 ] || return 1
    case "$month" in
        2)
            max_day=28
            if (( year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) )); then max_day=29; fi
            ;;
        4|6|9|11) max_day=30 ;;
        *) max_day=31 ;;
    esac
    [ "$day" -ge 1 ] && [ "$day" -le "$max_day" ]
}

MIGRATIONS=()
while IFS= read -r migration; do MIGRATIONS+=("$migration"); done < <(
    find "$MIGRATION_DIR" -type f -name '*.sql' -print | LC_ALL=C sort
)

declare -A SEEN_VERSIONS=()
VALIDATION_FAILED=0
for migration in "${MIGRATIONS[@]}"; do
    name="$(basename "$migration")"
    if [ "$(dirname "$migration")" != "$MIGRATION_DIR" ]; then
        fail "迁移目录必须保持单层，不能使用子目录: ${migration#"$REPO_ROOT/"}"
        VALIDATION_FAILED=1
        continue
    fi
    if [[ ! "$name" =~ ^V([0-9]{14})__([a-z0-9]+(-[a-z0-9]+)*)\.sql$ ]]; then
        fail "非法迁移文件名: $name；要求 VYYYYMMDDHHMMSS__lower-kebab.sql"
        VALIDATION_FAILED=1
        continue
    fi
    version="${BASH_REMATCH[1]}"
    if ! valid_utc_version "$version"; then
        fail "迁移版本不是有效的 UTC 日期时间: $version ($name)"
        VALIDATION_FAILED=1
        continue
    fi
    if [ ${#BASH_REMATCH[2]} -gt 190 ] || [ $((20 + ${#name})) -gt 255 ]; then
        fail "迁移文件名过长，说明最多 190 字符且仓库相对路径最多 255 字符: $name"
        VALIDATION_FAILED=1
        continue
    fi
    if [ -n "${SEEN_VERSIONS[$version]:-}" ]; then
        fail "迁移版本重复: $version (${SEEN_VERSIONS[$version]} / $name)"
        VALIDATION_FAILED=1
    fi
    SEEN_VERSIONS[$version]="$name"
done
[ "$VALIDATION_FAILED" -eq 0 ] || exit 1

if [ "$MODE" = "validate" ]; then
    log "迁移命名校验通过，共 ${#MIGRATIONS[@]} 个版本"
    exit 0
fi

if ! $DOCKER ps >/dev/null 2>&1; then
    fail "无法访问 docker；若是权限问题可设置 DOCKER='sudo docker'"
    exit 1
fi
if ! $DOCKER ps --filter "name=${CONTAINER}" --filter "status=running" --format '{{.Names}}' | grep -qxF "$CONTAINER"; then
    fail "MySQL 容器 $CONTAINER 未运行"
    exit 1
fi
if [ -z "$ROOT_PWD" ]; then
    ROOT_PWD="$($DOCKER exec "$CONTAINER" printenv MYSQL_ROOT_PASSWORD 2>/dev/null)" \
        || { fail "无法从容器读取 MYSQL_ROOT_PASSWORD；请显式设置该环境变量"; exit 1; }
fi
[ -n "$ROOT_PWD" ] || { fail "MYSQL_ROOT_PASSWORD 为空"; exit 1; }

mysql_query() {
    $DOCKER exec -e "MYSQL_PWD=${ROOT_PWD}" "$CONTAINER" \
        mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names --raw -e "$1"
}

ledger_exists="$(mysql_query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='mtrip_system' AND TABLE_NAME='schema_migrations';")" \
    || { fail "无法查询迁移账本"; exit 1; }

if [ "$ledger_exists" != "1" ]; then
    if [ "$MODE" = "status" ] || [ "$MODE" = "dry-run" ]; then
        log "迁移账本尚未创建；当前 ${#MIGRATIONS[@]} 个版本均视为待执行"
        for migration in "${MIGRATIONS[@]}"; do echo "  PENDING  $(basename "$migration")"; done
        exit 0
    fi

    $DOCKER cp "$LEDGER_DDL" "${CONTAINER}:/tmp/mtrip-schema-migrations.sql" >/dev/null \
        || { fail "复制迁移账本 DDL 失败"; exit 1; }
    if ! $DOCKER exec -e "MYSQL_PWD=${ROOT_PWD}" "$CONTAINER" sh -c \
        'mysql -uroot --default-character-set=utf8mb4 < /tmp/mtrip-schema-migrations.sql'; then
        fail "创建迁移账本失败"
        exit 1
    fi
    $DOCKER exec "$CONTAINER" rm -f /tmp/mtrip-schema-migrations.sql >/dev/null 2>&1 || true
    log "已创建 mtrip_system.schema_migrations"
fi

PENDING=()
APPLIED_SEEN=0
INTEGRITY_FAILED=0
for migration in "${MIGRATIONS[@]}"; do
    name="$(basename "$migration")"
    [[ "$name" =~ ^V([0-9]{14})__([a-z0-9]+(-[a-z0-9]+)*)\.sql$ ]]
    version="${BASH_REMATCH[1]}"
    checksum="$(read_checksum "$migration")" \
        || { fail "无法计算迁移 SHA-256: $name"; exit 1; }
    script_path="database/migrations/$name"
    row="$(mysql_query "SELECT CONCAT(checksum, CHAR(9), status, CHAR(9), script_path) FROM mtrip_system.schema_migrations WHERE version='$version';")" \
        || { fail "查询版本 $version 失败"; exit 1; }

    if [ -z "$row" ]; then
        PENDING+=("$migration")
        continue
    fi

    IFS=$'\t' read -r recorded_checksum recorded_status recorded_path <<< "$row"
    if [ "$recorded_checksum" != "$checksum" ] || [ "$recorded_path" != "$script_path" ]; then
        fail "版本 $version 已登记但文件路径或 SHA-256 被改写: $name"
        INTEGRITY_FAILED=1
        continue
    fi
    if [ "$recorded_status" != "applied" ]; then
        fail "版本 $version 当前状态为 $recorded_status，需人工核对后处理，自动发布已阻断"
        INTEGRITY_FAILED=1
        continue
    fi
    APPLIED_SEEN=$((APPLIED_SEEN + 1))
done

LEDGER_APPLIED="$(mysql_query "SELECT COUNT(*) FROM mtrip_system.schema_migrations WHERE status='applied';")" \
    || { fail "统计迁移账本失败"; exit 1; }
LEDGER_INCOMPLETE="$(mysql_query "SELECT COUNT(*) FROM mtrip_system.schema_migrations WHERE status<>'applied';")" \
    || { fail "统计未完成迁移失败"; exit 1; }
if [ "$LEDGER_APPLIED" -ne "$APPLIED_SEEN" ]; then
    fail "账本有 $LEDGER_APPLIED 个已执行版本，但仓库只匹配到 $APPLIED_SEEN 个；禁止删除已发布迁移文件"
    INTEGRITY_FAILED=1
fi
if [ "$LEDGER_INCOMPLETE" -ne 0 ]; then
    fail "账本存在 $LEDGER_INCOMPLETE 个 running/failed 版本，需人工核对后处理"
    INTEGRITY_FAILED=1
fi

MAX_APPLIED="$(mysql_query "SELECT COALESCE(MAX(version), '') FROM mtrip_system.schema_migrations WHERE status='applied';")" \
    || { fail "查询最高迁移版本失败"; exit 1; }
for migration in "${PENDING[@]}"; do
    name="$(basename "$migration")"
    version="${name:1:14}"
    if [ -n "$MAX_APPLIED" ] && [[ "$version" < "$MAX_APPLIED" ]]; then
        fail "待执行版本 $version 低于已上线最高版本 $MAX_APPLIED；禁止倒序补迁移"
        INTEGRITY_FAILED=1
    fi
done
[ "$INTEGRITY_FAILED" -eq 0 ] || exit 1

log "版本对比完成: 已执行 $APPLIED_SEEN，待执行 ${#PENDING[@]}"
for migration in "${PENDING[@]}"; do echo "  PENDING  $(basename "$migration")"; done

if [ "$MODE" = "status" ] || [ "$MODE" = "dry-run" ]; then exit 0; fi
if [ ${#PENDING[@]} -eq 0 ]; then
    log "数据库已是最新版本"
    # Apply mode performs one fresh, read-only pass before reporting success. This
    # closes the window where another deploy changed the ledger after our scan.
    MTRIP_REPO_ROOT="$REPO_ROOT" DOCKER="$DOCKER" \
        bash "$SCRIPT_DIR/db-migrate.sh" --status
    exit $?
fi

for migration in "${PENDING[@]}"; do
    name="$(basename "$migration")"
    [[ "$name" =~ ^V([0-9]{14})__([a-z0-9]+(-[a-z0-9]+)*)\.sql$ ]]
    version="${BASH_REMATCH[1]}"
    description="${BASH_REMATCH[2]}"
    checksum="$(read_checksum "$migration")" \
        || { fail "无法计算迁移 SHA-256: $name"; exit 1; }
    attempt_id="$(printf '%s' "${GIT_COMMIT:-manual}-$$-${RANDOM:-0}-$(date +%s%N)" | cut -c 1-64)"
    script_path="database/migrations/$name"
    remote_sql="/tmp/mtrip-migration-$version.sql"
    remote_control="/tmp/mtrip-migration-$version-control.sql"
    control_file="$(mktemp)" || { fail "无法创建临时控制文件"; exit 1; }

    cat > "$control_file" <<-EOSQL
		SET @mtrip_lock_acquired := GET_LOCK('mtrip_schema_migrations', $LOCK_TIMEOUT);
		SET @mtrip_guard_sql := IF(@mtrip_lock_acquired = 1, 'SELECT 1', 'SELECT * FROM mtrip_system.__migration_lock_timeout__');
		PREPARE mtrip_lock_guard FROM @mtrip_guard_sql;
		EXECUTE mtrip_lock_guard;
		DEALLOCATE PREPARE mtrip_lock_guard;
		INSERT INTO mtrip_system.schema_migrations
		  (version, description, script_path, checksum, status, attempt_id, git_commit, applied_by, started_at)
		VALUES
		  ('$version', '$description', '$script_path', '$checksum', 'running', '$attempt_id', '$GIT_COMMIT', '$DEPLOY_ACTOR', NOW(6));
		SOURCE $remote_sql;
		UPDATE mtrip_system.schema_migrations
		SET status='applied', finished_at=NOW(6),
		    execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, NOW(6)) / 1000),
		    error_message=''
		WHERE version='$version' AND status='running' AND attempt_id='$attempt_id';
		DO RELEASE_LOCK('mtrip_schema_migrations');
	EOSQL

    log "执行 $name"
    if ! $DOCKER cp "$migration" "${CONTAINER}:${remote_sql}" >/dev/null \
        || ! $DOCKER cp "$control_file" "${CONTAINER}:${remote_control}" >/dev/null; then
        rm -f -- "$control_file"
        fail "复制迁移文件失败: $name"
        exit 1
    fi
    rm -f -- "$control_file"

    if $DOCKER exec -e "MYSQL_PWD=${ROOT_PWD}" "$CONTAINER" sh -c \
        "mysql -uroot --default-character-set=utf8mb4 < $remote_control"; then
        state="$(mysql_query "SELECT status FROM mtrip_system.schema_migrations WHERE version='$version' AND checksum='$checksum';")"
        if [ "$state" != "applied" ]; then
            fail "迁移命令返回成功，但账本状态不是 applied: $name"
            exit 1
        fi
        log "[OK] $name"
    else
        # 另一发布进程可能在本进程预检后抢先完成；只有同 checksum 的 applied 才可继续。
        concurrent_state="$(mysql_query "SELECT CONCAT(checksum, CHAR(9), status, CHAR(9), script_path) FROM mtrip_system.schema_migrations WHERE version='$version';" 2>/dev/null || true)"
        if [ "$concurrent_state" = "${checksum}"$'\t'"applied"$'\t'"${script_path}" ]; then
            log "[OK] $name 已由并发发布进程完成"
        else
            mysql_query "UPDATE mtrip_system.schema_migrations SET status='failed', finished_at=NOW(6), execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, NOW(6)) / 1000), error_message='mysql client execution failed' WHERE version='$version' AND status='running' AND attempt_id='$attempt_id';" >/dev/null 2>&1 || true
            fail "迁移失败并停止后续版本: $name；DDL 可能已部分提交，请人工核对"
            exit 1
        fi
    fi
    $DOCKER exec "$CONTAINER" rm -f "$remote_sql" "$remote_control" >/dev/null 2>&1 || true
done

# Reconcile every repository file against the complete ledger after the batch.
# --status exits before this apply-only branch, so this cannot recurse.
MTRIP_REPO_ROOT="$REPO_ROOT" DOCKER="$DOCKER" \
    bash "$SCRIPT_DIR/db-migrate.sh" --status \
    || { fail "迁移后完整账本复核失败"; exit 1; }
log "全部迁移成功，共执行 ${#PENDING[@]} 个版本，完整账本复核通过"
