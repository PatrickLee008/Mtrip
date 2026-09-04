# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 文档优先级(本仓库的硬规矩)

本仓库刻意采用「路由而非复制」的文档结构:各级 `AGENTS.md` 只做路由和硬约束,**规范正文的唯一事实源是 `docs/plans/HANDOFF.md`**。因此:

1. 动手前先读 **`docs/plans/HANDOFF.md`**(新会话第一入口,含后端约定第 4 节 / 前端模式第 5 节 / 模块 08 关键结论第 6 节)。
2. 找规范/约定的完整索引看 **`README.md`「文档索引」一节**;找进度看 `docs/plans/README.md`。
3. 在子目录开发前读该目录的 `AGENTS.md`(`backend/services/AGENTS.md`、`admin-web/src/AGENTS.md`)。
4. **不要把规范正文复制进 CLAUDE.md 或 AGENTS.md** —— 需要更新约定时改 HANDOFF.md,其余文件只留指针。

## 常用命令

```powershell
# 质量基线统一入口(交付前必跑,任一步失败即非零退出)
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
#   1) backend 全量 php -l  2) shared 单测  3) admin-web build  4) client-app typecheck

# 单独跑后端纯逻辑单测(无需 vendor/Swoole,47 用例)
php backend/shared/tests/run.php

# 单个 PHP 文件语法检查(服务实际跑 Docker,本机 PHP 仅用于 lint)
php -l backend/services/system-service/app/Controller/XxxController.php

# admin-web(管理后台,cwd 必须在 admin-web/)
cd admin-web; npm install; npm run dev      # http://localhost:5173,接口经网关 8081
cd admin-web; npm run build                 # vue-tsc --noEmit && vite build,要求零 TS 报错

# client-app(Expo 移动端)
cd client-app; npm run typecheck            # tsc --noEmit
cd client-app; npm start                    # expo start

# 全栈起服务:一律走 deploy/mtrip.sh,【不要直接敲 docker compose】
# —— 裸 `docker compose up -d` 只加载 yml+override,起不出 APP 孪生池(*-service-app),
#    而网关 conf 的 5 条 upstream 指向它们,nginx 启动期解析不到主机名会 [emerg] 退出并无限重启。
cd deploy; ./mtrip.sh start                 # 开发栈(自动补 .env);dev 模式固定合并 4 个 compose 文件
cd deploy; ./mtrip.sh build                 # 改 Dockerfile / 新增 composer 依赖时才用(up -d --build)
cd deploy; ./mtrip.sh restart goods-service # 开发期改后端代码后重启(约 2 秒,override 已挂载本地代码)
cd deploy; ./mtrip.sh restart goods-service-app   # 同一个服务的 APP 孪生要单独重启(/api/v1/app/* 走它)
cd deploy; ./mtrip.sh status                # 容器状态;./mtrip.sh health 探活 8 个服务 + 网关链路
# 网关会在 start/build 后自动刷新(容器 IP 变了不刷会全量 502/50200),无需手动 restart gateway

# 增量执行 SQL(脚本幂等,不必 down -v 重建;新增 SQL 仍须登记进 compose 的 initdb 挂载)
powershell -ExecutionPolicy Bypass -File scripts/db-apply.ps1 database/merchant/03-group-store.sql database/seed/04-merchant-menu.sql
# 彻底清库重来(会删数据):cd deploy; ./mtrip.sh clean; ./mtrip.sh build
```

后端**没有单测框架/单测命令**;`backend/shared/tests/run.php` 是手写的纯逻辑测试跑器(`tests/bootstrap.php` 自带 Hyperf 桩,无需 composer install)。要单跑某类逻辑,直接编辑该 run.php 的用例列表。

## 环境约束(win32 / PowerShell)

- 命令分隔符用 `;`,**禁用 `&&`**(PowerShell 5.1)。
- 本机 PHP 只用于 `php -l` 语法检查,服务实际运行在 Docker;前端构建的 cwd 必须切到对应子目录。
- 网关对外端口是 **8081**(无签名 POST 返 401 属预期);容器内 MySQL 映射 3307、Redis 6380。

## 架构大图(需跨多文件才能看懂的部分)

**五端 + 网关 + 双库**。请求经 OpenResty 网关按路由前缀的**二级模块**分发到对应微服务:

- 路由前缀:管理端 `/api/v1/admin/{merchant|goods|order|finance|user|marketing|payment}/*`,移动端 `/api/v1/app/{模块}/*`。网关按 `{admin|app}` + 二级模块 map 到服务,路由表在 `deploy/openresty/conf.d/mtrip.conf`。
- 8 个 Hyperf 微服务(端口固定):system 9501 / user 9502 / goods 9503 / order 9504 / merchant 9505 / finance 9506 / marketing 9507 / payment 9508。`backend/shared`(composer 包 `mtrip/shared`)提供响应/JWT/RBAC/站点隔离/审计/加密。
- **工程范本唯一标准是 `backend/services/system-service`**(Controller/Model/Service、`#[Inject]`、验证、软删除、操作日志);业务五服务用 `Db::table` 直查不建 Model,新服务由现有服务整目录复制后改 6 处差异(见 HANDOFF 第 6 节「骨架复制法」)。

三条跨层强一致链(违反即返工,完整定义见 README「核心开发约定」/ 根 `AGENTS.md`):

1. **统一响应**:`{code, message, data}`,成功 `code=0`;分页 `data={list,total,page,pageSize}`(page/pageSize 默认 20 最大 200)。全码表 `backend/shared/src/Constants/ErrorCode.php`(40101/40102 未登录、40301/40302 无权限)。字段命名:**请求入参驼峰,列表行 snake_case 直出**(例外见 HANDOFF 第 4 节)。
2. **RBAC 权限键三处对齐**:后端写接口 `#[Permission('模块:菜单:按钮')]` ↔ 菜单种子 `database/seed/02-menu.sql` 的 `perm_key` ↔ 前端按钮 `v-perm` 同键。注解支持 `string|array` 多键任一匹配(`hasAnyPermission`)。改任一处必须三处同改。
3. **站点隔离**:`site_id=0` 超管全平台,其余强制本站点(`AdminContext::scopeSiteId`)。

**前端动态路由 ↔ 菜单强绑定**:`admin-web/src/router/dynamic.ts` 用 `import.meta.glob` 按菜单 `component` 字段解析 `views/{component}.vue` —— **新增页面目录必须与 `02-menu.sql` 的 component 字段完全一致**;未实现页面自动回退 `views/wip/index.vue`。前端页面代码模式(useTable / 弹窗表单 / StatusTag 等)见 HANDOFF 第 5 节,模板中**禁用 `as` 断言与 TS 类型标注**。多语言(vue-i18n,默认/fallback 均 en-US)规范见 `docs/guides/standards/README.md`。

需求以 `设计文档/*.docx` 为准(提取文本在 `docs/reference/`)。

## 工作方式

每完成一项任务,同步更新三处:`docs/plans/` 对应模块文件、`README.md` 进度表、`docs/plans/HANDOFF.md`(「当前进度」与「下一步」两节)。交付前本地跑一次 `scripts/check.ps1` 作为验收入口。
