#!/usr/bin/env bash
#
# Mtrip 自动化部署:拉取当前分支 → 按「哪个项目变了」精准重构建/重启。
# ------------------------------------------------------------------
# 设计目标(与 deploy/docker-compose.app-pool.yml 的双实例池配套):
#   - 前端(admin/merchant/supplier)有变更 → npm run build → 原子替换 deploy/web/<web>/
#   - 后端服务有变更 → 经 deploy/mtrip.sh 精准重启
#       * 改动【全部落在 Controller/{Admin,Merchant,Supplier}】→ 只重启主池,APP 池零打断
#       * 触碰 Controller/App 或服务共享代码(Model/Service/Middleware/config)或 backend/shared
#         → 视为波及 APP,【同步重启 <svc>-app 孪生】并高亮原因(正确性优先)
#   - 网关配置(deploy/openresty/**)有变更 → 重启网关
#   - database/**.sql 有变更 → 只告警不自动执行(DDL 危险),提示用 scripts/db-apply.sh
#   - .env / docker-compose*.yml / Dockerfile / composer.* → 需重建镜像,改用 mtrip.sh build
#
# 安全策略(ff-only):工作区必须干净;只允许快进合并;分叉或有本地改动即中止,绝不覆盖。
#
# 用法:
#   scripts/auto-deploy.sh [--dry-run] [--branch <name>] [--apply-db] [--no-app-sync] [--prod]
#
# cron 示例(每 5 分钟,避开整点):
#   3,8,13,18,23,28,33,38,43,48,53,58 * * * * cd /path/to/MTrip && \
#     scripts/auto-deploy.sh >> /var/log/mtrip-deploy.log 2>&1
#
# 环境变量:
#   DOCKER   docker 命令(无权限时设 "sudo docker",会透传给 mtrip.sh)
#   NPM      npm 命令(默认 npm)

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail

# ---------- 参数 ----------
DRY_RUN=0
APPLY_DB=0
NO_APP_SYNC=0
PROD=0
BRANCH_OVERRIDE=""
prev=""
for arg in "$@"; do
    case "$arg" in
        --dry-run)     DRY_RUN=1 ;;
        --apply-db)    APPLY_DB=1 ;;
        --no-app-sync) NO_APP_SYNC=1 ;;
        --prod)        PROD=1 ;;
        --branch=*)    BRANCH_OVERRIDE="${arg#*=}" ;;
        -h|--help)     grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *)             [ "$prev" = "--branch" ] && BRANCH_OVERRIDE="$arg" ;;  # 兼容 --branch xxx
    esac
    prev="$arg"
done

# ---------- 常量 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1
MTRIP="$REPO_ROOT/deploy/mtrip.sh"
DOCKER="${DOCKER:-docker}"
NPM="${NPM:-npm}"
LOCK_FILE="/tmp/mtrip-auto-deploy.lock"

# 前端项目 -> 静态发布目录(网关挂载源)
FE_WEBS="admin-web merchant-web supplier-web"
# 同时服务管理端与 APP 端的共享服务(有 -app 孪生)
APP_SERVING="system-service user-service goods-service order-service marketing-service"

# mtrip.sh 模式透传
MODE_FLAG=""
[ "$PROD" -eq 1 ] && MODE_FLAG="--prod"

