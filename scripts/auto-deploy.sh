#!/usr/bin/env bash
#
# Mtrip 自动化部署:拉取当前分支 → 按「哪个项目变了」精准重构建/重启。
# ------------------------------------------------------------------
# 设计目标(与 deploy/docker-compose.app-pool.yml 的双实例池配套):
#   - 前端(admin/merchant/supplier)有变更 → npm run build → 原子替换 deploy/web/<web>/
#   - 移动端 client-app 有变更 → npm run build:web(Expo web export)→ 原子替换 deploy/web/client/
#       * 只发 【H5 网页版】。iOS/Android 的 EAS build 与商店提审【刻意不做】:
#         提审是不可回退的对外动作,不适合放进 cron 自动流程,仍走人工。
#   - 后端服务有变更 → 经 deploy/mtrip.sh 精准重启
#       * 改动【全部落在 Controller/{Admin,Merchant,Supplier}】→ 只重启主池,APP 池零打断
#       * 触碰 Controller/App 或服务共享代码(Model/Service/Middleware/config)或 backend/shared
#         → 视为波及 APP,【同步重启 <svc>-app 孪生】并高亮原因(正确性优先)
#   - 网关配置(deploy/openresty/**)有变更 → 重启网关
#   - 生产模式每次拉取后对比 schema_migrations,先执行 database/migrations/ 的待执行版本
#       * 新迁移必须命名 VYYYYMMDDHHMMSS__lower-kebab.sql,成功后记录 SHA-256/Git/执行节点/耗时
#       * 历史版本被改写、删除、重号或上次执行失败时立即阻断发布
#   - .env / docker-compose*.yml / Dockerfile / composer.* → 需重建镜像,改用 mtrip.sh build
#
# 安全策略(ff-only):工作区必须干净;只允许快进合并;分叉或有本地改动即中止,绝不覆盖。
#
# 用法:
#   scripts/auto-deploy.sh [--dry-run] [--branch <name>] [--apply-db|--skip-db] [--no-app-sync] [--prod]
#   scripts/auto-deploy.sh [--dry-run] <target> [target...]
#
# 强制发布 target(跳过 fetch/merge/变更判断,也不要求工作区干净):
#   admin-web|merchant-web|supplier-web  直接构建并发布静态文件
#   client-app|client|h5                 直接构建并发布移动端 H5 到 deploy/web/client/
#   system-service|user-service|...      直接重启对应后端主池服务
#   system-service-app|user-service-app  直接重启 APP 孪生服务
#   gateway|openresty                    直接重启网关
#   database|db|mysql                    立即对比并执行待执行迁移
#   (mobile|native 不是有效目标,只会提示「原生发版走人工 EAS」)
#
# 示例:
#   scripts/auto-deploy.sh admin-web
#   scripts/auto-deploy.sh client-app
#   scripts/auto-deploy.sh goods-service goods-service-app gateway
#
# cron 示例(每 5 分钟,避开整点):
#   3,8,13,18,23,28,33,38,43,48,53,58 * * * * cd /path/to/MTrip && \
#     scripts/auto-deploy.sh --prod >> /var/log/mtrip-deploy.log 2>&1
#
# 环境变量:
#   DOCKER   docker 命令(无权限时设 "sudo docker",会透传给 mtrip.sh)
#   NPM      npm 命令(默认 npm)
#   MYSQL_CONTAINER / MYSQL_ROOT_PASSWORD / MYSQL_MIGRATION_LOCK_TIMEOUT  迁移连接配置
#   MTRIP_DEPLOY_STATE_FILE  上次完整发布成功的 commit 记录(默认 .git/mtrip-last-successful-deploy)

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail

# ---------- 参数 ----------
DRY_RUN=0
APPLY_DB=0
SKIP_DB=0
NO_APP_SYNC=0
PROD=0
BRANCH_OVERRIDE=""
FORCE_TARGETS=""
prev=""
for arg in "$@"; do
    case "$arg" in
        --dry-run)     DRY_RUN=1 ;;
        --apply-db)    APPLY_DB=1 ;;
        --skip-db)     SKIP_DB=1 ;;
        --no-app-sync) NO_APP_SYNC=1 ;;
        --prod)        PROD=1 ;;
        --branch)      : ;;
        --branch=*)    BRANCH_OVERRIDE="${arg#*=}" ;;
        -h|--help)     grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *)
            if [ "$prev" = "--branch" ]; then
                BRANCH_OVERRIDE="$arg"  # 兼容 --branch xxx
            else
                FORCE_TARGETS="$FORCE_TARGETS $arg"
            fi
            ;;
    esac
    prev="$arg"
