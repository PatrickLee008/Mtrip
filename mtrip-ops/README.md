# Mtrip Ops

Mtrip Ops 是独立于 Mtrip 业务代码的轻量运维控制台。它用一个 Node.js 单体进程提供服务端渲染页面,用于查看平台状态、服务健康、容器状态、业务日志、流量趋势和发布预检。

当前版本是零依赖 MVP:不需要 npm install,直接使用 Node.js 内置模块运行。后续需要历史指标、全文检索和账号体系时,再引入 SQLite 与模板/路由库。

## 快速启动

```bash
cd mtrip-ops
cp ops.config.example.json ops.config.json
./ops.sh start          # 后台启动;前台调试用 npm start
```

默认监听:

```text
http://127.0.0.1:56700
```

**首次启动会自动创建管理员账号,随机密码只在控制台打印一次**,用 `./ops.sh logs` 可回看:

```text
==================================================================
  [首次初始化] 已创建管理员账号
    用户名: admin
    密码  : wey7rSX7XjWMn4rB
  请立即登录并修改密码,此密码不会再次显示。
==================================================================
```

## 启动与停止

`ops.sh` 用于非 systemd 场景(systemd 见 `systemd/mtrip-ops.service.example`):

| 命令 | 说明 |
| --- | --- |
| `./ops.sh start` | 后台启动(nohup);pid → `data/ops.pid`,输出 → `data/ops.log`。已在运行时拒绝重复启动 |
| `./ops.sh stop` | 先 TERM 优雅停,超过 `STOP_TIMEOUT`(默认 10s)再 KILL |
| `./ops.sh restart` | stop + start |
| `./ops.sh status` | 进程存活、端口监听、访问地址 |
| `./ops.sh logs` | `tail -f` 启动日志(初始管理员密码在这里面) |

环境变量:`NODE`(node 路径)、`MTRIP_OPS_CONFIG`、`MTRIP_OPS_HOST`、`MTRIP_OPS_PORT`、`STOP_TIMEOUT`。

`start` 会校验 Node ≥ 20,并等待端口真正就绪才报成功;进程起来后立刻退出的话会直接打印日志尾部。
pid 与日志都在 `data/`(该目录 `.gitignore` 为 `*`),不会进 Git。

## 账号与权限

全站需登录(除登录页与静态资源)。三个角色,权限自上而下累加:

| 角色 | 可访问 |
| --- | --- |
| **只读 viewer** | 总览、服务、日志、审计、计划文档 |
| **运维 operator** | 以上 + 发布页全部白名单动作(git、dry-run、备份、health、单服务重启/build) |
| **管理员 admin** | 以上 + `/users` 账号管理(新建、改角色、重置密码、禁用、删除) |

管理员在 `/users` 页管理账号。**改角色或禁用账号对目标用户的当前会话立即生效**,不必等对方重新登录。

安全要点:

- 口令用 scrypt 加盐哈希存在 `data/users.json`(权限 `0600`),**不存明文**。
- 登录失败按「用户名+IP」计数,5 次锁 5 分钟;不区分「用户名不存在」与「密码错误」,避免账号枚举。
- 状态变更请求都校验 CSRF token;会话 cookie 为 `HttpOnly; SameSite=Strict`。
- 防自锁:最后一个可用管理员不能被降级、禁用或删除,也不能删除当前登录的账号。
- **已知取舍:会话存在内存里,进程重启即全部登出**。这是「简单优先」的取舍,不是缺陷。
- 生产若挂 HTTPS,应在 `src/auth.js` 的 `sessionCookie()` 里补 `; Secure`(当前默认明文 HTTP,加了反而发不出 cookie)。

忘记管理员密码时:停服务 → 删除 `data/users.json` → 重新 `./ops.sh start`,会重新初始化一个随机密码的 admin(**注意这会清空全部账号**)。

本机 Docker 需要 sudo 时,默认配置使用非交互命令:

```json
"dockerCommand": ["sudo", "-n", "docker"]
```

运行用户需具备 Docker sudo 免密权限;否则诊断页会提示 `sudo` 密码或权限错误。

## 当前功能

- 总览页:网关、8 个主池服务、5 个 APP 孪生池服务健康检查,并展示请求样本、慢请求和 5xx 错误。
- 服务页:按服务展示 health、请求量、慢请求、5xx、Docker CPU/内存/网络负载;Docker 不可用时降级显示原因。
- 日志中心:支持关键词、服务、文件、状态码、慢请求、5xx 筛选,同时保留文件 tail 查看。
- 发布管理:自动部署、指定目标发布、DB 备份、全局 health、Git 操作、单服务日志/热重启/build,详见下节。
- 审计页:展示命令开始/结束事件,审计源为 `data/audit.log`。
- 文档页:内置方案、计划、安全模型、成熟软件调研。

## 发布管理

`/actions` 页把 `scripts/auto-deploy.sh` 的两种用法都做成了按钮(需 `operator` 及以上角色):