# ---------- 输出 ----------
if [ -t 1 ]; then
    C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'; C_OFF=$'\033[0m'
else
    C_RED=''; C_GREEN=''; C_YELLOW=''; C_CYAN=''; C_OFF=''
fi
ts()    { date '+%Y-%m-%d %H:%M:%S'; }
info()  { echo "${C_CYAN}[$(ts)] ==>${C_OFF} $*"; }
ok()    { echo "${C_GREEN}[$(ts)] [OK]${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}[$(ts)] [WARN]${C_OFF} $*"; }
fail()  { echo "${C_RED}[$(ts)] [FAIL]${C_OFF} $*" >&2; }
die()   { fail "$*"; exit 1; }

# ---------- 单实例锁(防 cron 叠跑) ----------
exec 9>"$LOCK_FILE" || die "无法打开锁文件 $LOCK_FILE"
if ! flock -n 9; then
    warn "已有一个 auto-deploy 在运行(锁 $LOCK_FILE),本次跳过"
    exit 0
fi

# ---------- 前置检查 ----------
command -v git >/dev/null 2>&1 || die "未安装 git"
git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$REPO_ROOT" \
    || git config --global --add safe.directory "$REPO_ROOT" 2>/dev/null || true

CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
BRANCH="${BRANCH_OVERRIDE:-$CUR_BRANCH}"
[ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ] || die "无法确定当前分支(HEAD 游离?),请用 --branch 指定并先 checkout"
# ff-only 只能把「当前所在分支」快进到其远端;--branch 必须与当前分支一致,否则要求先 checkout
if [ "$BRANCH" != "$CUR_BRANCH" ]; then
    die "当前分支是 $CUR_BRANCH,但要求部署 $BRANCH。请先 git checkout $BRANCH 再运行(ff-only 不跨分支合并)"
fi
info "目标分支:$BRANCH  仓库:$REPO_ROOT  模式:${MODE_FLAG:-dev}  dry-run:$DRY_RUN"

# 工作区必须干净(ff-only 前提,绝不覆盖本地改动)
if [ -n "$(git status --porcelain)" ]; then
    fail "工作区有未提交改动,按 ff-only 策略中止(避免覆盖本地)。清理后重试:"
    git status --short >&2
    exit 1
fi

# ---------- 拉取(fetch + 判断是否落后 + 快进) ----------
info "git fetch origin $BRANCH ..."
git fetch --quiet origin "$BRANCH" || die "git fetch 失败"

if ! git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
    die "远端不存在 origin/$BRANCH"
fi
AHEAD="$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo 0)"
BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)"

if [ "$AHEAD" -gt 0 ]; then
    die "本地领先/分叉 origin/$BRANCH 共 $AHEAD 个提交,ff-only 无法处理,请人工核对(绝不 reset)"
fi
if [ "$BEHIND" -eq 0 ]; then
    ok "已是最新(落后 0 个提交),无需部署"
    exit 0
fi
info "落后 $BEHIND 个提交,开始快进合并"

BEFORE="$(git rev-parse HEAD)"
if [ "$DRY_RUN" -eq 1 ]; then
    info "[dry-run] 跳过实际 merge,用 origin/$BRANCH 作为变更范围终点"
    AFTER="$(git rev-parse "origin/$BRANCH")"
else
    git merge --ff-only "origin/$BRANCH" || die "快进合并失败(可能已分叉)"
    AFTER="$(git rev-parse HEAD)"
    ok "已快进:$(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$AFTER")"
fi

# ---------- 变更文件清单 ----------
CHANGED="$(git diff --name-only "$BEFORE" "$AFTER")"
[ -n "$CHANGED" ] || { ok "无文件差异,结束"; exit 0; }
info "本次变更 $(echo "$CHANGED" | wc -l | tr -d ' ') 个文件"

# ---------- 分类(累积到集合) ----------
FE_BUILD=""        # 待构建前端(admin-web ...)
MAIN_RESTART=""    # 待重启主池服务
APP_RESTART=""     # 待重启 APP 孪生
REBUILD=""         # 待 build(镜像重建)的服务
GATEWAY_ACTION=""  # ""|restart
DB_FILES=""
NOTE_MOBILE=0
NEED_STACK_UP=0    # .env / compose 变更 -> 需 mtrip.sh start/build 重建容器

add() { case " $2 " in *" $1 "*) : ;; *) eval "$3=\"\${$3} $1\"";; esac; }  # 去重追加:add <item> "$SET" SETVAR

