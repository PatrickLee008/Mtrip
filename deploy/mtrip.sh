#!/usr/bin/env bash
#
# Mtrip 服务启停脚本(deploy/README.md 各场景 docker compose 命令的统一入口)
#
#   用法:./mtrip.sh <命令> [服务名...] [--prod|--s7]
#   详见:deploy/使用说明.md
#
# 三种栈模式:
#   默认   docker-compose.yml + docker-compose.override.yml(开发热挂载,网关 8081)
#   --prod 只用 docker-compose.yml(不挂本地源码,改代码须 build)
#   --s7   隔离验收栈,等价 scripts/s7-environment.ps1:独立 project mtrip-s7、
#          s7.env.example、不加载 override 与开发者 .env、网关仅 127.0.0.1:8181
#
# 凡是可能重建业务容器的操作(start/build),结束后自动刷新网关,
# 规避容器 IP 变化后 OpenResty 缓存旧上游导致的全量 502。
#
# 用到 bash 数组与 pipefail:被 `sh mtrip.sh` 以 dash 启动时自动改用 bash 重新执行
# (必须放在 set -o pipefail 与任何数组语法之前 —— dash 逐条解析,晚了会先报错)
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
# APP 端独立实例池:5 个共享服务的 -app 孪生(不发布宿主端口,仅经网关内网可达)
# 定义见 docker-compose.app-pool.yml;网关 /api/v1/app/* 一律走这些孪生
APP_POOL_SERVICES=(
    system-service-app user-service-app goods-service-app
    order-service-app marketing-service-app
)
INFRA_SERVICES=(mysql redis gateway)
# 业务服务 -> 容器内 HTTP 端口(默认栈同时映射到宿主机同名端口)
SERVICE_PORTS="system-service:9501 user-service:9502 goods-service:9503 order-service:9504 \
merchant-service:9505 finance-service:9506 marketing-service:9507 payment-service:9508"
# APP 孪生 -> 容器内 HTTP 端口(无宿主映射,仅容器内探活用)
APP_POOL_PORTS="system-service-app:9501 user-service-app:9502 goods-service-app:9503 \
order-service-app:9504 marketing-service-app:9507"

S7_PROJECT="mtrip-s7"
S7_ENV_FILE="s7.env.example"
S7_GATEWAY_PORT="8181"

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

# ---------- 参数解析:先摘掉模式开关 ----------
MODE="dev"
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --prod) MODE="prod" ;;
        --s7)   MODE="s7" ;;
        *) ARGS+=("$arg") ;;
    esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}

# ---------- docker compose 命令组装 ----------
detect_compose() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE=(docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE=(docker-compose)
    else
        die "未找到 docker compose(需 Docker Engine 自带 compose 插件,或独立 docker-compose)"
    fi

    case "$MODE" in
        dev)
            # 默认栈:显式列出全部文件(一旦用 -f,compose 不再自动加载 yml+override)
            # 含 APP 孪生池及其开发热挂载
            COMPOSE+=(-f docker-compose.yml -f docker-compose.override.yml
                      -f docker-compose.app-pool.yml -f docker-compose.app-pool.override.yml)
            ;;
        prod)
            # 生产:主池 + APP 孪生池,均不挂本地源码
            COMPOSE+=(-f docker-compose.yml -f docker-compose.app-pool.yml)
            warn "生产模式:跳过 override(不挂载本地源码,改代码需 build)"
            ;;
        s7)
            [ -f "$S7_ENV_FILE" ] || die "缺少 deploy/$S7_ENV_FILE,无法启动 S7 栈"
            # 显式指定文件:绝不加载开发 override 与开发者 .env(与 s7-environment.ps1 一致)
            COMPOSE+=(--project-name "$S7_PROJECT" --env-file "$S7_ENV_FILE"
                      -f docker-compose.yml -f docker-compose.s7.yml)
            warn "S7 隔离验收栈:project=${S7_PROJECT},网关仅 127.0.0.1:${S7_GATEWAY_PORT},只用预构建镜像"
            ;;
    esac
}

