#!/usr/bin/env bash
#
# MySQL 逻辑备份脚本(mysqldump)—— 适合挂 cron 定期跑。
# 数据在具名卷 mtrip_mysql-data 中,本脚本用 docker exec 进容器 dump 两个库,
# gzip 压缩后按时间戳落盘,并自动清理超过保留期的旧备份。
#
#   docker exec mtrip-mysql-1 mysqldump ...  →  gzip  →  backups/mtrip-YYYYmmdd-HHMMSS.sql.gz
#   密码走 MYSQL_PWD(规避 @ 特殊字符,与 db-apply.sh 一致)
#
# 用法:
#   scripts/db-backup.sh                 # 备份到默认目录 deploy/backups,保留 14 天
#
# 环境变量(均有默认值):
#   MYSQL_CONTAINER      容器名        (默认 mtrip-mysql-1)
#   MYSQL_ROOT_PASSWORD  root 密码     (默认 root@2026,与 deploy/.env 一致)
#   BACKUP_DIR           备份输出目录   (默认 <仓库根>/deploy/backups)
#   RETENTION_DAYS       保留天数       (默认 14,0=不清理)
#   DATABASES            要备份的库     (默认 "mtrip_business mtrip_system")
#   DOCKER               docker 命令    (无权限时设为 "sudo docker")
#
# 恢复(示例):
#   gunzip -c backups/mtrip-YYYYmmdd-HHMMSS.sql.gz | \
#     docker exec -i -e MYSQL_PWD=root@2026 mtrip-mysql-1 mysql -uroot --default-character-set=utf8mb4
#   (dump 含 CREATE DATABASE/USE,恢复会覆盖对应库;整机迁移可先建空库再灌)

set -uo pipefail

CONTAINER="${MYSQL_CONTAINER:-mtrip-mysql-1}"
ROOT_PWD="${MYSQL_ROOT_PASSWORD:-root@2026}"
DOCKER="${DOCKER:-docker}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASES="${DATABASES:-mtrip_business mtrip_system}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/deploy/backups}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# docker 可用性与容器状态
if ! $DOCKER ps >/dev/null 2>&1; then
  echo "[x] 无法访问 docker(权限或未启动)。权限问题重试: DOCKER='sudo docker' $0" >&2
  exit 1
fi
if [ -z "$($DOCKER ps --filter "name=${CONTAINER}" --filter "status=running" --format '{{.Names}}')" ]; then
  echo "[x] 容器 ${CONTAINER} 未运行,请先 cd deploy && ./mtrip.sh start" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR" || { echo "[x] 无法创建备份目录: $BACKUP_DIR" >&2; exit 1; }

STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="${BACKUP_DIR}/mtrip-${STAMP}.sql.gz"
TMP="${OUT}.part"

log "开始备份库 [${DATABASES}] -> ${OUT}"

# --single-transaction: InnoDB 一致性快照,不锁表(备份期业务照常读写)
# --routines/--triggers/--events: 存储过程/触发器/事件一并导出
# --default-character-set=utf8mb4: 与建库 utf8mb4_bin 对齐
if $DOCKER exec -e "MYSQL_PWD=${ROOT_PWD}" "$CONTAINER" \
     mysqldump -uroot \
       --single-transaction --quick \
       --routines --triggers --events \
       --default-character-set=utf8mb4 \
       --databases $DATABASES 2>/tmp/mtrip-dump.err \
     | gzip > "$TMP"; then
  mv "$TMP" "$OUT"
  SIZE="$(du -h "$OUT" | cut -f1)"
  log "[ok] 备份完成: ${OUT} (${SIZE})"
else
  rm -f "$TMP"
  echo "[x] 备份失败:" >&2
  $DOCKER exec "$CONTAINER" sh -c 'cat /tmp/mtrip-dump.err' 2>/dev/null >&2 || true
  exit 1
fi
$DOCKER exec "$CONTAINER" sh -c 'rm -f /tmp/mtrip-dump.err' >/dev/null 2>&1 || true

# 清理超过保留期的旧备份
if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  deleted="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mtrip-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
  [ "$deleted" -gt 0 ] && log "已清理 ${deleted} 个超过 ${RETENTION_DAYS} 天的旧备份"
fi

log "当前备份总数: $(find "$BACKUP_DIR" -maxdepth 1 -name 'mtrip-*.sql.gz' -type f | wc -l | tr -d ' ')"
