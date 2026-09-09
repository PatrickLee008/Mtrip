# Mtrip 部署与重启操作指南

> 适用环境:Windows Docker Desktop 本地联调 | 所有命令在 `deploy/` 目录下执行(PowerShell)
>
> **不想装 Docker Desktop?** 用 WSL2 + 原生 docker-ce 的免授权方案,从零搭建见 [`WSL2-部署说明.md`](WSL2-部署说明.md)(改用 `mtrip.sh` 代替 `.bat`)。

## 1. 首次启动 / 完整重建

```powershell
cd deploy
./mtrip.sh build               # 构建镜像并启动全部服务(分钟级);缺 .env 时自动从 .env.example 生成
# 之后日常启动用 ./mtrip.sh start(不重建镜像)
```

> ⚠ **不要直接敲 `docker compose up -d`**。裸命令只加载 `docker-compose.yml` + `docker-compose.override.yml`,
> **起不出 APP 孪生池**(`docker-compose.app-pool.yml` 里的 `*-service-app`);而网关 conf 有 5 条 upstream 指向它们,
> nginx **启动期**解析不到主机名会直接 `[emerg] host not found in upstream` 退出,表现为 `mtrip-gateway-1` 无限重启。
> `mtrip.sh` 的 dev 模式固定合并 4 个 compose 文件,是唯一正确入口(生产 `--prod`、隔离验收 `--s7`)。

启动完成后入口:

| 入口 | 地址 |
| --- | --- |
| 网关(admin + app 接口统一入口) | http://localhost:8081 |
| 各微服务直连(healthz 探活) | 9501~9508(system/user/goods/order/merchant/finance/marketing/payment) |
| 前端静态站(见第 7 节) | admin 8090 / merchant 8091 / supplier 8092 / client(H5) 8093 |
| MySQL | localhost:3307(root / 见 .env) |
| Redis | localhost:6380 |

## 2. 日常改动后如何重启(按场景选,勿一律 --build)

| 场景 | 命令 | 耗时 |
| --- | --- | --- |
| 只改 PHP 代码(`app/`、`config/`、`shared/src`) | `./mtrip.sh restart user-service`(APP 端接口还要 `user-service-app`) | ~2 秒/个 |
| 改了 `docker-compose.yml` / `.env` 环境变量 | `./mtrip.sh start`(结束后脚本自动刷网关) | ~10 秒 |
| 新增 composer 依赖 / 改 Dockerfile | `./mtrip.sh build xxx-service` | 分钟级 |
| 新增生产数据库变更 | 新建 `database/migrations/VYYYYMMDDHHMMSS__add-example-column.sql`，运行 `bash scripts/db-migrate.sh` | 秒~分钟级 |
| 补灌历史初始化 SQL | 开发环境可用 `scripts/db-apply.ps1`；清空重建用 `./mtrip.sh clean` 后 `build`(**慎用**) | 秒~分钟级 |

**注意**:5 个共享服务各有一个 `-app` 孪生(system / user / goods / order / marketing),`/api/v1/app/*` 全走孪生。
只重启主池不会让 APP 端接口生效,反之亦然 —— 改这 5 个服务的代码时两个都要 restart。

热重启原理:`docker-compose.override.yml` 把本地 `app/`、`config/`、`backend/shared/src` 挂载进容器覆盖镜像内代码,
`restart` 后 Hyperf 重新扫描即生效,无需重建镜像。

### 2.1 生产数据库增量迁移

生产增量统一放在 `database/migrations/`，命名为
`VYYYYMMDDHHMMSS__lower-kebab-description.sql`（有效 UTC 日期时间、全局唯一）。现有 `system/`、`merchant/`、
`goods/` 等数字 SQL 是空库初始化快照，不作为生产版本号；新增业务 SQL 放到旧目录，或把旧快照
rename/copy 为版本迁移，都会被自动发布拒绝。
以下命令在**仓库根目录**执行：

