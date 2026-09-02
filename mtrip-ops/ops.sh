#!/usr/bin/env bash
#
# Mtrip Ops 启停脚本(非 systemd 场景;用 systemd 时见 systemd/mtrip-ops.service.example)
# ---------------------------------------------------------------------------
# 用法:
#   ./ops.sh start      后台启动(nohup),pid -> data/ops.pid,输出 -> data/ops.log
#   ./ops.sh stop       优雅停止(TERM),超时未退再 KILL
#   ./ops.sh restart    stop + start
#   ./ops.sh status     进程存活 / 端口监听 / 访问地址
#   ./ops.sh logs       tail -f 启动日志(首次启动的初始管理员密码在这里面)
#
# 环境变量:
#   NODE                node 可执行路径(默认 node)
#   MTRIP_OPS_CONFIG    配置文件路径(默认 ./ops.config.json)
#   MTRIP_OPS_HOST      覆盖监听地址
#   MTRIP_OPS_PORT      覆盖监听端口
#   STOP_TIMEOUT        stop 等待优雅退出的秒数(默认 10)
#
# 注:pid 与日志都落在 data/,该目录 .gitignore 为 `*`,不会进 Git。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR" || exit 1

NODE="${NODE:-node}"
DATA_DIR="$APP_DIR/data"
PID_FILE="$DATA_DIR/ops.pid"
LOG_FILE="$DATA_DIR/ops.log"
CONFIG_FILE="${MTRIP_OPS_CONFIG:-$APP_DIR/ops.config.json}"
STOP_TIMEOUT="${STOP_TIMEOUT:-10}"

# ---------- 输出 ----------
if [ -t 1 ]; then
    C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'; C_OFF=$'\033[0m'
else
    C_RED=''; C_GREEN=''; C_YELLOW=''; C_CYAN=''; C_OFF=''
fi
info() { echo "${C_CYAN}==>${C_OFF} $*"; }
ok()   { echo "${C_GREEN}[OK]${C_OFF} $*"; }
warn() { echo "${C_YELLOW}[WARN]${C_OFF} $*"; }
fail() { echo "${C_RED}[FAIL]${C_OFF} $*" >&2; }
die()  { fail "$*"; exit 1; }

# ---------- 环境检查 ----------
check_node() {
    command -v "$NODE" >/dev/null 2>&1 || die "未找到 node($NODE)。用 NODE=/path/to/node 指定,或先安装 Node.js 20+"
    local major
    major="$("$NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
    [ -n "$major" ] || die "无法获取 node 版本"
    # package.json engines 要求 >=20
    [ "$major" -ge 20 ] 2>/dev/null || die "需要 Node.js 20 或更高,当前为 $("$NODE" -v)"
}

# 从配置文件读 host/port(交给 node 解析 JSON,不手写解析);环境变量优先
read_endpoint() {
    local parsed host port
    parsed="$("$NODE" -e '
        const fs = require("node:fs");
        let cfg = {};
        try { cfg = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch {}
        process.stdout.write(`${cfg.host || "127.0.0.1"} ${cfg.port || 56700}`);
    ' "$CONFIG_FILE" 2>/dev/null)" || parsed="127.0.0.1 56700"
    host="${parsed%% *}"; port="${parsed##* }"
    HOST="${MTRIP_OPS_HOST:-$host}"
    PORT="${MTRIP_OPS_PORT:-$port}"
}

# 读取 pid 并确认该进程确实是本应用(防 pid 复用后误杀无关进程)
running_pid() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null)"
    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    kill -0 "$pid" 2>/dev/null || return 1
    # 校验命令行确实包含本应用入口,否则视为陈旧 pid
    if ! tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q 'src/server.js'; then
        return 1
    fi
    echo "$pid"
}

