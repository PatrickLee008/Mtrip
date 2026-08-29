#!/usr/bin/env bash
#
# Mtrip 本地/服务器一键启停脚本(deploy/README.md 各场景命令的统一入口)
#
#   用法:./mtrip.sh <命令> [服务名...]
#   详见:deploy/使用说明.md
#
# 约定:
#   - 所有 docker compose 命令都在 deploy/ 目录下执行(脚本自动切换,可从任意路径调用)
#   - 默认合并 docker-compose.override.yml(开发热挂载);加 --prod 只用 docker-compose.yml
#   - 凡是可能重建业务容器的操作(up/build),结束后自动重启 gateway,规避容器 IP 变化导致的 502
#
# 本脚本用到 bash 数组等特性:被 `sh mtrip.sh` 以 dash 启动时自动改用 bash 重新执行
# (必须放在任何数组语法之前 —— dash 是逐条解析,晚了会先报语法错误)
if [ -z "${BASH_VERSION:-}" ]; then
    exec bash "$0" "$@"
fi

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# ---------- 常量 ----------
BUSINESS_SERVICES=(
    system-service user-service goods-service order-service
    merchant-service finance-service marketing-service payment-service
)
INFRA_SERVICES=(mysql redis gateway)
# 服务名 -> 宿主机直连端口(healthz 探活用)
SERVICE_PORTS="system-service:9501 user-service:9502 goods-service:9503 order-service:9504 \
merchant-service:9505 finance-service:9506 marketing-service:9507 payment-service:9508"

# ---------- 输出 ----------
if [ -t 1 ]; then
    C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'; C_OFF=$'\033[0m'
else
    C_RED=''; C_GREEN=''; C_YELLOW=''; C_CYAN=''; C_OFF=''
fi
info()  { echo "${C_CYAN}==>${C_OFF} $*"; }
ok()    { echo "${C_GREEN}[OK]${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}[WARN]${C_OFF} $*"; }
fail()  { echo "${C_RED}[FAIL]${C_OFF} $*" >&2; }
die()   { fail "$*"; exit 1; }

# ---------- 参数解析:先摘掉 --prod ----------
PROD=0
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --prod) PROD=1 ;;
        *) ARGS+=("$arg") ;;
    esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}

# ---------- docker compose 可执行命令探测 ----------
detect_compose() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE=(docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE=(docker-compose)
    else
        die "未找到 docker compose(需要 Docker Engine 20.10+ 自带的 compose 插件,或独立的 docker-compose)"
    fi
    if [ "$PROD" -eq 1 ]; then
        COMPOSE+=(-f docker-compose.yml)
        warn "生产模式:跳过 docker-compose.override.yml(不挂载本地源码,改代码需 rebuild)"
    fi
}

# ---------- .env 准备 ----------
ensure_env() {
    if [ ! -f .env ]; then
        [ -f .env.example ] || die "deploy/.env.example 缺失,无法生成 .env"
        cp .env.example .env
        warn "未找到 deploy/.env,已从 .env.example 复制生成(生产环境务必修改其中的密钥与密码)"
    fi
}

# 从 .env 读取变量,取不到则用默认值
env_get() {
    local key="$1" def="$2" val=''
    if [ -f .env ]; then
        val="$(grep -E "^[[:space:]]*${key}=" .env | tail -n 1 | cut -d= -f2- | tr -d '\r' | xargs 2>/dev/null)"
    fi
    echo "${val:-$def}"
}

# ---------- 服务名校验 ----------
is_known_service() {
    local name="$1" s
    for s in "${BUSINESS_SERVICES[@]}" "${INFRA_SERVICES[@]}"; do
        [ "$s" = "$name" ] && return 0
    done
    return 1
}

validate_services() {
    local s
    for s in "$@"; do
        is_known_service "$s" || die "未知服务名:$s(可用:${BUSINESS_SERVICES[*]} ${INFRA_SERVICES[*]})"
    done
}