```bash
bash scripts/db-migrate.sh --validate  # 只校验文件名/版本重号，不连接 MySQL
bash scripts/db-migrate.sh --status    # 对比 mtrip_system.schema_migrations，只读
bash scripts/db-migrate.sh             # 加 MySQL 命名锁并执行全部待执行版本
```

`scripts/auto-deploy.sh --prod` 每次拉取后都会执行完整版本对比，即使上次发布迁移失败、下次没有新 commit，
也不会直接误判为“无需部署”。迁移成功才发布代码；失败、历史文件 checksum 变化、已登记文件缺失都会阻断。
`--apply-db` 可在非生产模式显式启用同一流程；`--skip-db` 仅用于已由外部 DBA 流程完成迁移的应急发布。
生产 cron 必须带 `--prod`；旧的无参 cron 仍按开发安全策略只告警数据库文件变更。
完整部署成功点保存在 `.git/mtrip-last-successful-deploy`；Git 已快进但迁移/构建/重启失败时不会推进该标记，
所以下次 cron 仍会从上次成功点重新计算全部发布动作，而不是因 `HEAD` 已最新漏掉代码发布。

账本记录版本、脚本路径、SHA-256、Git commit、执行节点、开始/结束时间、耗时和状态。MySQL DDL 会隐式提交，
所以迁移必须幂等并采用 expand/contract；删表、删列和批量删数据不得进入无人值守自动迁移。完整约定见
`database/migrations/README.md`。

迁移账本从本机制上线后开始，不会反推旧目录历史 SQL 是否曾在生产执行；首次启用前需按 HANDOFF 核对
已有漏项，之后新增版本才由账本持续保证。

空库初始化迁移失败会登记为 `failed`；MySQL 容器健康检查要求账本不存在 `running/failed`，避免部分 DDL
已提交后仍启动业务服务。此时先查看 MySQL init 日志和账本，确认实际结构后再修复，不要直接改状态重跑。

## 3. 已知坑:重建容器后网关 502

`docker compose up -d` 重建业务容器会导致容器 IP 变化,而 OpenResty 网关启动时已解析并缓存旧上游 IP,
表现为**服务 healthz 正常但网关转发全部 502**。修复:

```powershell
docker compose restart gateway
```

纯 `docker compose restart xxx-service` 热重启不换 IP,不会触发此问题。

## 4. 部署后验证

```powershell
# 1) 容器状态全部 Up
docker compose ps

# 2) 服务探活(以 user-service 为例;注意用 curl.exe,PowerShell 的 curl 是 Invoke-WebRequest 别名)
curl.exe -s http://localhost:9502/healthz
# 期望:{"status":"ok","service":"user-service"}

# 3) 网关链路(无签名头预期返回 401,说明链路与签名中间件正常;502 则按第 3 节重启网关)
curl.exe -s -o NUL -w "%{http_code}" http://localhost:8081/api/v1/app/auth/login -X POST

# 4) 环境变量注入检查(以提交防重开关为例)
docker exec mtrip-user-service-1 sh -c "env | grep MTRIP_SUBMIT"
```

## 5. 日志与排查

- 服务日志挂载在 `deploy/logs/<服务名>/`:`hyperf.log`(异常,按天滚动)、`request.log`(全量请求,`MTRIP_REQUEST_LOG=true` 时)
- 实时看容器输出:`docker compose logs -f user-service`
- 重建后无初始化数据:优先运行 `reinit.bat`。该脚本会先单独启动 MySQL,等待 `sys_admin/sys_menu/sys_site/merchant_menu/merchant_role` 确认有数据后再启动全量服务;若失败会打印 `mysql` init 日志尾部。
- 常用开关(改 `.env` 后须 `docker compose up -d` + 重启网关,详见 `.env` 内注释):
  `MTRIP_REQUEST_LOG` / `MTRIP_CLIENT_SIGN` / `MTRIP_PAYLOAD_ENCRYPT` / `MTRIP_SUBMIT_LOCK`