# ---------- .env 与挂载目录准备 ----------
ensure_env() {
    [ "$MODE" = "s7" ] && return 0   # S7 用 s7.env.example,不碰开发者 .env
    if [ ! -f .env ]; then
        [ -f .env.example ] || die "deploy/.env.example 缺失,无法生成 .env"
        cp .env.example .env
        warn "未找到 deploy/.env,已从 .env.example 复制生成(生产环境务必修改密钥与密码)"
    fi
}

# merchant-service 写入 / gateway 静态读取的共享目录;不预建会被 Docker 以 root 属主创建
ensure_uploads() {
    [ "$MODE" = "s7" ] && return 0   # S7 用具名卷 s7-uploads,不用宿主目录
    [ -d uploads ] || { mkdir -p uploads && info "已创建 deploy/uploads(上传文件共享目录)"; }
}

# 从 env 文件读取变量,取不到则用默认值
env_get() {
    local key="$1" def="$2" file=".env" val=''
    [ "$MODE" = "s7" ] && file="$S7_ENV_FILE"
    if [ -f "$file" ]; then
        val="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 | cut -d= -f2- | tr -d '\r' | xargs 2>/dev/null)"
    fi
    echo "${val:-$def}"
}

# ---------- 服务名校验 ----------
validate_services() {
    local s t known
    for s in "$@"; do
        known=0
        for t in "${BUSINESS_SERVICES[@]}" "${APP_POOL_SERVICES[@]}" "${INFRA_SERVICES[@]}"; do
            [ "$t" = "$s" ] && { known=1; break; }
        done
        [ "$known" -eq 1 ] || die "未知服务名:$s(可用:${BUSINESS_SERVICES[*]} ${APP_POOL_SERVICES[*]} ${INFRA_SERVICES[*]})"
    done
}

# ---------- 网关刷新 ----------
# up/build 会重建业务容器换 IP,而 OpenResty 启动时就解析并缓存了上游 IP
refresh_gateway() {
    local t
    for t in "$@"; do
        [ "$t" = "gateway" ] && return 0   # 目标已含网关,up 后本就是新容器
    done
    if [ -z "$("${COMPOSE[@]}" ps -q gateway 2>/dev/null)" ]; then
        return 0   # 网关未创建(如只启动了 mysql),跳过
    fi
    if [ "$MODE" = "s7" ]; then
        # S7 与 PowerShell 版一致:reload 而非 restart,不中断已建立的验收会话
        info "reload gateway(刷新上游 IP 解析)"
        "${COMPOSE[@]}" exec -T gateway /usr/local/openresty/nginx/sbin/nginx -s reload 2>/dev/null \
            || "${COMPOSE[@]}" restart gateway
    else
        info "重启 gateway(重建容器会换 IP,OpenResty 缓存旧上游会全量 502)"
        "${COMPOSE[@]}" restart gateway
    fi
}

# ---------- 命令实现 ----------
cmd_start() {
    ensure_env; ensure_uploads
    info "启动服务${*:+:$*}"
    if [ "$MODE" = "s7" ]; then
        # 只用已构建好的镜像:不构建、不拉取,缺镜像即失败(验收环境不允许隐式变更)
        "${COMPOSE[@]}" --parallel 1 up -d --no-build --pull never "$@" || die "S7 启动失败(镜像缺失?先在默认栈跑一次 build)"
    else
        "${COMPOSE[@]}" up -d "$@" || die "启动失败"
    fi
    refresh_gateway "$@"
    ok "启动完成"
    [ "$MODE" = "s7" ] && info "S7 建议紧接着跑:./mtrip.sh health --s7"
    print_endpoints
}

cmd_build() {
    [ "$MODE" = "s7" ] && die "S7 栈按设计只用预构建镜像,请先在默认栈 ./mtrip.sh build 再 ./mtrip.sh start --s7"
    ensure_env; ensure_uploads
    info "重建镜像并启动${*:+:$*}(分钟级)"
    "${COMPOSE[@]}" up -d --build "$@" || die "构建失败"
    refresh_gateway "$@"
    ok "构建并启动完成"
    print_endpoints
}