# up/build 后顺带重启网关:重建业务容器会换 IP,OpenResty 缓存的旧上游会导致全量 502
restart_gateway_if_needed() {
    local t
    for t in "$@"; do
        [ "$t" = "gateway" ] && return 0   # 目标里已包含网关,up 时已是新容器
    done
    # 网关未创建/未运行(如只启动了 mysql)时跳过,避免 restart 报错
    if [ -z "$("${COMPOSE[@]}" ps -q gateway 2>/dev/null)" ]; then
        return 0
    fi
    info "重启 gateway(重建容器会换 IP,OpenResty 缓存旧上游会全量 502)"
    "${COMPOSE[@]}" restart gateway
}

# ---------- 命令实现 ----------
cmd_start() {
    ensure_env
    info "启动服务${*:+:$*}"
    "${COMPOSE[@]}" up -d "$@" || die "启动失败"
    restart_gateway_if_needed "$@"
    ok "启动完成"
    print_endpoints
}

cmd_build() {
    ensure_env
    info "重建镜像并启动${*:+:$*}(分钟级)"
    "${COMPOSE[@]}" up -d --build "$@" || die "构建失败"
    restart_gateway_if_needed "$@"
    ok "构建并启动完成"
    print_endpoints
}

cmd_stop() {
    info "停止容器${*:+:$*}(保留容器与数据)"
    "${COMPOSE[@]}" stop "$@" || die "停止失败"
    ok "已停止"
}

cmd_restart() {
    if [ $# -eq 0 ]; then
        info "重启全部容器"
    else
        info "热重启:$*(挂载生效,无需 rebuild)"
    fi
    "${COMPOSE[@]}" restart "$@" || die "重启失败"
    ok "重启完成"
}

cmd_down() {
    info "删除容器与网络(保留数据卷,数据不丢)"
    "${COMPOSE[@]}" down || die "down 失败"
    ok "已删除容器"
}

cmd_clean() {
    warn "即将删除容器 + 数据卷:MySQL 数据将被清空,下次启动重新建表导种子"
    if [ "${MTRIP_YES:-0}" != "1" ]; then
        read -r -p "确认继续?输入 yes 回车:" answer
        [ "$answer" = "yes" ] || { info "已取消"; return 0; }
    fi
    "${COMPOSE[@]}" down -v || die "down -v 失败"
    ok "容器与数据卷已删除"
}

cmd_status() {
    "${COMPOSE[@]}" ps
}

cmd_logs() {
    if [ $# -eq 0 ]; then
        "${COMPOSE[@]}" logs -f --tail=100
    else
        "${COMPOSE[@]}" logs -f --tail=100 "$@"
    fi
}

cmd_health() {
    local gw_port failed=0 entry name port code
    gw_port="$(env_get GATEWAY_HOST_PORT 8081)"
    command -v curl >/dev/null 2>&1 || die "未安装 curl,无法执行探活"

    info "微服务 healthz 探活(直连宿主机映射端口)"
    for entry in $SERVICE_PORTS; do
        name="${entry%%:*}"; port="${entry##*:}"
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${port}/healthz" 2>/dev/null)"
        if [ "$code" = "200" ]; then
            printf '  %-18s %s%s%s  http://127.0.0.1:%s/healthz\n' "$name" "$C_GREEN" "200" "$C_OFF" "$port"
        else
            printf '  %-18s %s%s%s  http://127.0.0.1:%s/healthz\n' "$name" "$C_RED" "${code:-ERR}" "$C_OFF" "$port"
            failed=1
        fi
    done

    info "网关链路探活(端口 ${gw_port})"
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${gw_port}/healthz" 2>/dev/null)"
    if [ "$code" = "200" ]; then
        printf '  %-18s %s%s%s\n' "gateway /healthz" "$C_GREEN" "200" "$C_OFF"
    else
        printf '  %-18s %s%s%s\n' "gateway /healthz" "$C_RED" "${code:-ERR}" "$C_OFF"
        failed=1
    fi
    # 无签名 POST 预期 401(链路 + 签名中间件均正常);502 说明网关缓存了旧上游 IP
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 -X POST \
        "http://127.0.0.1:${gw_port}/api/v1/app/auth/login" 2>/dev/null)"
    case "$code" in
        401) printf '  %-18s %s401%s (无签名头,预期)\n' "gateway 转发" "$C_GREEN" "$C_OFF" ;;
        502) printf '  %-18s %s502%s 上游不可达 —— 执行 ./mtrip.sh restart gateway\n' "gateway 转发" "$C_RED" "$C_OFF"; failed=1 ;;
        *)   printf '  %-18s %s%s%s\n' "gateway 转发" "$C_YELLOW" "${code:-ERR}" "$C_OFF"; failed=1 ;;
    esac

    if [ "$failed" -eq 0 ]; then
        ok "全部探活通过"
    else
        fail "存在未通过项(容器刚起可等 10~30 秒重试,或 ./mtrip.sh logs <服务名> 看日志)"
        return 1
    fi
}

