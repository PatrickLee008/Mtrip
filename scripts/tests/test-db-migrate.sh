#!/usr/bin/env bash
# 无 Docker/MySQL 环境下验证迁移状态机；fake docker 只实现 db-migrate.sh 使用的命令子集。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "$REPO_ROOT/.test-db-migrate.XXXXXX")"
cleanup() {
    case "$TEST_ROOT" in "$REPO_ROOT"/.test-db-migrate.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT

FIXTURE="$TEST_ROOT/fixture"
FAKE_DIR="$TEST_ROOT/fake-db"
mkdir -p "$FIXTURE/scripts" "$FIXTURE/database/init" "$FIXTURE/database/migrations" "$FAKE_DIR"
cp "$REPO_ROOT/scripts/db-migrate.sh" "$FIXTURE/scripts/db-migrate.sh"
cp "$REPO_ROOT/scripts/auto-deploy.sh" "$FIXTURE/scripts/auto-deploy.sh"
cp "$REPO_ROOT/database/init/01-schema-migrations.sql" "$FIXTURE/database/init/01-schema-migrations.sql"

cat > "$FIXTURE/database/migrations/V20260909000001__test-migration.sql" <<'SQL'
SET NAMES utf8mb4;
USE `mtrip_system`;
CREATE TABLE IF NOT EXISTS `migration_test` (`id` BIGINT UNSIGNED NOT NULL PRIMARY KEY) ENGINE=InnoDB;
SQL
cp "$FIXTURE/database/migrations/V20260909000001__test-migration.sql" "$TEST_ROOT/original-migration.sql"

echo 0 > "$FAKE_DIR/ledger-exists"
: > "$FAKE_DIR/row"

cat > "$TEST_ROOT/fake-docker" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

state_dir="${FAKE_DB_STATE:?}"
cmd="${1:-}"
shift || true

case "$cmd" in
    ps)
        if [[ " $* " == *" --format "* ]]; then echo "mtrip-mysql-1"; fi
        ;;
    cp)
        src="$1"
        dst="$2"
        case "$dst" in
            *-control.sql) cp "$src" "$state_dir/control.sql" ;;
            *) : ;;
        esac
        ;;
    exec)
        if [ "${1:-}" = "-e" ]; then shift 2; fi
        shift # container
        if [ "${1:-}" = "printenv" ]; then
            echo "test-password"
            exit 0
        fi
        if [ "${1:-}" = "rm" ]; then exit 0; fi
        if [ "${1:-}" = "sh" ]; then
            shell_cmd="${3:-}"
            if [[ "$shell_cmd" == *"mtrip-schema-migrations.sql"* ]]; then
                echo 1 > "$state_dir/ledger-exists"
                exit 0
            fi
            if [ -f "$state_dir/fail-apply" ]; then exit 1; fi
            values="$(sed -n "s/.*('\([0-9]\{14\}\)', '\([^']*\)', '\([^']*\)', '\([0-9a-f]\{64\}\)', 'running', '\([^']*\)'.*/\1\t\2\t\3\t\4\t\5/p" "$state_dir/control.sql")"
            version="$(printf '%s' "$values" | cut -f1)"
            description="$(printf '%s' "$values" | cut -f2)"
            script_path="$(printf '%s' "$values" | cut -f3)"
            checksum="$(printf '%s' "$values" | cut -f4)"
            attempt_id="$(printf '%s' "$values" | cut -f5)"
            if [ -f "$state_dir/race-owner" ]; then
                printf '%s\t%s\t%s\t%s\trunning\towner-a\n' "$version" "$description" "$script_path" "$checksum" > "$state_dir/row"
                exit 1
            fi
            printf '%s\t%s\t%s\t%s\tapplied\t%s\n' "$version" "$description" "$script_path" "$checksum" "$attempt_id" > "$state_dir/row"
            exit 0
        fi

        query="${*: -1}"
        IFS=$'\t' read -r version description script_path checksum status attempt_id < "$state_dir/row" || true
        case "$query" in
            *information_schema.TABLES*) cat "$state_dir/ledger-exists" ;;
            *"COUNT(*)"*"status='applied'"*) [ "${status:-}" = "applied" ] && echo 1 || echo 0 ;;
            *"COUNT(*)"*"status<>'applied'"*) [ -n "${status:-}" ] && [ "$status" != "applied" ] && echo 1 || echo 0 ;;
            *"MAX(version)"*) echo "${version:-}" ;;
            *"SELECT status"*) echo "${status:-}" ;;
            *"UPDATE mtrip_system.schema_migrations"*"status='failed'"*)
                requested_attempt="$(printf '%s' "$query" | sed -n "s/.*attempt_id='\([^']*\)'.*/\1/p")"
                if [ "${status:-}" = "running" ] && [ "${attempt_id:-}" = "$requested_attempt" ]; then
                    printf '%s\t%s\t%s\t%s\tfailed\t%s\n' "$version" "$description" "$script_path" "$checksum" "$attempt_id" > "$state_dir/row"
                fi
                ;;
            *"WHERE version='"*)
                if [ -n "${version:-}" ] && [[ "$query" == *"version='$version'"* ]]; then
                    printf '%s\t%s\t%s\n' "$checksum" "$status" "$script_path"
                fi
                ;;
            *) : ;;
        esac
        ;;
    *) echo "fake docker 不支持: $cmd" >&2; exit 2 ;;