cmd_stop() {
    info "停止容器${*:+:$*}(保留容器与数据)"
    "${COMPOSE[@]}" stop "$@" || die "停止失败"
    ok "已停止"
}

cmd_restart() {
    if [ $# -eq 0 ]; then info "重启全部容器"; else info "热重启:$*"; fi
    "${COMPOSE[@]}" restart "$@" || die "重启失败"
    ok "重启完成"
}

cmd_down() {
    info "删除容器与网络(保留数据卷,数据不丢)"
    "${COMPOSE[@]}" down || die "down 失败"
    ok "已删除容器"
}

cmd_clean() {
    warn "即将删除容器 + 数据卷:数据库将被清空,下次启动重新建表导种子"
    [ "$MODE" = "s7" ] && warn "S7 的 s7-uploads 卷(验收留痕)也会一并删除"
    if [ "${MTRIP_YES:-0}" != "1" ]; then
        read -r -p "确认继续?输入 yes 回车:" answer
        [ "$answer" = "yes" ] || { info "已取消"; return 0; }
    fi
    "${COMPOSE[@]}" down -v || die "down -v 失败"
    ok "容器与数据卷已删除"
}

cmd_status() { "${COMPOSE[@]}" ps; }

cmd_logs() {
    if [ $# -eq 0 ]; then "${COMPOSE[@]}" logs -f --tail=100
    else "${COMPOSE[@]}" logs -f --tail=100 "$@"; fi
}

# 默认/prod 栈:宿主机直连 9501~9508 探活
health_via_host() {
    local failed=0 entry name port code gw_port
    gw_port="$(env_get GATEWAY_HOST_PORT 8081)"

    info "微服务 healthz 探活(宿主机映射端口)"
    for entry in $SERVICE_PORTS; do
        name="${entry%%:*}"; port="${entry##*:}"
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${port}/healthz" 2>/dev/null)"
        if [ "$code" = "200" ]; then
            printf '  %-18s %s200%s\n' "$name" "$C_GREEN" "$C_OFF"
        else
            printf '  %-18s %s%s%s\n' "$name" "$C_RED" "${code:-ERR}" "$C_OFF"; failed=1
        fi
    done

    info "网关链路探活(端口 ${gw_port})"
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${gw_port}/healthz" 2>/dev/null)"
    [ "$code" = "200" ] && printf '  %-18s %s200%s\n' "gateway /healthz" "$C_GREEN" "$C_OFF" \
                        || { printf '  %-18s %s%s%s\n' "gateway /healthz" "$C_RED" "${code:-ERR}" "$C_OFF"; failed=1; }

    # 无签名 POST 的预期码【取决于 .env 的 MTRIP_CLIENT_SIGN】:
    #   true  → 401(签名中间件先挡下)
    #   false → 400(直接落到业务校验:缺 X-Site-Id / 缺 mobile)—— 本地联调常关,同样证明链路已到上游
    # 真正的故障是 502/504(网关缓存了旧上游 IP 或上游没起)与 404(mtrip.conf 的模块 map 没匹配上)。
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 -X POST \
        "http://127.0.0.1:${gw_port}/api/v1/app/auth/login" 2>/dev/null)"
    case "$code" in
        401) printf '  %-18s %s401%s (签名中间件生效,预期)\n' "gateway 转发" "$C_GREEN" "$C_OFF" ;;
        400) printf '  %-18s %s400%s (已达上游业务校验;MTRIP_CLIENT_SIGN=false 时的预期)\n' "gateway 转发" "$C_GREEN" "$C_OFF" ;;
        502|504) printf '  %-18s %s%s%s 上游不可达 —— 跑 ./mtrip.sh restart gateway\n' "gateway 转发" "$C_RED" "$code" "$C_OFF"; failed=1 ;;
        404) printf '  %-18s %s404%s 网关未匹配到模块 —— 查 openresty/conf.d/mtrip.conf 的 map\n' "gateway 转发" "$C_RED" "$C_OFF"; failed=1 ;;
        *)   printf '  %-18s %s%s%s\n' "gateway 转发" "$C_YELLOW" "${code:-ERR}" "$C_OFF"; failed=1 ;;
    esac

    # APP 孪生池:无宿主端口,只能在容器内探活(与 s7 同法)
    info "APP 孪生池 healthz 探活(容器内,端口不对外发布)"
    local entry name port probe
    for entry in $APP_POOL_PORTS; do
        name="${entry%%:*}"; port="${entry##*:}"
        probe='exit(@file_get_contents("http://127.0.0.1:'"$port"'/healthz")?0:1);'
        if "${COMPOSE[@]}" exec -T "$name" php -r "$probe" >/dev/null 2>&1; then
            printf '  %-22s %s200%s\n' "$name" "$C_GREEN" "$C_OFF"
        else
            printf '  %-22s %s未就绪%s(看日志:./mtrip.sh logs %s)\n' "$name" "$C_RED" "$C_OFF" "$name"; failed=1
        fi
    done
    return $failed
}