# ---------- 子命令 ----------
cmd_start() {
    check_node
    read_endpoint

    local pid
    if pid="$(running_pid)"; then
        warn "Mtrip Ops 已在运行(pid $pid),未重复启动。如需重启用:./ops.sh restart"
        return 0
    fi
    # 到这里说明没在跑;若 pid 文件还在,是上次异常退出留下的陈旧文件
    [ -f "$PID_FILE" ] && rm -f "$PID_FILE"

    [ -f "$CONFIG_FILE" ] || warn "配置文件不存在:$CONFIG_FILE(将使用内置默认值)"
    mkdir -p "$DATA_DIR" || die "无法创建 $DATA_DIR"

    info "启动 Mtrip Ops ..."
    MTRIP_OPS_CONFIG="$CONFIG_FILE" \
    MTRIP_OPS_HOST="$HOST" \
    MTRIP_OPS_PORT="$PORT" \
    nohup "$NODE" src/server.js >>"$LOG_FILE" 2>&1 &
    local new_pid=$!
    echo "$new_pid" > "$PID_FILE"

    # 等待就绪:进程还活着且端口已监听
    local i
    for i in $(seq 1 25); do
        if ! kill -0 "$new_pid" 2>/dev/null; then
            fail "进程启动后立即退出,日志尾部:"
            tail -n 20 "$LOG_FILE" >&2
            rm -f "$PID_FILE"
            return 1
        fi
        if "$NODE" -e '
            const net = require("node:net");
            const s = net.connect(Number(process.argv[2]), process.argv[1]);
            s.on("connect", () => { s.destroy(); process.exit(0); });
            s.on("error", () => process.exit(1));
        ' "$HOST" "$PORT" 2>/dev/null; then
            ok "已启动(pid $new_pid) → http://$HOST:$PORT"
            # 首次初始化时随机管理员密码只打印一次,这里主动提示去哪儿看
            if grep -q '首次初始化' "$LOG_FILE" 2>/dev/null; then
                echo
                warn "检测到首次初始化,初始管理员密码在启动日志中(只显示这一次):"
                grep -A4 '首次初始化' "$LOG_FILE" | tail -n 5
                echo
            fi
            return 0
        fi
        sleep 0.2
    done

    warn "进程在运行(pid $new_pid),但 $HOST:$PORT 5 秒内未就绪。日志尾部:"
    tail -n 20 "$LOG_FILE"
    return 1
}

cmd_stop() {
    local pid
    if ! pid="$(running_pid)"; then
        warn "Mtrip Ops 未在运行"
        [ -f "$PID_FILE" ] && rm -f "$PID_FILE" && info "已清理陈旧 pid 文件"
        return 0
    fi

    info "停止 Mtrip Ops(pid $pid),优雅等待最多 ${STOP_TIMEOUT}s ..."
    kill -TERM "$pid" 2>/dev/null

    local i
    for i in $(seq 1 $((STOP_TIMEOUT * 5))); do
        kill -0 "$pid" 2>/dev/null || { rm -f "$PID_FILE"; ok "已停止"; return 0; }
        sleep 0.2
    done

    warn "${STOP_TIMEOUT}s 内未退出,发送 KILL"
    kill -KILL "$pid" 2>/dev/null
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
        fail "无法结束进程 $pid,请手动处理"
        return 1
    fi
    rm -f "$PID_FILE"
    ok "已强制停止"
}

cmd_status() {
    read_endpoint
    local pid
    if pid="$(running_pid)"; then
        ok "运行中(pid $pid)"
        echo "  访问地址   http://$HOST:$PORT"
        echo "  配置文件   $CONFIG_FILE"
        echo "  启动日志   $LOG_FILE"
        if "$NODE" -e '
            const net = require("node:net");
            const s = net.connect(Number(process.argv[2]), process.argv[1]);
            s.on("connect", () => { s.destroy(); process.exit(0); });
            s.on("error", () => process.exit(1));
        ' "$HOST" "$PORT" 2>/dev/null; then
            echo "  端口监听   正常"
        else
            warn "  端口监听   $HOST:$PORT 未响应(进程在但未监听?查看日志)"
        fi
        return 0
    fi
    warn "未运行"
    [ -f "$PID_FILE" ] && echo "  存在陈旧 pid 文件:$PID_FILE(下次 start 会自动清理)"
    return 1
}

cmd_logs() {
    [ -f "$LOG_FILE" ] || die "日志文件不存在:$LOG_FILE(尚未启动过?)"
    tail -f -n 100 "$LOG_FILE"
}

usage() {
    sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
    start)    cmd_start ;;
    stop)     cmd_stop ;;
    restart)  cmd_stop && cmd_start ;;
    status)   cmd_status ;;
    logs)     cmd_logs ;;
    -h|--help|help|'') usage ;;
    *)        fail "未知命令:$1"; echo; usage; exit 1 ;;
esac