esac
BASH
chmod +x "$TEST_ROOT/fake-docker"
cat > "$TEST_ROOT/flock" <<'BASH'
#!/usr/bin/env bash
exit 0
BASH
chmod +x "$TEST_ROOT/flock"

run_migrate() {
    FAKE_DB_STATE="$FAKE_DIR" DOCKER="$TEST_ROOT/fake-docker" \
        bash "$FIXTURE/scripts/db-migrate.sh" "$@"
}

touch "$FIXTURE/database/migrations/V20260909000002__invalid-.sql"
if run_migrate --validate > "$TEST_ROOT/name.out" 2>&1; then
    echo "非 lower-kebab 迁移名本应被拒绝" >&2
    exit 1
fi
rm "$FIXTURE/database/migrations/V20260909000002__invalid-.sql"

touch "$FIXTURE/database/migrations/V20260230000000__invalid-date.sql"
if run_migrate --validate > "$TEST_ROOT/date.out" 2>&1; then
    echo "无效 UTC 日期迁移名本应被拒绝" >&2
    exit 1
fi
rm "$FIXTURE/database/migrations/V20260230000000__invalid-date.sql"

# The official-image init runner must persist failed before aborting a fresh init.
INIT_MIGRATIONS="$TEST_ROOT/init-migrations"
mkdir -p "$INIT_MIGRATIONS"
cp "$TEST_ROOT/original-migration.sql" "$INIT_MIGRATIONS/V20260909000001__test-migration.sql"
cat > "$TEST_ROOT/mysql" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"
printf '%s\n-- statement --\n' "$payload" >> "${INIT_MYSQL_LOG:?}"
if [[ "$payload" == *"CREATE TABLE IF NOT EXISTS"*migration_test* ]]; then exit 1; fi
BASH
chmod +x "$TEST_ROOT/mysql"
if PATH="$TEST_ROOT:$PATH" INIT_MYSQL_LOG="$TEST_ROOT/init-mysql.log" \
    MTRIP_MIGRATION_DIR="$INIT_MIGRATIONS" MYSQL_ROOT_PASSWORD=test \
    bash "$REPO_ROOT/database/init/99-run-migrations.sh" > "$TEST_ROOT/init-runner.out" 2>&1; then
    echo "fresh-init 迁移失败时 runner 本应失败" >&2
    exit 1
fi
grep -q "status='failed'" "$TEST_ROOT/init-mysql.log"
grep -q "status <> 'applied'" "$REPO_ROOT/deploy/docker-compose.yml"

first_output="$(run_migrate)"
grep -q "全部迁移成功，共执行 1 个版本" <<< "$first_output"

second_output="$(run_migrate)"
grep -q "数据库已是最新版本" <<< "$second_output"