done

[ "$APPLY_DB" -eq 0 ] || [ "$SKIP_DB" -eq 0 ] || { echo "--apply-db 与 --skip-db 不能同时使用" >&2; exit 2; }
# 生产发布默认先迁移；--skip-db 仅用于已由外部 DBA 流程完成迁移的应急场景。
[ "$PROD" -eq 0 ] || [ "$SKIP_DB" -eq 1 ] || APPLY_DB=1

# ---------- 常量 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1
MTRIP="$REPO_ROOT/deploy/mtrip.sh"
DOCKER="${DOCKER:-docker}"
NPM="${NPM:-npm}"
LOCK_FILE="/tmp/mtrip-auto-deploy.lock"
DEPLOY_STATE_FILE="${MTRIP_DEPLOY_STATE_FILE:-$REPO_ROOT/.git/mtrip-last-successful-deploy}"

# 前端工程清单(含移动端 H5)。发布目录与构建脚本由下面两个映射函数给出。
FE_WEBS="admin-web merchant-web supplier-web client-app"

# 工程名 -> deploy/web/ 下的发布目录名(网关挂载源,见 docker-compose.yml)
# 三个管理端是 <名>-web 去掉后缀;client-app 的目录刻意叫 client(与网关 root 一致)
web_dist_dir() {
    case "$1" in
        client-app) echo "client" ;;
        *)          echo "${1%-web}" ;;
    esac
}

# 工程名 -> package.json 里的构建脚本名
# client-app 用 build:web(= expo export -p web),刻意不叫 build 以免与原生 EAS build 混淆
web_build_script() {
    case "$1" in
        client-app) echo "build:web" ;;
        *)          echo "build" ;;
    esac
}
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

# 工作区洁净判断(排除 deploy/web —— 那是【发布目标】不是源码)
# 为什么必须排除:deploy/web/<app>/index.html 占位页是被 git 跟踪的,
# 每次发布都会被构建产物覆盖 → git status 永远非空 → 下面的 ff-only 洁净门禁
# 会从「第一次发布之后」开始把每一次 cron 自动部署都判为脏工作区而中止。
workspace_status() { git status --porcelain -- . ':!deploy/web' 2>/dev/null; }

CHANGED=""
if [ -n "$FORCE_TARGETS" ]; then
    info "强制发布目标:$FORCE_TARGETS  仓库:$REPO_ROOT  模式:${MODE_FLAG:-dev}  dry-run:$DRY_RUN"
    warn "强制发布模式:跳过 git fetch/merge/落后检查,直接使用当前工作区内容"
    if [ -n "$(workspace_status)" ]; then
        warn "当前工作区有未提交改动;强制发布会把这些本地内容一并用于构建/重启:"
        workspace_status
    fi