# S7 栈:业务服务端口不对外发布,只能在容器内探活(与 s7-environment.ps1 同法)
health_via_exec() {
    local failed=0 entry name port cname ready attempt probe
    info "S7 容器内 healthz 探活(端口不对外发布)"
    for entry in $SERVICE_PORTS; do
        name="${entry%%:*}"; port="${entry##*:}"
        cname="${S7_PROJECT}-${name}-1"
        probe='$r=json_decode(@file_get_contents("http://127.0.0.1:'"$port"'/healthz"),true); exit(($r["status"]??"")==="ok"?0:1);'
        ready=0
        for attempt in $(seq 1 20); do
            if docker exec "$cname" php -r "$probe" >/dev/null 2>&1; then ready=1; break; fi
            sleep 2
        done
        if [ "$ready" -eq 1 ]; then
            printf '  %-24s %sOK%s\n' "$cname" "$C_GREEN" "$C_OFF"
        else
            printf '  %-24s %s未就绪%s(看日志:./mtrip.sh logs %s --s7)\n' "$cname" "$C_RED" "$C_OFF" "$name"; failed=1
        fi
    done

    info "网关探活(127.0.0.1:${S7_GATEWAY_PORT})"
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${S7_GATEWAY_PORT}/healthz" 2>/dev/null)"
    [ "$code" = "200" ] && printf '  %-24s %s200%s\n' "gateway /healthz" "$C_GREEN" "$C_OFF" \
                        || { printf '  %-24s %s%s%s\n' "gateway /healthz" "$C_RED" "${code:-ERR}" "$C_OFF"; failed=1; }
    return $failed
}

cmd_health() {
    command -v curl >/dev/null 2>&1 || die "未安装 curl,无法探活"
    local rc=0
    if [ "$MODE" = "s7" ]; then health_via_exec || rc=1; else health_via_host || rc=1; fi
    if [ "$rc" -eq 0 ]; then
        ok "全部探活通过"
    else
        fail "存在未通过项(容器刚起可等 10~30 秒重试,或用 logs 子命令看日志)"
        return 1
    fi
}