auto_output="$(cd "$FIXTURE" && PATH="$TEST_ROOT:$PATH" FAKE_DB_STATE="$FAKE_DIR" DOCKER="$TEST_ROOT/fake-docker" bash scripts/auto-deploy.sh --dry-run database)"
grep -q "读取迁移账本并列出待执行版本" <<< "$auto_output"

printf '\n-- checksum changed\n' >> "$FIXTURE/database/migrations/V20260909000001__test-migration.sql"
if run_migrate --status > "$TEST_ROOT/tamper.out" 2>&1; then
    echo "checksum 改写本应失败" >&2
    exit 1
fi
grep -q "SHA-256 被改写" "$TEST_ROOT/tamper.out"

cp "$TEST_ROOT/original-migration.sql" "$FIXTURE/database/migrations/V20260909000001__test-migration.sql"
awk 'BEGIN { FS=OFS="\t" } { $5="failed"; print }' "$FAKE_DIR/row" > "$FAKE_DIR/row.tmp"
mv "$FAKE_DIR/row.tmp" "$FAKE_DIR/row"
if run_migrate --status > "$TEST_ROOT/failed.out" 2>&1; then
    echo "failed 状态本应阻断" >&2
    exit 1
fi
grep -q "状态为 failed" "$TEST_ROOT/failed.out"

awk 'BEGIN { FS=OFS="\t" } { $5="applied"; print }' "$FAKE_DIR/row" > "$FAKE_DIR/row.tmp"
mv "$FAKE_DIR/row.tmp" "$FAKE_DIR/row"
rm "$FIXTURE/database/migrations/V20260909000001__test-migration.sql"
if run_migrate --status > "$TEST_ROOT/missing.out" 2>&1; then
    echo "删除已执行迁移本应阻断" >&2
    exit 1
fi
grep -q "禁止删除已发布迁移文件" "$TEST_ROOT/missing.out"

cp "$TEST_ROOT/original-migration.sql" "$FIXTURE/database/migrations/V20260909000001__test-migration.sql"
cp "$TEST_ROOT/original-migration.sql" "$FIXTURE/database/migrations/V20260909000000__older-migration.sql"
if run_migrate --status > "$TEST_ROOT/order.out" 2>&1; then
    echo "倒序迁移本应阻断" >&2
    exit 1
fi
grep -q "禁止倒序补迁移" "$TEST_ROOT/order.out"

# A losing concurrent attempt must not mark the winning attempt's running row as failed.
rm "$FIXTURE/database/migrations/V20260909000000__older-migration.sql"
: > "$FAKE_DIR/row"
touch "$FAKE_DIR/race-owner"
if run_migrate > "$TEST_ROOT/ownership.out" 2>&1; then
    echo "并发 running 记录本应阻断当前迁移" >&2
    exit 1
fi
rm "$FAKE_DIR/race-owner"
IFS=$'\t' read -r _ _ _ _ owned_status owned_attempt < "$FAKE_DIR/row"
[ "$owned_status" = "running" ]
[ "$owned_attempt" = "owner-a" ]

# Git 已快进但迁移失败时，下一轮必须继续使用“上次完整发布点”的变更范围。
SOURCE_REPO="$TEST_ROOT/source-repo"
BARE_REPO="$TEST_ROOT/origin.git"
DEPLOY_REPO="$TEST_ROOT/deploy-repo"
mkdir -p "$SOURCE_REPO/scripts" "$SOURCE_REPO/database/init" "$SOURCE_REPO/database/migrations" \
    "$SOURCE_REPO/database/merchant" \
    "$SOURCE_REPO/deploy/openresty"
