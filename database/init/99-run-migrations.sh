#!/usr/bin/env bash
# 仅供 MySQL 官方镜像首次初始化调用；生产存量库由 scripts/db-migrate.sh 管理。
# 必须独立调用 mysql，不能依赖 docker_process_sql：可执行 .sh 会被 entrypoint 作为子进程启动。

set -e

MIGRATION_DIR="${MTRIP_MIGRATION_DIR:-/mtrip-migrations}"
mysql_exec() {
    MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-}" mysql --protocol=socket -uroot \
        --default-character-set=utf8mb4 "$@"
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

declare -A seen_versions=()
for migration in "$MIGRATION_DIR"/*.sql; do
    [ -f "$migration" ] || continue

    name="$(basename "$migration")"
    if [[ ! "$name" =~ ^V([0-9]{14})__([a-z0-9]+(-[a-z0-9]+)*)\.sql$ ]]; then
        echo "[mtrip-migrate] 非法迁移文件名: $name" >&2
        exit 1
    fi

    version="${BASH_REMATCH[1]}"
    if ! valid_utc_version "$version"; then
        echo "[mtrip-migrate] 迁移版本不是有效的 UTC 日期时间: $version ($name)" >&2
        exit 1
    fi
    if [ ${#BASH_REMATCH[2]} -gt 190 ] || [ $((20 + ${#name})) -gt 255 ]; then
        echo "[mtrip-migrate] 迁移文件名过长: $name" >&2
        exit 1
    fi
    if [ -n "${seen_versions[$version]:-}" ]; then
        echo "[mtrip-migrate] 迁移版本重复: $version (${seen_versions[$version]} / $name)" >&2
        exit 1
    fi
    seen_versions[$version]="$name"
done

for migration in "$MIGRATION_DIR"/*.sql; do
    [ -f "$migration" ] || continue

    name="$(basename "$migration")"
    [[ "$name" =~ ^V([0-9]{14})__([a-z0-9]+(-[a-z0-9]+)*)\.sql$ ]]
    version="${BASH_REMATCH[1]}"
    description="${BASH_REMATCH[2]}"
    checksum="$(sha256sum "$migration" | awk '{print $1}')"
    script_path="database/migrations/$name"

    echo "[mtrip-migrate] 首次初始化执行 $name"
    mysql_exec mtrip_system <<-EOSQL
		INSERT INTO schema_migrations
		  (version, description, script_path, checksum, status, attempt_id, git_commit, applied_by, started_at)
		VALUES
		  ('$version', '$description', '$script_path', '$checksum', 'running', '$checksum', '', 'docker-entrypoint-initdb', NOW(6));
	EOSQL

    if ! mysql_exec < "$migration"; then
        mysql_exec mtrip_system <<-EOSQL
			UPDATE schema_migrations
			SET status='failed', finished_at=NOW(6),
			    execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, NOW(6)) / 1000),
			    error_message='docker entrypoint migration failed'
			WHERE version='$version' AND status='running' AND attempt_id='$checksum';
		EOSQL
        echo "[mtrip-migrate] 首次初始化迁移失败: $name" >&2
        exit 1
    fi

    mysql_exec mtrip_system <<-EOSQL
		UPDATE schema_migrations
		SET status='applied', finished_at=NOW(6),
		    execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, NOW(6)) / 1000),
		    error_message=''
		WHERE version='$version' AND status='running' AND attempt_id='$checksum';
	EOSQL
done
