#!/usr/bin/env bash
# 测试数据导入/清理脚本
#
# 用法:
#   ./test/apply.sh            # 先清理(id>=保留段)再导入全部测试数据
#   ./test/apply.sh clean      # 只清理,不导入
#   ./test/apply.sh import     # 只导入(不清空已有测试数据,可能触发唯一键冲突)
#
# 连接参数来自 deploy/.env 的 DB_*,也可被环境变量覆盖:
#   DB_HOST DB_PORT DB_USERNAME DB_PASSWORD
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$HERE/sql"
ENV_FILE="$HERE/../deploy/.env"

# 默认值(与 deploy/.env 中开发库一致)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3307}"
DB_USERNAME="${DB_USERNAME:-mtrip}"
DB_PASSWORD="${DB_PASSWORD:-mtrip@2026}"

# 若 deploy/.env 存在则尝试读取真实连接参数
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r k v; do
    [[ -z "$k" || "$k" == \#* ]] && continue
    v="${v%\"*}"; v="${v#\"}"; v="${v%\'*}"; v="${v#\'}"
    case "$k" in
      DB_HOST) DB_HOST="${DB_HOST:-$v}";;
      DB_PORT) DB_PORT="${DB_PORT:-$v}";;
      DB_USERNAME) DB_USERNAME="${DB_USERNAME:-$v}";;
      DB_PASSWORD) DB_PASSWORD="${DB_PASSWORD:-$v}";;
    esac
  done < "$ENV_FILE"
fi

MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" --default-character-set=utf8mb4)

run_clean() {
  echo "==> 清理历史测试数据 (00-clean.sql)"
  "${MYSQL[@]}" < "$SQL_DIR/00-clean.sql"
}

run_import() {
  echo "==> 导入测试数据"
  for f in $(ls -1 "$SQL_DIR" | grep -E '^[0-9]+-.*\.sql$' | grep -v '^00-' | sort); do
    echo "    -> $f"
    "${MYSQL[@]}" < "$SQL_DIR/$f"
  done
  echo "==> 导入完成"
}

case "${1:-}" in
  clean)  run_clean;;
  import) run_import;;
  *)      run_clean; run_import;;
esac