cp "$REPO_ROOT/scripts/auto-deploy.sh" "$SOURCE_REPO/scripts/auto-deploy.sh"
cp "$REPO_ROOT/scripts/db-migrate.sh" "$SOURCE_REPO/scripts/db-migrate.sh"
cp "$REPO_ROOT/database/init/01-schema-migrations.sql" "$SOURCE_REPO/database/init/01-schema-migrations.sql"
cat > "$SOURCE_REPO/database/merchant/01-snapshot.sql" <<'SQL'
SET NAMES utf8mb4;
USE `mtrip_system`;
CREATE TABLE IF NOT EXISTS `snapshot_only` (`id` BIGINT PRIMARY KEY);
SQL
cat > "$SOURCE_REPO/deploy/mtrip.sh" <<'BASH'
#!/usr/bin/env bash
echo "$*" >> "${MTRIP_TEST_LOG:?}"
BASH
git -C "$SOURCE_REPO" init -q
git -C "$SOURCE_REPO" config user.name test
git -C "$SOURCE_REPO" config user.email test@example.com
git -C "$SOURCE_REPO" add .
git -C "$SOURCE_REPO" commit -qm baseline
git -C "$SOURCE_REPO" branch -M main
BASE_COMMIT="$(git -C "$SOURCE_REPO" rev-parse HEAD)"
git init -q --bare "$BARE_REPO"
git -C "$BARE_REPO" symbolic-ref HEAD refs/heads/main
git -C "$SOURCE_REPO" remote add origin "$BARE_REPO"
git -C "$SOURCE_REPO" push -q -u origin main
git clone -q "$BARE_REPO" "$DEPLOY_REPO"

cp "$TEST_ROOT/original-migration.sql" "$SOURCE_REPO/database/migrations/V20260909000002__deploy-recovery.sql"
echo "# test" > "$SOURCE_REPO/deploy/openresty/recovery.conf"
git -C "$SOURCE_REPO" add .
git -C "$SOURCE_REPO" commit -qm release
git -C "$SOURCE_REPO" push -q
RELEASE_COMMIT="$(git -C "$SOURCE_REPO" rev-parse HEAD)"

echo 1 > "$FAKE_DIR/ledger-exists"
: > "$FAKE_DIR/row"
touch "$FAKE_DIR/fail-apply"
if (cd "$DEPLOY_REPO" && PATH="$TEST_ROOT:$PATH" MTRIP_TEST_LOG="$TEST_ROOT/mtrip.log" \
    FAKE_DB_STATE="$FAKE_DIR" DOCKER="$TEST_ROOT/fake-docker" bash scripts/auto-deploy.sh --prod) \
    > "$TEST_ROOT/first-deploy.out" 2>&1; then
    echo "迁移失败时 auto-deploy 本应失败" >&2
    exit 1
fi
[ "$(git -C "$DEPLOY_REPO" rev-parse HEAD)" = "$RELEASE_COMMIT" ]
[ "$(cat "$DEPLOY_REPO/.git/mtrip-last-successful-deploy")" = "$BASE_COMMIT" ]

rm "$FAKE_DIR/fail-apply"
(cd "$DEPLOY_REPO" && PATH="$TEST_ROOT:$PATH" MTRIP_TEST_LOG="$TEST_ROOT/mtrip.log" \
    FAKE_DB_STATE="$FAKE_DIR" DOCKER="$TEST_ROOT/fake-docker" bash scripts/auto-deploy.sh --prod) \
    > "$TEST_ROOT/second-deploy.out" 2>&1
[ "$(cat "$DEPLOY_REPO/.git/mtrip-last-successful-deploy")" = "$RELEASE_COMMIT" ]
grep -q "restart gateway --prod" "$TEST_ROOT/mtrip.log"

# Historical initialization snapshots must never be renamed into production migrations.
git -C "$SOURCE_REPO" mv database/merchant/01-snapshot.sql \
    database/migrations/V20260909000003__snapshot-replay.sql
git -C "$SOURCE_REPO" commit -qm snapshot-replay
git -C "$SOURCE_REPO" push -q
if (cd "$DEPLOY_REPO" && PATH="$TEST_ROOT:$PATH" MTRIP_TEST_LOG="$TEST_ROOT/mtrip.log" \
    FAKE_DB_STATE="$FAKE_DIR" DOCKER="$TEST_ROOT/fake-docker" bash scripts/auto-deploy.sh --prod) \
    > "$TEST_ROOT/snapshot-replay.out" 2>&1; then
    echo "旧快照 rename 为迁移本应被拒绝" >&2
    exit 1
fi
grep -q "禁止将旧初始化快照 rename/copy 为生产迁移" "$TEST_ROOT/snapshot-replay.out"

echo "db-migrate 状态机测试通过"