else
    CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
    BRANCH="${BRANCH_OVERRIDE:-$CUR_BRANCH}"
    [ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ] || die "无法确定当前分支(HEAD 游离?),请用 --branch 指定并先 checkout"
    # ff-only 只能把「当前所在分支」快进到其远端;--branch 必须与当前分支一致,否则要求先 checkout
    if [ "$BRANCH" != "$CUR_BRANCH" ]; then
        die "当前分支是 $CUR_BRANCH,但要求部署 $BRANCH。请先 git checkout $BRANCH 再运行(ff-only 不跨分支合并)"
    fi
    info "目标分支:$BRANCH  仓库:$REPO_ROOT  模式:${MODE_FLAG:-dev}  dry-run:$DRY_RUN"

    # 工作区必须干净(ff-only 前提,绝不覆盖本地改动;deploy/web 发布产物不算)
    if [ -n "$(workspace_status)" ]; then
        fail "工作区有未提交改动,按 ff-only 策略中止(避免覆盖本地)。清理后重试:"
        workspace_status >&2
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
    BEFORE="$(git rev-parse HEAD)"
    if [ "$BEHIND" -eq 0 ]; then
        AFTER="$BEFORE"
        info "代码已是最新；检查上次成功发布点与数据库迁移账本"
    else
        info "落后 $BEHIND 个提交,开始快进合并"
        if [ "$DRY_RUN" -eq 1 ]; then
            info "[dry-run] 跳过实际 merge,用 origin/$BRANCH 作为变更范围终点"
            AFTER="$(git rev-parse "origin/$BRANCH")"
        else
            git merge --ff-only "origin/$BRANCH" || die "快进合并失败(可能已分叉)"
            AFTER="$(git rev-parse HEAD)"
            ok "已快进:$(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$AFTER")"
        fi
    fi

    # ---------- 变更文件清单 ----------
    # Git 快进不等于发布成功。迁移/构建失败时不推进此标记，下次 cron 仍会重放发布动作。
    DIFF_BASE="$BEFORE"
    if [ -f "$DEPLOY_STATE_FILE" ]; then
        IFS= read -r LAST_DEPLOYED < "$DEPLOY_STATE_FILE" || true
        [[ "${LAST_DEPLOYED:-}" =~ ^[0-9a-f]{40}$ ]] || die "发布状态文件损坏: $DEPLOY_STATE_FILE"
        git rev-parse --verify --quiet "${LAST_DEPLOYED}^{commit}" >/dev/null \
            || die "发布状态记录的 commit 不存在: $LAST_DEPLOYED"
        git merge-base --is-ancestor "$LAST_DEPLOYED" "$AFTER" \
            || die "上次成功发布点不在目标提交祖先链上，请人工核对: $LAST_DEPLOYED"
        DIFF_BASE="$LAST_DEPLOYED"
    elif [ "$DRY_RUN" -eq 0 ]; then
        # 首次启用时先把拉取前的提交记为基线；即使本轮随后失败，下轮也不会丢失发布范围。
        state_dir="$(dirname "$DEPLOY_STATE_FILE")"
        state_tmp="${DEPLOY_STATE_FILE}.tmp.$$"
        mkdir -p "$state_dir" || die "无法创建发布状态目录: $state_dir"
        printf '%s\n' "$BEFORE" > "$state_tmp" \
            && mv -f "$state_tmp" "$DEPLOY_STATE_FILE" \
            || die "无法初始化发布成功点: $DEPLOY_STATE_FILE"
        ok "首次启用发布状态记录，基线: $(git rev-parse --short "$BEFORE")"
    fi
    CHANGED="$(git diff --name-only "$DIFF_BASE" "$AFTER")"
    if [ -n "$CHANGED" ]; then
        info "待发布范围 $(git rev-parse --short "$DIFF_BASE")..$(git rev-parse --short "$AFTER")，共 $(echo "$CHANGED" | wc -l | tr -d ' ') 个文件"
    elif [ "$APPLY_DB" -eq 0 ]; then
        ok "代码与上次成功发布点一致，无需部署"
        exit 0
    fi

    # 新增生产 SQL 必须进统一迁移目录；旧快照若同步修改，必须由同批版本迁移承载生产变更。
    MIGRATION_ORIGIN_VIOLATIONS="$(
        git diff --find-renames=50% --find-copies=50% --find-copies-harder --name-status \
            "$DIFF_BASE" "$AFTER" -- database \
        | awk -F '\t' '$1 ~ /^[RC][0-9]+$/ && $3 ~ /^database\/migrations\/.*\.sql$/ && $2 !~ /^database\/migrations\// { print $2 " -> " $3 }'
    )"
    [ -z "$MIGRATION_ORIGIN_VIOLATIONS" ] \
        || die "禁止将旧初始化快照 rename/copy 为生产迁移；请编写最小增量 SQL:$MIGRATION_ORIGIN_VIOLATIONS"

    NEW_DB_FILES="$(git diff --diff-filter=A --name-only "$DIFF_BASE" "$AFTER" | awk '/^database\/.*\.sql$/')"
    INVALID_NEW_DB=""
    while IFS= read -r f; do
        [ -n "$f" ] || continue
        case "$f" in
            database/migrations/*.sql|database/init/01-schema-migrations.sql) ;;
            *) INVALID_NEW_DB="$INVALID_NEW_DB $f" ;;
        esac
    done <<< "$NEW_DB_FILES"
    [ -z "$INVALID_NEW_DB" ] || die "新增 SQL 必须放 database/migrations/ 并使用 VYYYYMMDDHHMMSS__lower-kebab.sql:$INVALID_NEW_DB"

    NEW_VERSIONED_DB_FILES="$(printf '%s\n' "$NEW_DB_FILES" | awk '/^database\/migrations\/.*\.sql$/')"
    SNAPSHOT_DB_FILES="$(printf '%s\n' "$CHANGED" | awk '/^database\/.*\.sql$/ && !/^database\/migrations\//')"
    if printf '%s\n' "$NEW_DB_FILES" | grep -qxF 'database/init/01-schema-migrations.sql'; then
        SNAPSHOT_DB_FILES="$(printf '%s\n' "$SNAPSHOT_DB_FILES" | grep -vxF 'database/init/01-schema-migrations.sql' || true)"
    fi
    if [ -n "$SNAPSHOT_DB_FILES" ] && [ -z "$NEW_VERSIONED_DB_FILES" ]; then
        die "修改初始化快照 SQL 时必须同批新增 database/migrations/ 版本文件:$SNAPSHOT_DB_FILES"
    fi
fi

# ---------- 分类(累积到集合) ----------
FE_BUILD=""        # 待构建前端(admin-web ...)
MAIN_RESTART=""    # 待重启主池服务
APP_RESTART=""     # 待重启 APP 孪生
REBUILD=""         # 待 build(镜像重建)的服务
GATEWAY_ACTION=""  # ""|restart
DB_FILES=""
DB_REQUESTED=0
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

if [ -n "$FORCE_TARGETS" ]; then
    INVALID_TARGETS=""
    for target in $FORCE_TARGETS; do
        target="${target#./}"
        target="${target%/}"
        case "$target" in
            admin|admin-web)         add admin-web    "$FE_BUILD" FE_BUILD ;;
            merchant|merchant-web)   add merchant-web "$FE_BUILD" FE_BUILD ;;
            supplier|supplier-web)   add supplier-web "$FE_BUILD" FE_BUILD ;;
            gateway|openresty)       GATEWAY_ACTION="restart" ;;
            database|db|mysql)
                [ "$SKIP_DB" -eq 0 ] || die "$target 与 --skip-db 冲突"
                DB_REQUESTED=1
                APPLY_DB=1
                ;;
            client-app|client|h5)    add client-app "$FE_BUILD" FE_BUILD; NOTE_MOBILE=1 ;;
            mobile|native)
                warn "$target:iOS/Android 原生商店发版不在本脚本范围(需人工 EAS build + 提审)"
                warn "  若你要发的是 H5 网页版,请用:scripts/auto-deploy.sh client-app"
                ;;
            backend/services/*)
                s="${target#backend/services/}"
                s="${s%%/*}"
                if [ -d "$REPO_ROOT/backend/services/$s" ]; then
                    add "$s" "$MAIN_RESTART" MAIN_RESTART
                else
                    INVALID_TARGETS="$INVALID_TARGETS $target"
                fi
                ;;
            *-service-app)
                s="${target%-app}"
                if is_app_serving "$s"; then
                    add "$target" "$APP_RESTART" APP_RESTART
                else
                    INVALID_TARGETS="$INVALID_TARGETS $target"
                fi
                ;;
            *-service)
                if [ -d "$REPO_ROOT/backend/services/$target" ]; then
                    add "$target" "$MAIN_RESTART" MAIN_RESTART
                else
                    INVALID_TARGETS="$INVALID_TARGETS $target"
                fi
                ;;
            *)
                INVALID_TARGETS="$INVALID_TARGETS $target"
                ;;
        esac
    done
    [ -z "$INVALID_TARGETS" ] || die "未知强制发布目标:$INVALID_TARGETS"
else
    while IFS= read -r f; do
        [ -n "$f" ] || continue
        case "$f" in
            admin-web/*)     add admin-web    "$FE_BUILD" FE_BUILD ;;
            merchant-web/*)  add merchant-web "$FE_BUILD" FE_BUILD ;;
            supplier-web/*)  add supplier-web "$FE_BUILD" FE_BUILD ;;
            # H5 网页版自动构建发布;原生商店发版仍需人工(NOTE_MOBILE 只用于末尾提醒)
            client-app/*)    add client-app "$FE_BUILD" FE_BUILD; NOTE_MOBILE=1 ;;

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
            database/*.sql)
                DB_FILES="$DB_FILES $f"
                case "$f" in database/migrations/*.sql) DB_REQUESTED=1 ;; esac
                ;;
            *) : ;;  # 其余(docs、脚本、UI 设计稿等)不触发部署动作
        esac
    done <<< "$CHANGED"
fi

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
[ -n "$FORCE_TARGETS" ] && echo "  强制目标     :$FORCE_TARGETS (跳过 fetch/merge/变更判断)"
echo "  前端构建     :${FE_BUILD:- (无)}"
echo "  主池重启     :${MAIN_RESTART:- (无)}"
echo "  APP 孪生重启 :${APP_RESTART:- (无)}"
echo "  镜像重建     :${REBUILD:- (无)}"
echo "  网关动作     :${GATEWAY_ACTION:- (无)}"
[ "$APPLY_DB" -eq 1 ] && echo "  数据库迁移   :对比完整账本并在代码发布前执行待执行版本"
[ "$SKIP_DB" -eq 1 ] && echo "  ${C_YELLOW}数据库迁移   :已用 --skip-db 显式跳过${C_OFF}"
[ "$NEED_STACK_UP" -eq 1 ] && echo "  ${C_YELLOW}.env/compose 变更:需 ./mtrip.sh build 或 start 重建容器(本脚本不自动执行)${C_OFF}"
[ -n "$DB_FILES" ] && echo "  DB 文件变更  :$DB_FILES"
[ "$NOTE_MOBILE" -eq 1 ] && echo "  client-app:本次只发 H5 网页版(见上方前端构建);iOS/Android 商店发版仍需人工 EAS build + 提审"
if [ -n "$SKIPPED_APP" ]; then
    warn "--no-app-sync:跳过 APP 孪生重启 [$SKIPPED_APP]"
    warn "  风险:APP 池仍跑旧代码;若本次共享代码/接口不兼容,/api/v1/app/* 可能报错。请尽快手动同步。"
fi
echo

if [ -n "$FORCE_TARGETS" ] && [ -z "$FE_BUILD$MAIN_RESTART$APP_RESTART$REBUILD$GATEWAY_ACTION$DB_FILES" ] && [ "$DB_REQUESTED" -eq 0 ]; then
    die "强制发布目标未产生可执行部署动作"
fi

# ---------- APP 相关性提示(用户核心诉求) ----------
if [ -n "$APP_RESTART" ] || [ -n "$(echo "$REBUILD" | grep -o -- '-app' || true)" ]; then
    warn "检测到【波及 APP 端】的后端改动(命中 Controller/App 或共享代码/backend/shared),已纳入 APP 孪生同步。"
fi

# ---------- dry-run:到此为止 ----------
if [ "$DRY_RUN" -eq 1 ]; then
    if [ "$APPLY_DB" -eq 1 ]; then
        info "[dry-run] 读取迁移账本并列出待执行版本"
        migration_root="$REPO_ROOT"
        migration_tmp=""
        if [ -z "$FORCE_TARGETS" ] && [ "$AFTER" != "$(git rev-parse HEAD)" ]; then
            migration_tmp="$(mktemp -d /tmp/mtrip-db-dry-run.XXXXXX)" || die "无法创建 dry-run 临时目录"
            if ! git archive "$AFTER" database/migrations database/init/01-schema-migrations.sql \
                | tar -x -C "$migration_tmp"; then
                rm -rf -- "$migration_tmp"
                die "无法读取目标提交中的迁移文件"
            fi
            migration_root="$migration_tmp"
        fi
        DB_DRY_RC=0
        MTRIP_REPO_ROOT="$migration_root" DOCKER="$DOCKER" \
            bash "$REPO_ROOT/scripts/db-migrate.sh" --dry-run || DB_DRY_RC=$?
        if [ -n "$migration_tmp" ]; then
            case "$migration_tmp" in /tmp/mtrip-db-dry-run.*) rm -rf -- "$migration_tmp" ;; esac
        fi
        [ "$DB_DRY_RC" -eq 0 ] || die "数据库迁移预检失败"
    fi
    info "[dry-run] 仅打印决策,不执行迁移/构建/重启/合并"
    exit 0
fi

FAILED=0

# ---------- 执行:数据库迁移(必须早于任何代码发布) ----------
if [ "$APPLY_DB" -eq 1 ]; then
    info "对比并执行 MySQL 待执行迁移 ..."
    DOCKER="$DOCKER" bash "$REPO_ROOT/scripts/db-migrate.sh" || die "数据库迁移失败；为避免代码/结构不一致，已中止本次发布"
elif [ "$DB_REQUESTED" -eq 1 ] || [ -n "$DB_FILES" ]; then
    warn "检测到数据库文件变更但未执行生产迁移；开发环境可加 --apply-db，生产请使用 --prod"
fi

# ---------- 执行:前端构建 + 原子发布 ----------
publish_web() {
    local web="$1" src="$REPO_ROOT/$1/dist"
    local dst="$REPO_ROOT/deploy/web/$(web_dist_dir "$web")"
    local script="$(web_build_script "$web")"
    info "构建前端 $web($NPM run $script) ..."
    ( cd "$REPO_ROOT/$web" || exit 1
      # 没装依赖(首次部署 / 新机器)也要装,否则构建必失败
      if [ ! -d node_modules ]; then
          info "  node_modules 不存在,$NPM ci"; $NPM ci || exit 2
      elif echo "$CHANGED" | grep -qE "^$web/(package-lock\.json|package\.json)$"; then
          info "  依赖清单变更,$NPM ci"; $NPM ci || exit 2
      fi
      # 先清输出目录:Expo export 对已存在的 dist 行为不一致
      # (client-app 的 build:web 还带 --clear 清 Metro 缓存 —— Metro 按【源文件内容】缓存
      #  transform,只改 .env 而源码没动时会复用旧缓存,把过期的 EXPO_PUBLIC_* 值编进包里。
      #  实测踩过:改了 .env.production 但产物仍是旧地址。别去掉那个 --clear。)
      rm -rf dist
      $NPM run "$script" ) || { fail "$web 构建失败,保留旧产物不发布"; FAILED=1; return 1; }
    [ -f "$src/index.html" ] || { fail "$web 构建产物缺 index.html,跳过发布"; FAILED=1; return 1; }
    mkdir -p "$dst"
    # 【宝塔面板保护】站点根目录下的 .user.ini / .htaccess 是面板生成的跨站隔离配置,
    # 不属于构建产物。.user.ini 被面板加了 immutable(chattr +i),删它会直接报
    # "Operation not permitted" 让整次发布失败;.htaccess 删了会破坏站点配置。
    # 故 rsync 必须 --exclude 掉:被 exclude 的文件在接收端【不会】被 --delete 清理。
    # (cp 分支的 rm 用 * 通配,bash 默认不含 dotglob,本就删不到隐藏文件,这里保持一致语义。)
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --delete --exclude='.user.ini' --exclude='.htaccess' "$src/" "$dst/" \
            || { fail "$web 发布(rsync)失败"; FAILED=1; return 1; }
    else
        rm -rf "${dst:?}/"* && cp -r "$src/." "$dst/" || { fail "$web 发布(cp)失败"; FAILED=1; return 1; }
    fi
    ok "$web 已发布 -> deploy/web/$(web_dist_dir "$web")/"
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

# ---------- 结尾摘要 ----------
echo
if [ "$FAILED" -eq 0 ]; then
    if [ -z "$FORCE_TARGETS" ]; then
        state_dir="$(dirname "$DEPLOY_STATE_FILE")"
        state_tmp="${DEPLOY_STATE_FILE}.tmp.$$"
        mkdir -p "$state_dir" || die "无法创建发布状态目录: $state_dir"
        printf '%s\n' "$AFTER" > "$state_tmp" \
            && mv -f "$state_tmp" "$DEPLOY_STATE_FILE" \
            || die "无法更新上次成功发布点: $DEPLOY_STATE_FILE"
        ok "已记录完整发布成功点: $(git rev-parse --short "$AFTER")"
    fi
    ok "自动部署完成:数据库[$([ "$APPLY_DB" -eq 1 ] && echo 已核对 || echo 未执行)] 前端[${FE_BUILD:-无}] 主池[${MAIN_RESTART:-无}] APP孪生[${APP_RESTART:-无}] 重建[${REBUILD:-无}] 网关[${GATEWAY_ACTION:-无}]"
    exit 0
else
    fail "自动部署存在失败项,请查看上方日志"
    exit 1
fi