# 该 svc 的本次改动是否波及 APP(命中非 Admin/Merchant/Supplier 控制器的任何文件)
svc_touches_app() {
    local svc="$1" f
    while IFS= read -r f; do
        case "$f" in
            backend/services/"$svc"/*) ;;
            *) continue ;;
        esac
        case "$f" in
            backend/services/"$svc"/app/Controller/Admin/*|\
            backend/services/"$svc"/app/Controller/Merchant/*|\
            backend/services/"$svc"/app/Controller/Supplier/*) ;;  # 纯管理端,不算
            *) return 0 ;;  # App 控制器 or Model/Service/Middleware/config 等共享代码
        esac
    done <<< "$CHANGED"
    return 1
}
is_app_serving() { case " $APP_SERVING " in *" $1 "*) return 0 ;; esac; return 1; }

while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
        admin-web/*)     add admin-web    "$FE_BUILD" FE_BUILD ;;
        merchant-web/*)  add merchant-web "$FE_BUILD" FE_BUILD ;;
        supplier-web/*)  add supplier-web "$FE_BUILD" FE_BUILD ;;
        client-app/*)    NOTE_MOBILE=1 ;;

        backend/shared/*)
            # 影响所有业务服务 + 所有孪生
            for s in system-service user-service goods-service order-service \
                     merchant-service finance-service marketing-service payment-service; do
                add "$s" "$MAIN_RESTART" MAIN_RESTART
            done
            for s in $APP_SERVING; do add "${s}-app" "$APP_RESTART" APP_RESTART; done
            case "$f" in backend/shared/composer.*) REBUILD="$MAIN_RESTART $APP_RESTART";; esac
            ;;

        backend/services/*/Dockerfile|backend/services/*/composer.json|backend/services/*/composer.lock)
            s="$(echo "$f" | awk -F/ '{print $3}')"
            add "$s" "$REBUILD" REBUILD
            is_app_serving "$s" && add "${s}-app" "$REBUILD" REBUILD
            ;;

        backend/services/*)
            s="$(echo "$f" | awk -F/ '{print $3}')"
            add "$s" "$MAIN_RESTART" MAIN_RESTART
            if is_app_serving "$s"; then
                if svc_touches_app "$s"; then
                    add "${s}-app" "$APP_RESTART" APP_RESTART
                fi
            fi
            ;;

        deploy/openresty/*)   GATEWAY_ACTION="restart" ;;
        deploy/.env|deploy/docker-compose*.yml) NEED_STACK_UP=1 ;;
        database/*.sql)       DB_FILES="$DB_FILES $f" ;;
        *) : ;;  # 其余(docs、脚本、UI 设计稿等)不触发部署动作
    esac
done <<< "$CHANGED"

# 去重后,凡进入 REBUILD 的服务从 restart 集合剔除(build 已含重启)
prune_rebuilt() {
    local kept="" x
    for x in $1; do case " $REBUILD " in *" $x "*) : ;; *) kept="$kept $x";; esac; done
    echo "$kept"
}
MAIN_RESTART="$(prune_rebuilt "$MAIN_RESTART")"
APP_RESTART="$(prune_rebuilt "$APP_RESTART")"

# --no-app-sync:强制不动 APP 孪生,但打印风险
SKIPPED_APP=""
if [ "$NO_APP_SYNC" -eq 1 ] && [ -n "$(echo "$APP_RESTART$REBUILD" | grep -o -- '-app' || true)" ]; then
    SKIPPED_APP="$APP_RESTART"
    APP_RESTART=""
fi

# ---------- 决策摘要 ----------
echo
info "===== 部署决策 ====="
echo "  前端构建     :${FE_BUILD:- (无)}"
echo "  主池重启     :${MAIN_RESTART:- (无)}"
echo "  APP 孪生重启 :${APP_RESTART:- (无)}"
echo "  镜像重建     :${REBUILD:- (无)}"
echo "  网关动作     :${GATEWAY_ACTION:- (无)}"
[ "$NEED_STACK_UP" -eq 1 ] && echo "  ${C_YELLOW}.env/compose 变更:需 ./mtrip.sh build 或 start 重建容器(本脚本不自动执行)${C_OFF}"
[ -n "$DB_FILES" ] && echo "  ${C_YELLOW}DB 变更(不自动执行):$DB_FILES${C_OFF}"
[ "$NOTE_MOBILE" -eq 1 ] && echo "  client-app(移动端)有变更:需单独 Expo 发版,本脚本跳过"
if [ -n "$SKIPPED_APP" ]; then
    warn "--no-app-sync:跳过 APP 孪生重启 [$SKIPPED_APP]"
    warn "  风险:APP 池仍跑旧代码;若本次共享代码/接口不兼容,/api/v1/app/* 可能报错。请尽快手动同步。"
fi
echo

# ---------- APP 相关性提示(用户核心诉求) ----------
if [ -n "$APP_RESTART" ] || [ -n "$(echo "$REBUILD" | grep -o -- '-app' || true)" ]; then
    warn "检测到【波及 APP 端】的后端改动(命中 Controller/App 或共享代码/backend/shared),已纳入 APP 孪生同步。"
fi

# ---------- dry-run:到此为止 ----------
if [ "$DRY_RUN" -eq 1 ]; then
    info "[dry-run] 仅打印决策,不执行任何构建/重启/合并"
    exit 0
fi

FAILED=0

# ---------- 执行:前端构建 + 原子发布 ----------
publish_web() {
    local web="$1" src="$REPO_ROOT/$1/dist" dst="$REPO_ROOT/deploy/web/${1%-web}"
    info "构建前端 $web ..."
    ( cd "$REPO_ROOT/$web" || exit 1
      if echo "$CHANGED" | grep -qE "^$web/(package-lock\.json|package\.json)$"; then
          info "  依赖清单变更,$NPM ci"; $NPM ci || exit 2
      fi
      $NPM run build ) || { fail "$web 构建失败,保留旧产物不发布"; FAILED=1; return 1; }
    [ -f "$src/index.html" ] || { fail "$web 构建产物缺 index.html,跳过发布"; FAILED=1; return 1; }
    mkdir -p "$dst"
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --delete "$src/" "$dst/" || { fail "$web 发布(rsync)失败"; FAILED=1; return 1; }
    else
        rm -rf "${dst:?}/"* && cp -r "$src/." "$dst/" || { fail "$web 发布(cp)失败"; FAILED=1; return 1; }
    fi
    ok "$web 已发布 -> deploy/web/${1%-web}/"
}
for web in $FE_BUILD; do publish_web "$web"; done

# ---------- 执行:后端 build / restart ----------
run_mtrip() {
    info "mtrip.sh $*"
    DOCKER="$DOCKER" bash "$MTRIP" "$@" ${MODE_FLAG:+$MODE_FLAG} || { fail "mtrip.sh $* 失败"; FAILED=1; }
}
[ -n "$REBUILD" ]      && run_mtrip build $REBUILD
[ -n "$MAIN_RESTART" ] && run_mtrip restart $MAIN_RESTART
[ -n "$APP_RESTART" ]  && run_mtrip restart $APP_RESTART

# ---------- 执行:网关 ----------
if [ "$GATEWAY_ACTION" = "restart" ]; then
    run_mtrip restart gateway
fi

# ---------- DB 变更:仅告警(除非 --apply-db) ----------
if [ -n "$DB_FILES" ]; then
    if [ "$APPLY_DB" -eq 1 ]; then
        warn "--apply-db:执行 SQL 增量(确保脚本幂等!)"
        # shellcheck disable=SC2086
        bash "$REPO_ROOT/scripts/db-apply.sh" $DB_FILES || { fail "db-apply 失败"; FAILED=1; }
    else
        warn "database 变更未自动执行。人工确认后运行:scripts/db-apply.sh$DB_FILES"
    fi
fi

# ---------- 结尾摘要 ----------
echo
if [ "$FAILED" -eq 0 ]; then
    ok "自动部署完成:前端[${FE_BUILD:-无}] 主池[${MAIN_RESTART:-无}] APP孪生[${APP_RESTART:-无}] 重建[${REBUILD:-无}] 网关[${GATEWAY_ACTION:-无}]"
    exit 0
else
    fail "自动部署存在失败项,请查看上方日志"
    exit 1
fi
