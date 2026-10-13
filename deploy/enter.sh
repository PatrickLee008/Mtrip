#!/usr/bin/env bash
#
# 进入 Mtrip 容器:MySQL / Redis 直接打开客户端,其余服务打开 shell。
#
#   用法:./enter.sh <目标> [--s7]
#     ./enter.sh mysql                 MySQL 客户端(root,默认库 mtrip_business)
#     ./enter.sh mysql mtrip_system    指定默认库
#     ./enter.sh redis                 redis-cli
#     ./enter.sh merchant-service      服务容器 shell(工作目录 /opt/www)
#     ./enter.sh goods-service-app     APP 孪生同理
#     ./enter.sh gateway               网关容器 shell
#     ./enter.sh                       列出可进入的容器
#
# 按 compose 服务名查容器(不依赖容器名后缀);--s7 进隔离验收栈 mtrip-s7。
if [ -z "${BASH_VERSION:-}" ]; then
    exec bash "$0" "$@"
fi
set -uo pipefail

PROJECT="${MTRIP_PROJECT:-mtrip}"
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --s7) PROJECT="mtrip-s7" ;;
        -h|--help) sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) ARGS+=("$arg") ;;
    esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}

list_services() {
    docker ps --filter "label=com.docker.compose.project=$PROJECT" \
        --format '{{.Label "com.docker.compose.service"}}' | sort
}

if [ $# -eq 0 ]; then
    echo "可进入的容器(project=$PROJECT):"
    list_services | sed 's/^/  /'
    echo "用法:./enter.sh <服务名> [--s7]   如 ./enter.sh mysql / ./enter.sh merchant-service"
    exit 0
fi

SERVICE="$1"; shift
CID="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" \
    --filter "label=com.docker.compose.service=$SERVICE" | head -n 1)"
if [ -z "$CID" ]; then
    echo "[FAIL] 未找到运行中的 $SERVICE(project=$PROJECT)。当前可进入:" >&2
    list_services | sed 's/^/  /' >&2
    exit 1
fi

case "$SERVICE" in
    mysql)
        DB="${1:-mtrip_business}"
        # 密码取容器自身环境变量,不出现在宿主机命令行/历史里
        exec docker exec -it "$CID" sh -c \
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4 "$1"' _ "$DB"
        ;;
    redis)
        exec docker exec -it "$CID" redis-cli "$@"
        ;;
    *)
        if docker exec "$CID" sh -c 'command -v bash' >/dev/null 2>&1; then
            exec docker exec -it "$CID" bash
        fi
        exec docker exec -it "$CID" sh
        ;;
esac