## 6. 停止

```powershell
docker compose stop      # 停止但保留容器与数据
docker compose down      # 删除容器,保留数据卷(下次 up 数据仍在)
docker compose down -v   # 连数据卷一起删(数据库清空,重新初始化建表)
```

## 7. 前端静态托管(含 client-app 的 H5)

四个前端的构建产物都落在 `deploy/web/<名>/`,由 `scripts/auto-deploy.sh` 原子替换:

| 站点 | 源工程 | 构建命令 | 产物目录 | 网关直连端口 |
| --- | --- | --- | --- | --- |
| admin | `admin-web/` | `npm run build`(vite) | `deploy/web/admin/` | 8090 |
| merchant | `merchant-web/` | `npm run build`(vite) | `deploy/web/merchant/` | 8091 |
| supplier | `supplier-web/` | `npm run build`(vite) | `deploy/web/supplier/` | 8092 |
| **client(H5)** | `client-app/` | `npm run build:web`(**Expo web export**) | `deploy/web/client/` | 8093 |

发布:`scripts/auto-deploy.sh client-app`(或 `admin-web` 等);cron 无参模式会按变更自动选。

> **client 只是移动端的 H5 网页版。** iOS / Android 的 EAS build 与商店提审**不在部署脚本内**,仍走人工。

### 7.1 两种托管方式(可并存)

**A. Docker 网关直连(开发/内网默认)** —— 上表的 8090~8093 由 gateway 容器监听,
server 块见 `openresty/conf.d/mtrip.conf`,端口可在 `.env` 用 `ADMIN_WEB_PORT` 等改。
各站点的 `/api/` 与 `/uploads/` 由该 server 块反代回网关 `:80`,免 CORS。

**B. 宝塔面板建站(生产常用)** —— 站点监听 `:80`/`:443` 按域名分流,根目录直接指向
`deploy/web/<名>/`。此时上表的 8090~8093 只是**额外的直连调试入口**,可用可不用
(`docker compose` 仍会占用这几个宿主端口,如与他处冲突就在 `.env` 里改掉)。

**⚠️ 宝塔站点必须自己加 API 反代。** 四个前端都走**同源相对路径**请求接口
(client-app 见 `client-app/.env.production` 的 `EXPO_PUBLIC_API_BASE_URL=/`),
站点若只发静态文件而不反代,所有接口都会 404。在站点配置里加:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8081;      # GATEWAY_HOST_PORT
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
location /uploads/ {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
}
# SPA history 路由:四个站点都是单 index.html
location / { try_files $uri $uri/ /index.html; }
```

### 7.2 宝塔的 `.user.ini` / `.htaccess`

宝塔会在站点根目录生成这两个文件,其中 `.user.ini` 被加了 immutable 属性
(`chattr +i`),**删除会报 `Operation not permitted`**。
`scripts/auto-deploy.sh` 的发布步骤已用 `rsync --exclude` 显式保护这两个文件,
发布时不会删除也不会覆盖它们 —— 无需手工干预,也**不要**去掉那两个 `--exclude`。

### 7.3 client-app H5 的两个坑(已在脚本/配置里固化)

1. **`EXPO_PUBLIC_API_BASE_URL` 必须是 `/`**。它的语义是 **origin** 而非路径前缀
   (`src/api/*.ts` 的 URL 本身就带 `/api/v1/...` 全前缀)。填 `/api/v1` 会拼成
   `/api/v1/api/v1/app/...`;**留空也不行** —— Expo 会把空值变量当未定义丢弃,
   于是回落到 `src/config/env.ts` 里的 `https://api.mtrip.com`。
2. **构建必须带 `--clear`**(已写进 `build:web`)。Metro 按源文件内容缓存 transform,
   只改 `.env` 而源码没动时会复用旧缓存,把过期的 `EXPO_PUBLIC_*` 值编进包里。