### 1. 自动部署

对应 `scripts/auto-deploy.sh`(无参数):**拉取当前分支 → 比对变更 → 只构建/重启受影响的项目**。

- ff-only 策略:工作区必须干净;分叉或已是最新则直接早退,绝不覆盖本地改动。
- 后端按「是否波及 `Controller/App` 或共享代码」决定要不要同步重启 APP 孪生池。
- `database/*.sql` 变更只告警不执行;`.env` / compose 变更需人工 `mtrip.sh build`。
- 页面提供 **预检 dry-run** 与 **执行自动部署** 两个按钮,建议先看 dry-run 决策再执行。

工作区不干净时页面会提前给出横幅警告(`deploy/web` 下的发布产物已被脚本排除,不计入)。

### 2. 指定目标发布

对应 `scripts/auto-deploy.sh <目标>`:**跳过 git 拉取、落后判断与洁净门禁**,直接用当前工作区内容发布指定项目。目标按用途分组:

| 分组 | 目标 | 行为 |
| --- | --- | --- |
| 前端 | `admin-web` `merchant-web` `supplier-web` `client-app` | 重新构建并原子替换到 `deploy/web/<名>/` |
| 后端主池 | `system-service` … `payment-service` | 热重启 |
| APP 孪生池 | `system-service-app` 等 5 个 | 热重启(C 端 `/api/v1/app/*` 走这里) |
| 网关 | `gateway` | 重启 OpenResty |

同样提供 **预检** 与 **立即发布** 两个按钮。重建过后端容器后建议再发一次 `gateway`,否则网关可能缓存旧 IP 报 502。

> 部署类命令超时上限为 **15 分钟**(默认的 3 分钟不够 —— 仅 `client-app` 的 Expo web 打包就要 1-2 分钟,首次还要 `npm ci`)。

### 风险提示

自动部署与指定发布都属**高风险动作**,页面上以 `高风险` 徽标标注并带二次确认弹窗。
`enableActions=false` 时全部按钮置灰且不会执行。发布前建议先「数据库备份」,发布后立即跑「全局健康检查」。

## 安全默认值

- **全站需登录**,三角色 RBAC(见上「账号与权限」)。
- 默认只读:`enableActions=false`。
- 仅绑定本机:`host=127.0.0.1`。
- 子进程命令只走白名单,不用 shell 拼接用户输入。
- 发布/健康命令输出写入 `data/audit.log`,**含操作人与来源 IP**。

生产使用前建议放在 VPN/堡垒机/SSH tunnel 后面,不要公网裸露。

## 目录

```text
mtrip-ops/
├── docs/                       # 方案、计划、安全模型、调研记录
├── public/                     # CSS 与少量浏览器脚本
├── src/                        # Node 单体应用源码(auth.js = 账号与权限)
├── systemd/                    # systemd 示例
├── data/                       # 本地运行数据(users.json / audit.log / ops.pid / ops.log),不入 Git
├── ops.sh                      # 启停脚本(start/stop/restart/status/logs)
├── ops.config.example.json     # 配置样例
└── package.json
```


## 使用提醒

当前已经不是纯 MVP,而是完整应用骨架:核心模块、页面结构和安全边界已搭好。后续会继续补实时图表、业务库只读看板、真实在线用户、告警通知、发布审批和更精细的单服务灰度发布。

## 界面模板

左侧主题切换器内置 4 套模板和 2 种密度:

- 玻璃:浅色玻璃拟态,适合日常运维。
- 黑色经典:深色稳重风格,适合监控室。
- 浅色专业:高对比浅色后台风格,适合长时间表格查看。
- 终端矩阵:绿色终端风格,适合大屏展示。
- 紧凑/舒展:紧凑模式优先展示更多内容,舒展模式适合讲解和投屏。

主题和密度保存在浏览器 `localStorage`,不影响服务端配置。

## 版本与发布时间

`/services` 已支持展示镜像、启动时间、运行时长、版本号、发布时间、Git SHA 和发布说明。启动时间/运行时长来自 Docker inspect;版本号/发布时间/发布说明需要 `deploy/release.json`、Docker labels 或环境变量提供。配置方式见 `mtrip-ops/docs/05-发布版本信息配置.md`。

## APP 孪生池状态说明

`/services` 会读取 `docker ps -a` 判断 APP 孪生池是否真实存在:

- `running`:容器存在且运行。
- `stopped/exited`:容器存在但未运行。
- `missing`:容器不存在,通常说明启动时没有加载 `docker-compose.app-pool.yml`。

当前网关 `/api/v1/app/*` 固定指向 APP 孪生池,不会自动回退主池。若 APP 孪生容器 missing/stopped,页面会显示路由风险,表示 C 端接口可能 502。

## 下一步计划

后续执行计划见 `mtrip-ops/docs/07-下一步执行计划.md`,页面入口为 `/docs/07`。