print_endpoints() {
    echo
    if [ "$MODE" = "s7" ]; then
        echo "  S7 网关      http://127.0.0.1:${S7_GATEWAY_PORT}  (仅本机可达,业务服务与数据库不出网)"
        echo "  容器前缀      ${S7_PROJECT}-<服务名>-1"
        echo "  探活          ./mtrip.sh health --s7"
    else
        echo "  网关入口      http://localhost:$(env_get GATEWAY_HOST_PORT 8081)   (/api/v1/{admin,app,merchant,supplier}/*)"
        echo "  前端(静态)   admin http://localhost:$(env_get ADMIN_WEB_PORT 8090)  merchant :$(env_get MERCHANT_WEB_PORT 8091)  supplier :$(env_get SUPPLIER_WEB_PORT 8092)  client(H5) :$(env_get CLIENT_WEB_PORT 8093)"
        echo "  微服务直连    9501~9508  system/user/goods/order/merchant/finance/marketing/payment"
        echo "  APP 孪生池    system/user/goods/order/marketing-service-app(无宿主端口,/app/* 走此)"
        echo "  MySQL         localhost:$(env_get MYSQL_HOST_PORT 3307)    Redis  localhost:$(env_get REDIS_HOST_PORT 6380)"
        echo "  上传目录      deploy/uploads(merchant-service 写 / gateway 读)"
        echo "  探活          ./mtrip.sh health"
    fi
    echo
}

usage() {
    cat <<'EOF'
Mtrip 服务启停脚本

用法:
  ./mtrip.sh <命令> [服务名...] [--prod|--s7]

命令:
  start [服务名...]    启动(up -d),不重建镜像;缺 .env 时自动从 .env.example 生成
  build [服务名...]    重建镜像并启动(up -d --build);改 Dockerfile / 新增 composer 依赖时用
  restart [服务名...]  热重启(restart);只改 PHP 代码时用,约 2 秒/个
  stop [服务名...]     停止容器,保留容器与数据
  down                 删除容器与网络,保留数据卷(数据不丢)
  clean                删除容器与数据卷(数据库清空,需确认)
  status               容器状态(ps)
  logs [服务名...]     跟踪日志(-f --tail=100)
  health               8 个微服务 healthz + 网关链路探活;全通过退 0,有失败退 1
  help                 显示本帮助

模式:
  (默认)              docker-compose.yml + override,开发热挂载,网关 8081
  --prod               只用 docker-compose.yml,不挂本地源码(改代码须 build)
  --s7                 隔离验收栈,等价 scripts/s7-environment.ps1:
                       project mtrip-s7 / s7.env.example / 不加载 override 与 .env /
                       网关仅 127.0.0.1:8181 / 只用预构建镜像(不 build 不 pull)

环境变量:
  MTRIP_YES=1          clean 跳过交互确认(慎用)

服务名:
  system-service user-service goods-service order-service
  merchant-service finance-service marketing-service payment-service
  mysql redis gateway
  # APP 孪生池(/api/v1/app/* 上游,重启不影响管理端):
  system-service-app user-service-app goods-service-app
  order-service-app marketing-service-app

示例:
  ./mtrip.sh start                      # 启动全部(开发栈)
  ./mtrip.sh restart goods-service      # 改完 PHP 代码热重启单个服务
  ./mtrip.sh build user-service         # 改了 Dockerfile / composer 依赖
  ./mtrip.sh logs order-service         # 跟踪单服务日志
  ./mtrip.sh health                     # 部署后验证
  ./mtrip.sh start --s7                 # 启动隔离验收栈(需先在默认栈 build 出镜像)
  ./mtrip.sh stop --s7                  # 停止验收栈(保留卷与留痕)
  MTRIP_YES=1 ./mtrip.sh clean          # 免交互清库重建(慎用)
EOF
}

# ---------- 入口 ----------
main() {
    local cmd="${1:-help}"
    [ $# -gt 0 ] && shift
    case "$cmd" in help|-h|--help) usage; return 0 ;; esac

    detect_compose
    validate_services "$@"

    case "$cmd" in
        start)     cmd_start "$@" ;;
        build)     cmd_build "$@" ;;
        restart)   cmd_restart "$@" ;;
        stop)      cmd_stop "$@" ;;
        down)      cmd_down ;;
        clean)     cmd_clean ;;
        status|ps) cmd_status ;;
        logs)      cmd_logs "$@" ;;
        health)    cmd_health ;;
        *)         fail "未知命令:$cmd"; echo; usage; return 1 ;;
    esac
}

main "$@"
