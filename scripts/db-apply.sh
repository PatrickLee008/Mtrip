#!/usr/bin/env bash
#
# 向运行中的 MySQL 容器增量执行 database/ 下的 SQL 脚本,无需 down -v 重建。
# db-apply.ps1 的 Linux/bash 等价实现,行为一致:
#   docker cp 进容器 → 容器内用 `<` 重定向执行 → 密码走 MYSQL_PWD(规避 @ 特殊字符)
#
# 仓库所有 SQL 均幂等(CREATE TABLE IF NOT EXISTS / 守卫式 ALTER)且头部自带
# `USE mtrip_xxx;`,可安全重复灌入运行中的库。脚本按传入顺序逐个执行。
#
# 用法:
#   scripts/db-apply.sh database/merchant/34-merchant-sub-account-limit.sql \
#                       database/merchant/35-merchant-module-grant.sql
#
# 环境变量:
#   MYSQL_CONTAINER  容器名(默认 mtrip-mysql-1)
#   MYSQL_ROOT_PASSWORD  root 密码(默认 root@2026,与 deploy/.env 一致)
#   DOCKER           docker 命令(无权限时设为 "sudo docker")
#
# 仅用于开发环境增量更新;彻底重建仍用 docker compose down -v; up -d --build。

set -uo pipefail

CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-root@2026}"
DOCKER="${DOCKER:-docker}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -eq 0 ]; then
  echo "用法: $0 <file.sql> [file2.sql ...]   (相对路径以仓库根为基准)" >&2
  exit 2
fi

# docker 可用性与容器状态
if ! $DOCKER ps >/dev/null 2>&1; then
  echo "[x] 无法访问 docker(权限或未启动)。若是权限问题,重试: DOCKER='sudo docker' $0 $*" >&2
  exit 1
fi
if [ -z "$($DOCKER ps --filter "name=${CONTAINER}" --filter "status=running" --format '{{.Names}}')" ]; then
  echo "[x] 容器 ${CONTAINER} 未运行,请先 cd deploy && docker compose up -d" >&2
  exit 1
fi

# 解析并校验路径
resolved=()
for pat in "$@"; do
  case "$pat" in
    /*) full="$pat" ;;
    *)  full="${REPO_ROOT}/${pat}" ;;
  esac
  if [ ! -f "$full" ]; then
    echo "[x] 找不到: $pat" >&2
    exit 1
  fi
  resolved+=("$full")
done

total=${#resolved[@]}
failed=()
i=0
for f in "${resolved[@]}"; do
  i=$((i + 1))
  name="$(basename "$f")"
  echo "[${i}/${total}] 执行 ${name} ..."

  if ! $DOCKER cp "$f" "${CONTAINER}:/tmp/mtrip-apply.sql" >/dev/null; then
    echo "    [x] docker cp 失败: ${name}" >&2
    failed+=("$name")
    continue
  fi
  if $DOCKER exec -e "MYSQL_PWD=${ROOT_PWD}" "$CONTAINER" \
       sh -c "mysql -uroot --default-character-set=utf8mb4 < /tmp/mtrip-apply.sql"; then
    echo "    [ok] ${name}"
  else
    echo "    [x] 失败: ${name}" >&2
    failed+=("$name")
  fi
done

$DOCKER exec "$CONTAINER" sh -c "rm -f /tmp/mtrip-apply.sql" >/dev/null 2>&1

if [ ${#failed[@]} -gt 0 ]; then
  echo ""
  echo "失败 ${#failed[@]} 个: ${failed[*]}" >&2
  exit 1
fi
echo ""
echo "全部成功(${total} 个脚本)"