print_endpoints() {
    local gw_port mysql_port redis_port
    gw_port="$(env_get GATEWAY_HOST_PORT 8081)"
    mysql_port="$(env_get MYSQL_HOST_PORT 3307)"
    redis_port="$(env_get REDIS_HOST_PORT 6380)"
    echo
    echo "  网关入口      http://localhost:${gw_port}   (/api/v1/{admin,app,merchant,supplier}/*)"
    echo "  微服务直连    9501~9508  system/user/goods/order/merchant/finance/marketing/payment"
    echo "  MySQL         localhost:${mysql_port}    Redis  localhost:${redis_port}"
    echo "  探活          ./mtrip.sh health"
    echo
}

usage() {
    cat <<'EOF'
Mtrip 服务启停脚本

用法:
  ./mtrip.sh <命令> [服务名...] [--prod]

命令:
  start [服务名...]    启动(docker compose up -d),不重建镜像;首次无 .env 时自动从 .env.example 生成
  build [服务名...]    重建镜像并启动(up -d --build);改 Dockerfile / 新增 composer 依赖时用
  restart [服务名...]  热重启(docker compose restart);只改 PHP 代码时用,约 2 秒/个
  stop [服务名...]     停止容器,保留容器与数据
  down                 删除容器与网络,保留数据卷(数据不丢)
  clean                删除容器与数据卷(数据库清空,下次启动重新建表导种子,需确认)
  status               容器状态(docker compose ps)
  logs [服务名...]     跟踪日志(默认全部,-f --tail=100)
  health               8 个微服务 healthz + 网关链路探活
  help                 显示本帮助

选项:
  --prod               只用 docker-compose.yml,跳过开发热挂载 override(生产部署用)

服务名:
  system-service user-service goods-service order-service
  merchant-service finance-service marketing-service payment-service
  mysql redis gateway

示例:
  ./mtrip.sh start                      # 启动全部
  ./mtrip.sh restart goods-service      # 改完 PHP 代码热重启单个服务
  ./mtrip.sh build user-service         # 改了 Dockerfile / composer 依赖
  ./mtrip.sh logs order-service         # 跟踪单服务日志
  ./mtrip.sh health                     # 部署后验证
  MTRIP_YES=1 ./mtrip.sh clean          # 免交互清库重建(慎用)
EOF
}

# ---------- 入口 ----------
main() {
    local cmd="${1:-help}"
    [ $# -gt 0 ] && shift
    case "$cmd" in
        help|-h|--help) usage; return 0 ;;
    esac

    detect_compose
    validate_services "$@"

    case "$cmd" in
        start)   cmd_start "$@" ;;
        build)   cmd_build "$@" ;;
        restart) cmd_restart "$@" ;;
        stop)    cmd_stop "$@" ;;
        down)    cmd_down ;;
        clean)   cmd_clean ;;
        status|ps) cmd_status ;;
        logs)    cmd_logs "$@" ;;
        health)  cmd_health ;;
        *)       fail "未知命令:$cmd"; echo; usage; return 1 ;;
    esac
}

main "$@"
