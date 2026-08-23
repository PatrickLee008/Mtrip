# Mtrip 海外旅游 SaaS 平台

多站点海外旅游 SaaS:平台管理后台 + 商户/供应商体系 + C 端移动应用,覆盖酒店/门票商品、订单核销、财务结算、营销优惠全链路。

## 技术栈

| 层 | 技术 | 位置 |
|---|---|---|
| 后端微服务 | PHP 8.1 + Hyperf 3.1 + Swoole 5(Docker 运行) | `backend/`(8 个服务 + shared 共享包) |
| 管理后台 | Vue 3 + Vite 5 + TypeScript + Ant Design Vue | `admin-web/` |
| 移动端 | Expo 51 + React Native + TypeScript | `client-app/` |
| 数据库 | MySQL 8.0 双库(mtrip_system / mtrip_business,54 表) | `database/` |
| 网关/部署 | OpenResty + docker-compose(k8s 预留) | `deploy/` |

## 目录结构

```
MTrip/
├── backend/
│   ├── shared/              # 共享组件包 mtrip/shared(响应/JWT/RBAC/隔离/审计/加密,含 tests/)
│   └── services/            # 8 个微服务:system 9501 / user 9502 / goods 9503 / order 9504
│                            #            merchant 9505 / finance 9506 / marketing 9507 / payment 9508
├── admin-web/               # 平台管理后台(动态菜单 + v-perm 按钮权限)
├── merchant-web/            # 商户后台(Vue3+Vite+TS,端口5174;骨架/RBAC/订单/商品/门店已建)
├── client-app/              # C 端 Expo 应用(iOS/Android/Web)
├── database/                # DDL 按服务分目录 + seed/ 种子数据(管理员/菜单/站点)
├── deploy/                  # docker-compose.yml + openresty/ 网关 + k8s/ 预留
├── docs/
│   ├── plans/               # ★ 各模块工作计划与完成状态(进度看这里)
│   ├── guides/              # ★ 开发指导文件(setup/ api/ frontend/ standards/)
│   ├── reference/           # 需求 docx 提取文本(检索用)
│   └── tools/               # 辅助脚本
└── 设计文档/                # 原始需求 docx(需求以此为准)
```

## 快速开始

```bash
cd deploy
cp .env.example .env
docker compose up -d --build     # MySQL+Redis+8服务+网关,首次自动建库导种子
cd ../admin-web && npm install && npm run dev    # http://localhost:5173,接口经网关 8081
```

完整步骤(含不用 Docker 的手动方式、移动端启动、常见问题):**[docs/guides/setup/启动开发指南.md](docs/guides/setup/启动开发指南.md)**

## 文档索引:规范和约定在哪里看

| 想了解 | 看哪里 |
|---|---|
| **项目当前进度 / 各模块状态** | [docs/plans/README.md](docs/plans/README.md)(进度总览表 + 变更记录) |
| **新会话/新人接手全部上下文** | [docs/plans/HANDOFF.md](docs/plans/HANDOFF.md)(交接文档,第一入口) |
| **后端开发约定**(响应格式/错误码/字段命名/路由前缀/代码范本) | HANDOFF.md 第 4 节;工程范本以 `backend/services/system-service` 为准 |
| **前端页面代码模式**(useTable/弹窗表单/权限指令/动态路由) | HANDOFF.md 第 5 节 |
| **各模块详细任务清单与实现记录** | `docs/plans/01~10-*.md`(每模块一文件,含踩坑记录) |
| **移动端接口规范**(双前缀路由/签名头/分页约定) | [docs/guides/api/移动端接口规范.md](docs/guides/api/移动端接口规范.md) |
| **环境搭建与启动** | [docs/guides/setup/启动开发指南.md](docs/guides/setup/启动开发指南.md) |
| **网关路由表/限流/CORS** | `deploy/openresty/conf.d/mtrip.conf` + [docs/plans/08-部署与网关.md](docs/plans/08-部署与网关.md) |
| **原始需求** | `设计文档/*.docx`(提取文本在 `docs/reference/`) |

## 核心开发约定(速览,详细定义见上表)

- **统一响应** `{code, message, data}`,成功 `code=0`;分页 `data={list,total,page,pageSize}`;错误码 40101/40102 未登录、40301/40302 无权限(全码表:`backend/shared/src/Constants/ErrorCode.php`)。
- **字段命名**:请求入参驼峰,列表行 snake_case 直出(例外见 HANDOFF 第 4 节)。
- **路由前缀**:管理端 `/api/v1/admin/{模块}/*`,移动端 `/api/v1/app/{模块}/*`,由网关按二级模块分发到对应服务。
- **RBAC 权限**:写接口加 `#[Permission('模块:菜单:按钮')]` 注解,键必须与菜单种子 `database/seed/02-menu.sql` 的 perm_key 一致(支持多键任一匹配);前端按钮用 `v-perm` 同键防护。
- **站点隔离**:`site_id=0` 超管全平台,其余强制本站点(`AdminContext::scopeSiteId`);新页面目录必须与菜单 component 字段完全一致(动态路由按此解析)。
- **密钥安全**:`MTRIP_JWT_SECRET` / `MTRIP_AES_KEY` 各服务必须一致,生产必须换强随机值;密钥类字段 AES-256-GCM 加密存储、展示脱敏。

## 质量基线

统一执行入口:`powershell -ExecutionPolicy Bypass -File scripts/check.ps1`(按序执行下列四步,任一失败即非零退出):

1. 后端全量 `php -l` 语法检查(backend/,排除 vendor/runtime);
2. shared 纯逻辑单测 `php backend/shared/tests/run.php`(47 用例,无需 vendor/Swoole);
3. admin-web `npm run build`(vue-tsc 零 TS 报错);
4. client-app `npm run typecheck`。

- 工作方式:每完成一项任务,同步更新 `docs/plans/` 对应模块文件、README 进度表和 HANDOFF.md;交付前本地跑一次 `scripts/check.ps1` 作为验收入口。

## 当前状态(2026-07)

模块 01~07、09、10 已完成;模块 08(部署与网关)完成 80%——deploy 基础设施、权限键统一与 **08-6 部署后四步验证(2026-07-30 全部通过:11 容器全 Up、八服务 healthz ok、网关 8081 无签名 401、.env 注入生效)** 已落地,剩余 08-7 全链路联调待执行,清单见 [docs/plans/08-部署与网关.md](docs/plans/08-部署与网关.md)。

补充(2026-08-23):商家端 `merchant-web` 已完成全局样式同步与 M5/M6/M8/M9/M10 首轮页面/接口增量,详见 [docs/plans/13-商家端merchant-web落地.md](docs/plans/13-商家端merchant-web落地.md)、[docs/plans/实现方案-Merchant-全模块差距与样式同步.md](docs/plans/实现方案-Merchant-全模块差距与样式同步.md) 与 [docs/plans/实现方案-Merchant-M8-营销活动.md](docs/plans/实现方案-Merchant-M8-营销活动.md)。
