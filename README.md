# Mtrip 海外旅游 SaaS 平台

Merchant M4 预订管理整改（2026-09-18）：按 Merchant PRD v1.0.3 模块 4 与 Figma 详情节点 `1289:24340`、列表节点 `1289:16725` 完成本轮代码整改和自动化回归。重点包含退款/库存与旧核销生命周期、预订通知物业范围、Pay at Hotel / Mark as Paid、Figma 列表/详情/操作态、All Properties 聚合，以及带 IANA 时区快照的 No-show 截止时间。迁移账本 21/21，专项与质量基线全绿；已补完 1440×900、1366×768、393×852 真实登录态视觉验收和 authenticated Mark as Paid 无副作用 HTTP 探测，并修复支付时间线翻译缺口。物业级 No-show 可配置模型仍待产品决策；Mark as Paid 登录态成功写入若需补验，须使用专用 Pay at Hotel 测试订单。详见[M4 实现方案](docs/plans/实现方案-Merchant-M4-酒店预订管理.md)。

2026-09-17更新：新增**全局「强制短信验证」开关**(`sys_config` 的 `security`/`register_sms_required`,迁移 `V20260917040000`,账本 19→20)。动机:注册原本是「渠道启用即强制」,短信渠道一旦停用/软删/凭证失效,`enabled()` 变 false,注册就**静默降级成免验证码注册**且无任何告警(9/17 实测复现:渠道停用后不带 token 的 `register` 直接建号成功)。现在把「是否要求验证」与「渠道是否可用」解耦:`1=强制`(渠道不可用则拒绝注册)/`0=跟随渠道`(旧行为),**默认 1**。**该开关同日曾先做成站点级 `sys_site.sms_verify_required`(`V20260917032003`),当天即搬到全局并删除该列** —— 注册的站点来自客户端可控的 `X-Site-Id`,站点级挡不住「挑一个最宽松的站点」。开关在后台「系统配置 → 全局参数 → 安全配置」,开/关都弹二次确认并经 `OperationLogMiddleware` 留痕(只有新值)。新增错误码 `50022 SMS_REQUIRED_UNAVAILABLE` 与既有 50021 区分「能否降级」——App 遇 50021 照旧跳过验证码页,遇 50022 停在注册页报错(跳过去也会被 40111 打回)。真值表 13 项已逐格实测,含「换任意 `X-Site-Id` 均被 40111 拦」。详见[模块10](docs/plans/10-移动端App框架.md)。

数据库增量复核（2026-09-16）：以提交 `2a32fe1996376e3b917aba838e2560ef52760217` 为起点检查到当前 `dev` 的版本化迁移；指定提交本身没有数据库变更，其后新增 16 个迁移。`scripts/db-migrate.sh` 命名校验通过，正式执行与二次账本复核均显示已执行 18、待执行 0，当前数据库已是最新版本。

Hotel Amenities 页签（2026-09-15）：按 Figma `696:4238` / `743:4446` 实现四类设施和酒店标签的查看、整页编辑、新增、删除、图标、启用及亮点状态。结构化数据按物业进入现有资料审核版本，启用项兼容投影到 `facilities`，旧物业自动回退；迁移已应用，双 Web 构建和隔离发布/消费者回归通过，两个 App 未修改。详见[商户端落地记录](docs/plans/13-商家端merchant-web落地.md)。

2026-09-15 本地提交归档：按用户授权统一提交当前商户入驻、酒店物业模型、三端适配、迁移及测试文档，基于 dev `29614ea` 保留双方改动；由用户自行推送。详见[提交记录](docs/plans/audits/2026-09-15-local-dev-commit.md)。

2026-09-15 dev 同步：已从 `14bbd94` 快进至 `29614ea`，保留本地未提交改动及远端余额支付、关怀模式和登录注册更新。三个冲突文件已整合，物业收藏逻辑迁入共享 `useMyPickData`，关怀模式酒店详情参数同步为 `propertyId`。本地原始改动保留于 stash `codex-backup-before-dev-sync-2026-09-15`；client-app 类型检查通过。

商户激活入口修复（2026-09-15）：补齐网关 activation 映射，解决首次激活 404；待激活账号登录给出准确指引。16 项实际路由、44 项隔离认证及原账号双方式激活身份检查通过。见[修复报告](docs/plans/audits/2026-09-15-merchant-activation-routing-fix.md)。

商户测试模式（2026-09-15）：本地已开启最终批准凭证弹窗和邮箱／短信固定 OTP `000000`，无需外部渠道。支持既有待激活申请查看凭证；生产环境禁用。注册 43、认证 42、凭证 36 项测试及两套 Web 构建通过。见[测试流程说明](docs/plans/audits/2026-09-15-merchant-auth-test-mode.md)。

后台线索联系方式确认（2026-09-15）：新线索填写主账号注册手机号/邮箱后默认管理员确认，无需注册 OTP；凭证发送注册邮箱。超管最终批准按钮保持可见并展示阻断原因。30 项注册、50 项 KYC、27 项最终批准回归及后台构建通过；存量 ID 2 申请已按用户确认的 +86 区号补齐联系方式，最终批准已就绪。见[补充报告](docs/plans/audits/2026-09-15-admin-assisted-onboarding-kyc.md)。

商户后台协助 KYC（2026-09-15）：新流程支持商户/首批物业文件代传和提交核验，并提供仅开发/测试环境超管可用的协议测试确认。50 项 KYC、19 项最终批准回归和后台构建通过，商户双池已加载。见[操作与验证报告](docs/plans/audits/2026-09-15-admin-assisted-onboarding-kyc.md)。

多站点海外旅游 SaaS:平台管理后台 + 商户/供应商体系 + C 端移动应用,覆盖酒店物业、门票商品、订单核销、财务结算、营销优惠全链路。

## 技术栈

商户入驻审批整改阶段 0–7（2026-09-15）：注册 OTP/草稿、基础审批、商户及首批物业 KYC、电子签署、最终批准、账号激活、物业资料/房型审核、发布与用户端酒店链路已完整收口。同库 E2E 覆盖补正重交、两家同名物业、并发幂等、投递失败重试、暂停/下线恢复和旧批准版本保留，阶段 7 的 56 项主链路及历史专项回归通过。详见[阶段 7 报告](docs/plans/audits/2026-09-15-merchant-onboarding-stage7.md)与[App 接入包](docs/guides/api/商户入驻与酒店发布App接入包.md)。未修改两个 App，真机接入及真实外部提供商联调另行实施。

酒店商品/物业模型整改（2026-09-15）：依据 Merchant App PRD v1.0.3，批次 A-G 已完成，酒店域统一使用 `merchant_store.id` 物业主键，商品模型仅保留给门票等非酒店业务。物业 KYC、资料审核、房型库存、员工范围、酒店下单/Trip、库存履约、退款、看板、收益、结算、消费者酒店、收藏、评价、排名和营销范围均以 `property_id/room_type_id` 执行；旧酒店商品行、字段、路由和菜单已退役，门票继续使用 `goods_id/sku_id`。G 专项及 A-G 共 242 项隔离回归通过，迁移账本 10/10，详见[整改计划](docs/plans/18-酒店商品收敛为物业整改计划.md)。

商户后台 All Properties / Add New Property（2026-09-14）：按 Figma `580:6100` 新增真实业务数据驱动的资产组合页，按 `585:7146` 新增物业基本信息第 1 步页面；下一步沿用原门店新增并预填名称、位置，其他新增字段暂只预览。左侧菜单按设计稿重组并保留原功能入口；新菜单迁移已在本地执行，merchant-web 构建及本地原型视觉检查通过。真实账号提交待验，详见[商户端落地记录](docs/plans/13-商家端merchant-web落地.md)。


Mtrip Ops 运维监控台（2026-09-02）：新增独立目录 `mtrip-ops/`,已从零依赖 MVP 增强为完整应用骨架,默认只读并监听 `127.0.0.1:56700`。本机 Docker 读取默认走 `sudo -n docker`,并提供 `/api/diagnostics/docker` 诊断。已支持 gateway 与 8 个主池服务 healthz、服务矩阵、Docker stats 负载降级采集、业务日志搜索/tail、request log 流量摘要、发布 dry-run、DB backup、health、单服务 logs/restart/build 白名单动作(显式开启 `enableActions` 后执行并写审计)。设计与计划放在 `mtrip-ops/docs/`,主进度见 `docs/plans/16-运维监控.md`。新增 APP 孪生池真实容器状态识别,缺失/停止时明确提示 C 端路由风险;界面支持玻璃、黑色经典、浅色专业、终端矩阵四套主题与紧凑/舒展密度,主题切换已改为下拉模式。服务页支持镜像、启动时间、运行时长、版本号、发布时间、Git SHA 与发布说明展示;当前 deploy/Dockerfile 尚未注入发布元数据,需通过 `deploy/release.json`、Docker labels 或 `MTRIP_RELEASE_*` 配置。发布页已补 Git 状态、fetch、pull --ff-only、最近提交与发布流程条。

admin-web 主题与公共资源补充（2026-08-30）：`cops/theme` 编辑主题资源从 JSON 字符串改为控件化编辑，弹窗 1180px、资源卡一行三列；缩略图接入公共资源选择弹窗。存储配置新增阿里云 OSS 驱动/endpoint，system-service 新增文件树、上传、目录过滤、目录新增/删除和 local/aliyun 实际资源删除接口；公共资源组件支持单选/多选、限定文件类型（不限/图片/视频/图片+视频等）、图片/文档/视频/音频上传选择，以及根目录/子目录维护。PHP lint、admin-web build、compose config 通过，本地迁移和 system-service 重建已执行。

M12餐厅资料展示（2026-08-29，未提交）：商户详情不再过滤餐厅等非酒店业务，补充类型列并显示现有联系资料/KYC；酒店专用物业关联边界不变，不扩展餐厅运营。admin构建与Browser混合业务核验通过，临时测试资料已清理，见[追加整改记录](docs/plans/m12/09-all-merchants-ui.md)。

M12列表整改（2026-08-29）：菜单统一“商户管理/所有商户”，四状态卡片、验证页搜索栏、八列与四图标入口落地；新增独立佣金档位，读取真实入驻类型及账号最后登录。33迁移已本地应用，499项隔离回归及统一质量检查通过；本次单次授权18文件本地提交、不推送，见[整改记录](docs/plans/m12/09-all-merchants-ui.md)。

M12 S7（2026-08-28）：本地独立环境、两轮历史迁移/124表恢复、473项集成和160项真实网关检查通过；修复商户服务权限切面未注册及证件驳回按钮文案。完整页面/在线原型验收尚未全部收口，见[阶段7记录](docs/plans/m12/08-s7-delivery.md)。真实扫码由用户后测，生产验收不在本轮范围；用户本次授权将19个S7文件与原ReviewController.php改动联合本地提交，不推送，后续提交仍需单独授权。

| 层 | 技术 | 位置 |
|---|---|---|
| 后端微服务 | PHP 8.1 + Hyperf 3.1 + Swoole 5(Docker 运行) | `backend/`(8 个服务 + shared 共享包) |
| 管理后台 | Vue 3 + Vite 5 + TypeScript + Ant Design Vue | `admin-web/` |
| 移动端 | Expo 51 + React Native + TypeScript | `client-app/` |
| 商户移动端 | Expo 51 + React Native + TypeScript | `merchant-app/` |
| 数据库 | MySQL 8.0 双库(mtrip_system / mtrip_business,54 表) | `database/` |
| 网关/部署 | OpenResty + docker-compose(k8s 预留) | `deploy/` |
| 运维监控 | Node.js 单体 + 服务端渲染 HTML | `mtrip-ops/` |

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
├── merchant-app/            # 商户移动端 Expo 应用(iOS/Android/Web,独立模块17)
├── database/                # DDL 按服务分目录 + seed/ 种子数据(管理员/菜单/站点)
├── deploy/                  # docker-compose.yml + openresty/ 网关 + k8s/ 预留
├── mtrip-ops/                # 独立运维监控台(Node 单体,服务端渲染)
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
./mtrip.sh build                  # 首次构建并启动完整开发栈，含 App 孪生池和增量迁移
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
| **运维监控台方案与计划** | [mtrip-ops/docs/](mtrip-ops/docs/) + [docs/plans/16-运维监控.md](docs/plans/16-运维监控.md) |
| **原始需求** | `设计文档/*.docx`(提取文本在 `docs/reference/`) |

## 核心开发约定(速览,详细定义见上表)

- **统一响应** `{code, message, data}`,成功 `code=0`;分页 `data={list,total,page,pageSize}`;错误码 40101/40102 未登录、40301/40302 无权限(全码表:`backend/shared/src/Constants/ErrorCode.php`)。
- **字段命名**:请求入参驼峰,列表行 snake_case 直出(例外见 HANDOFF 第 4 节)。
- **路由前缀**:管理端 `/api/v1/admin/{模块}/*`,移动端 `/api/v1/app/{模块}/*`,由网关按二级模块分发到对应服务。
- **RBAC 权限**:写接口加 `#[Permission('模块:菜单:按钮')]` 注解,键必须与菜单种子 `database/seed/02-menu.sql` 的 perm_key 一致(支持多键任一匹配);前端按钮用 `v-perm` 同键防护。
- **站点隔离**:`site_id=0` 超管全平台,其余强制本站点(`AdminContext::scopeSiteId`);新页面目录必须与菜单 component 字段完全一致(动态路由按此解析)。
- **密钥安全**:`MTRIP_JWT_SECRET` / `MTRIP_AES_KEY` 各服务必须一致,生产必须换强随机值;密钥类字段 AES-256-GCM 加密存储、展示脱敏。
- **数据库迁移**:生产增量只放 `database/migrations/VYYYYMMDDHHMMSS__lower-kebab.sql`（UTC 全局版本，只增不改）；`auto-deploy.sh --prod` 先迁移后发布，旧目录数字 SQL 仅作空库快照。

## 质量基线

统一执行入口:`powershell -ExecutionPolicy Bypass -File scripts/check.ps1`(按序执行下列四步,任一失败即非零退出):

1. 后端全量 `php -l` 语法检查(backend/,排除 vendor/runtime);
2. shared 纯逻辑单测 `php backend/shared/tests/run.php`(95 用例,无需 vendor/Swoole);
3. admin-web `npm run build`(vue-tsc 零 TS 报错);
4. client-app `npm run typecheck`。

**本机没装 php 时怎么跑前两步**（`check.ps1` 会停在第 1 步，历史上多条记录都卡在这里）：微服务镜像里有 PHP 8.1.27，先 `cd deploy; ./mtrip.sh start` 备好镜像，然后借容器跑——注意镜像有 ENTRYPOINT，必须 `--entrypoint` 覆盖：

```bash
# 1) 全量 php -l
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint sh \
  -v "C:\Codes\Mtrip\backend:/lint:ro" -w /lint mtrip-system-service -c \
  'for f in $(find . -name "*.php" -not -path "*/vendor/*" -not -path "*/runtime/*"); do php -l "$f" || exit 1; done'
# 2) shared 单测
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint php \
  -v "C:\Codes\Mtrip\backend:/lint" -w /lint mtrip-system-service shared/tests/run.php
```

第 3、4 步本机直接 npm 跑。`admin-web/dist` 已在 .gitignore，构建产物不用清理。

`merchant-app` 有改动时追加执行 `npm run typecheck --prefix merchant-app`；需要验证 H5 构建时执行 `npm run build:web --prefix merchant-app`。

- 工作方式:每完成一项任务,同步更新 `docs/plans/` 对应模块文件、README 进度表和 HANDOFF.md;交付前本地跑一次 `scripts/check.ps1` 作为验收入口。

## 当前状态(2026-07)

商户端「房量与价格」整页按 Figma 重写（2026-09-21，mTrip_Merchant 节点 `1163:16345`）：该 SECTION 的 **4 个画板其实是同一页的 2 种模式**——月历视图（Normal Edit，七列 Sun–Sat、格高 110、四态徽标/描边配色、非本月日号 40% 透明、选中格勾选徽标、底部四色图例）与批量视图（Bulk Update，房型 × 日期网格 + 每格多选、房型列 200 宽、已屏蔽格 `#EBF0FF` 底显示 `Blocked` 与 `-`），两者共用右侧 380 宽 Edit Panel（Room Status 分段控件 / Available Rooms 步进器 / Base Price per Night + 币种胶囊 / Cancel + Save Updates，标题与头部徽标按模式切换）。逐项照稿：工具栏卡（Room Type 下拉 + Select Period 月份导航与月份浮层 / 批量侧换成 Quick Filter Room Type + Bulk Date Range）、页面主色取稿面 **`#4169ED`**（与全局 `--mtrip-primary` `#2563eb` 不同，本页独立成 `tokens.less` 令牌组）、字体按稿混排 Plus Jakarta Sans（补 800 字重）与 Inter。**删除**稿面没有的块：房型×日期表格、单日抽屉、批量弹窗、PMS/CM 同步状态条与 Sync Now、Pricing Rules、Active Alerts、Calendar/List 切换（权限键 `mch:availability:sync` 与后端接口保留，只是前端不再有入口）。后端仅补一处：`AvailabilityController::roomTree()` 增选 `r.currency` 返回给面板只读展示，**无新接口 / 无新权限键 / 无迁移**。**三项实现侧定的规则**：日历单选一个日期；批量保存把选中格按房型分组切成连续区间后逐段调用既有 `batch-set`（不新增接口）;两种模式都禁止选过去日期，单日保存原样回传当日限制字段避免静默清零。**存疑保留**：稿面副标题写的是 restaurant / menu rates（本页是酒店，疑为餐饮模板复制），按「严格照稿」逐字实现且 i18n 键独立。验证：`merchant-web` 构建零报错、新增 `merchant-web/scripts/check-availability-figma.mjs` **真实 SSR 渲染 + CSS/图标令牌断言 72/72 GREEN**、容器内 `php -l` 通过、dev server 下 7 个模块 HTTP 200。⚠️ **未做登录态浏览器走查**（本环境无浏览器自动化、开发库无已知密码的商户账号），新增 `currency` 字段未端到端实测；⚠️ 该脚本未接进 `scripts/check.ps1`（本机仍未装 php）。走查修复：Select Period 右侧箭头渲染成斜杠——`AvIcon.vue` 的 `chevron-right` 路径 `m9 18 6-6-6 6` 末段折回、把折线原路画回去，已改为 lucide 原值 `m9 18 6-6-6-6` 并补图标断言防回归（RED 70/72 → GREEN 72/72）。详见[商户端落地记录](docs/plans/13-商家端merchant-web落地.md)与 [HANDOFF](docs/plans/HANDOFF.md)。

商户端侧边栏菜单调整（2026-09-17，9/18 补充 M4 例外）：Stores、Goods 两个菜单移出侧边栏（只在 `SideMenu.vue` 的隐藏名单里处理，页面、路由与权限保留，工作台与「所有物业」列表的 `/store` 入口不受影响）；Operations 分组为 Availability & Pricing 与 Booking Management，其中 `/availability` 仍仅选中具体物业时显示，`/order` 自 9/18 起支持 All Properties 聚合并在该上下文保持可见；新增 **HOTEL MANAGEMENT** 分组，仅在选中**酒店**物业时显示，含 Hotel Profile（复用 `/properties/:id/profile`，按当前选中物业动态生成入口）与 Room Types（原 Rooms 改名，路由 `/rooms` 与权限键 `mch:rooms:list` 不变）。切回 All Properties 时若停在其它物业专属页面仍跳回「所有物业」。菜单口径在 `src/config/menuSections.ts` 共用；详见[商户端落地记录](docs/plans/13-商家端merchant-web落地.md)与[M4 实现方案](docs/plans/实现方案-Merchant-M4-酒店预订管理.md)。
client-app 关怀模式房型详情页**第三次**逐节点复核（2026-09-18 深夜，Figma `2352:6030`）：用户再次指定同一节点，逐节点比对后发现**仍有 11 处数值/结构不符**（该页此前已改过两轮，其中两处是文档早写明的规格却没落到实现上）。按稿改动：① 顶栏渐变遮罩补齐（`2352:9557` 的 `Text Bg top`，主色 50% → 透明，带高 80，此前**完全没有**）；② 返回胶囊底 `rgba(0,0,0,.25)`（旧 `.4`）；③ 返回箭头 32（旧 20）；④ 大图↔内容 gap 10（旧无）；⑤ 覆盖层首行 `alignItems: flex-end`（旧 center）；⑥ 设施卡 gap 24（旧：与信息卡共用 16）；⑦ 分组小标行高 16（旧 20）；⑧ 属性行图标宽 20（旧 16）；⑨ 早餐卡 padding 24（旧 25）；⑩ 价格卡 padding 24 + 合计行 paddingTop 12（旧 25 / 13）；⑪ 价格卡阴影 `0/4 blur6 -4 + 0/10 blur15 -3`、CTA 阴影 `0/2 blur4 -2 + 0/4 blur6 -1`（**与 theme 的 `shadows.raised` / `shadows.media` 令牌注释逐字一致**，旧值分别误用 `subtle` 与无阴影）。**税费展示位（用户选定）**：稿面「Tax & Service Fees (15%)」本轮画出，值取占位常量 `TAX_AMOUNT = 0` 并注明「后端无税费字段、待后端出字段后替换」——后端实付里没有这笔税费，且稿面自身数就对不上（212,750 + 27,75，Total 仍 212,750）。**顺带抽取**：顶栏遮罩与 `LiteHotelCard` 封面上下两条渐变同规格，抽成 `components/common/EdgeGradient.tsx` 两处共用（逐字搬运，`LiteHotelCard` 视觉值一个没动）。**未照抄且已说明理由**：覆盖层两行稿里写死宽 370（可用 378，左右不等距）判为稿面手工尺寸；圆点数量不照稿的固定 3 枚（与其自身 "2/12" 矛盾）按实际图片数渲染（用户选定）；面积图标稿面 17.76 + 1px 下内边距未跟（三枚统一 20）。**新增校验脚本** `scripts/check-room-detail-lite.cjs`（35 项）**红→绿 8/34 → 35/35**（中间 34/35 是断言过度约束——把遮罩高度写死字面量 80 而实现用具名常量，已改为校验事实）；预览页脚本仍 81/81。i18n `hotels.lite.room` 三份各 **13 键同结构**，typecheck 零报错。⚠️ `scripts/check.ps1` 本机仍不可跑（未装 php，第 1 步即断，与本次改动无关）；⚠️ **未做真机/Web 冒烟**，需人工对图；⚠️ 缅文新增 1 条待母语复核（连同预览页 7 条共 8 条）。

client-app 关怀模式实景预览页按 `2352:7051` 重做（2026-09-18 深夜）：用户判定与稿面差距大，逐节点比对后**严格照帧**重写 `PropertyPreviewLiteScreen`；设计数据首次经 **Figma MCP**（`get_figma_data`）取回并落档。五处照帧改动：① **页签由文字药丸改成缩略图卡**（横滑 gap 12，Video/360 · Facilities · Rooms · Dining；图高 83.5 圆角 8、标签 Inter 500/14/20 `#475569`，**标签居中在缩略图正下方**，无 active 态——稿里页签是 Link）；② **360 区去掉白卡外壳**（268.5 高圆角 20 大图 + `rgba(0,0,0,.1)` 遮罩 + 居中 64 毛玻璃圆内 `view360` + 其下 8px 白字 `360°`，稿里没有原说明文字，已删）；③ **设施区双分组**（`Facilities` → 小标 `Kids areas` 16/600 `#8B8C91` → 223.75 英雄图 → 小标 `Pools & Gyms` → **两列网格**：格底 `#F3F4F6` 圆角 8、图高 171 圆角 20；两个小标是稿面静态文案，后端 `facilities` 是扁平 key 列表**无分组字段不猜**）；④ **顶栏照稿写 "Back"**（`#FEFEFE` + Effect/DS，Inter 600/24 **`#204DDA`**——⚠️ 不是 `colors.primary` `#4169ED`，同稿并存，新增令牌承载）；⑤ **页底纯白 `#FFFFFF`** 且三段无白卡，与同族三屏（`#EBF0FF` 页底 + 白卡）**观感不同**，是照帧结果不是漏改。**3 处只能近似并已在代码注释标注**：缩略图宽度（稿里 tab 帧 hug／内层图帧 fill 自相矛盾）取 120（高 83.5 是稿面值）、顶栏箭头 SVG fill 为空（`fill_97d170e1`）故与 Back 同色、`blur(2px)` 与两层 text-shadow RN 不支持（用 40% 白底 + 60% 白描边、阴影取主导层近似）。**自查另抓到并修掉两个渲染缺陷**：iOS 上 `overflow:'hidden'` 会把同一视图的 shadow 一起裁掉（原先两处把阴影与裁剪写在同一块＝没阴影，已拆成两层；同族 `LiteHotelCard` 有同样写法但未动它），以及设施格子可见圆角被格底的 8 裁掉（应取图的 20，已去裁剪）。**新增设计契约校验脚本** `scripts/check-property-preview-lite.cjs`（81 项断言：三语结构一致 + 10 词条三语非空 + 稿面文案逐字 + 4 个新令牌/色值 + 22 个结构标记 + 4 条 RN 渲染语义），**红→绿留痕** 26/72 → 77/81 → **81/81 GREEN**；该脚本**未接进 `scripts/check.ps1`**，需手动跑。i18n 三份 `hotels.lite.preview` 各 **14 键同结构**、整份相对 en-US 零缺失；⚠️ **缅文 7 条为保守译法需母语者复核**。typecheck 零报错。⚠️ **`scripts/check.ps1` 本机跑不了**——第 1 步 `php -l` 因**本机未装 php** 立即中断（390 文件全报 `CommandNotFoundException`），与本次改动无关、未动任何 PHP。⚠️ 未做真机/Web 冒烟，需人工对图。

client-app 关怀模式房型详情页按 `2352:6030` 重做（2026-09-18 夜，返工两轮）：**第二轮**——第一轮为了让 3D/360 可点，把大图做成绝对定位垫在 ScrollView 底下、覆盖控件浮在最上层，结果**滚动时那两枚按钮不跟着图走、一直悬在内容上方**，用户指出「不应该是悬浮组件」；已改成大图是 ScrollView 的第一个子元素、覆盖控件绝对定位在**大图内部**（一起滚也点得到），只有返回键仍压在图上，同时按 design context 校正了字体（房型名 24/40 ls-0.32、PRICE PER NIGHT 大写、金额 Inter700、参数行 16、脚注 16/16）。**第一轮不是设计变更**——该页本来就按这个节点做的，是实现与稿不符，逐节点比对后改了五处：① **大图底部覆盖层原先整层没做**（圆点条 + 张数胶囊 + See 3D View + See 360 View），且**必须放在 ScrollView 之后**才点得到（大图是绝对定位垫在最底层的）；② 大图 260→300 且内容不再压图（稿里内容区正好接在图后，原实现让首卡上移 120 压住了图）；③ Room Amenities 分组——接口给了 `sku.facilities` 就平铺真实值（没有分类字段不猜），没给才回落稿里的 ESSENTIALS/RECREATION/DINING 三组，复用 `DETAIL_AMENITY_GROUPS` 与信息页同源；④ **删掉吸底栏**（稿里 `2352:6164` 是 `hidden`，CTA 由价格卡内的 Book This Room 承担）；⑤ 顶栏去掉标题（稿里也是 `hidden`）。**踩坑记录**：`get_metadata` 把大图节点显示成无子节点的自闭合 frame，看上去图上什么都没有，实际那四个控件都是真子节点，**要用 `get_design_context` 才看得到**。**「Tax & Service Fees (15%)」仍不做且有据**：后端实付里没有这笔税费，而且**稿子自己的数就对不上**（212,750 + 27,75，Total 仍是 212,750，说明是占位），照画会让 Total 与结账实收不一致。i18n 补 `room.{see3d,see360}`、删随吸底栏失效的 `room.{startAt,reserveNow}`，三份仍 **1023 键零差异**。typecheck 零报错；本页 15 个静态 i18n 键 + 2 个模板前缀单独验过全部解析（**typecheck 查不出缺 i18n 键**）。⚠️ 未做真机/Web 冒烟，需人工对图。

client-app 关怀模式酒店详情页**改回** `2642:10749`（2026-09-18 夜）：**🔴 设计文件里有两套并存的 Lite 详情稿，已确定以 `2642:10749` 为准**——文字顶栏 + 标题卡（See Map / View Hotel Detail）+ **左 90×90 缩略图横排房卡** + Choose；`2540:16882` 那套（Hero 图库 + 9.2 评分行 + 整宽 192 封面大房卡 + Read Policies）**已作废**。白天曾按 `2540:16882` 整个改成 Hero 版（当时已提示这两个节点是旧版式，用户先选了"保留新版"），用户实际跑起来看过后判定"和设计稿差别太大"，要求改回，本次已重做。`HotelDetailLiteScreen` 与 `LiteRoomCard` 重写，`HotelGallery` **完全回退**到改动前（为 Hero 加的 `counterTextSize` 已无调用方，diff 归零），`guideSteps` 跟着去掉收藏心。**多房间保留**：Choose 点一下即加入并就地变加减器，减到 0 变回 Choose，选中后出 `2863:7627` 合计栏（Total Price + -15% TODAY + 购物车角标 + Continue）；⚠️ 合计只是展示，后端一单只收一个 sku。参数行的 Wifi 按 `sku.facilities` 正则命中才画，不硬编码。i18n 补回 `detailTitle/hotelPolicy/viewHotelDetail/seeRoom`、删掉作废的 `seeAllDetail/seeDetails/select/readPolicies`，三份仍 **1023 键零差异**。client-app typecheck 零报错；⚠️ **未做真机/Web 冒烟——这一页版式刚被判定"差太多"，建议先跑起来对图再继续**。

client-app 关怀模式详情族补齐 + 多房间选择（2026-09-18 晚，同一批四件事）：**① 订房日期弹窗加遮罩**——`DatePickerSheet` 原本按搜索页的稿**故意不带遮罩**（背后是 hero 大图），订房向导那处背后是白卡页面显得浮空，做成 **opt-in 的 `backdrop` prop（默认 false）**，只在订房处打开，另外三个调用方一行没动；遮罩绑同一个 `anim` 淡入淡出、`pointerEvents="none"` 保留原来的点击关闭，色值 `rgba(0,0,0,0.25)` 与同屏的 `GuestRoomSheet`/`AlertDialog` 一致。**② AI Summary 补到关怀版两处**（`2540:7491` 信息页尾 / `2540:18286` 评价页）——此前只有完整模式 `HotelReviewsTab` 有，关怀版评分与维度条都画了偏偏漏了这块；抽成 `LiteAiSummary` 两页共用，文案**共用完整模式那五个 `hotels.detail.reviews.*` 键**不另造 Lite 词条（否则两种模式会给出不同总结）；该块是写死的设计稿文案，后端没有评价/AI 总结接口。**③ 详情族底栏**（`2540:18477`）抽成 `LiteDetailBottomBar`，**逐帧核过不是"统一加"**：信息页/政策页/评价页有，房型详情早有自己的 Book This Room，**主详情页没有**（那帧 bottom bar 是 `hidden`，且房卡各自带 Select）、**实景预览没有**（稿里无此节点）；评价页原本不取数，为底栏起价加了一次轻量 `fetchHotelDetail`，拿不到只是不画金额行。**④ 主详情页补回多房间选择**（`2642:10749` / 底栏 `2863:7627`）——用户给的两个节点其实都是**旧版式**，已确认**只搬能力不回退版式**，Hero 图库/评分行/整宽封面房卡全留着；房卡 Select 点一下即加入并**就地换成 −/数量/+ 加减器**（加减器规格取自旧稿 `2707:13670`），减到 0 变回 Select；选中后底部出「Total Price + 购物车角标 + Continue」，客服悬浮球随之上移。⚠️ **合计只是展示**（用户确认）：后端 `order/create` 一单只收一个 sku，Continue 仍带**第一个**选中的房型进向导，代码注释与文档都写明，别当成没接完。`-15% TODAY` 取 `DETAIL_DEMO.discountPercent`，后端无此字段，与完整模式同口径。**质量基线四步这次全跑完**：backend `php -l` 390 文件 0 错误、shared 单测 99 用例 975 断言全绿（两步借微服务镜像的 PHP 8.1.27 跑，见「质量基线」一节）、admin-web build 通过、client-app typecheck 零报错；三份 i18n **1023 键零差异**。⚠️ 仍未做真机/Web 冒烟，需人工对图；缅文需母语者复核。

client-app 关怀模式订房流程改版：4 步 → 2 步（2026-09-18，Figma section `2540:19101`）：2026-09-15 那一版是**推导**的（设计侧当时没出 Lite 稿，从完整版 `1675:5776` 按换算规则放大一档），做成 dates → guests → review → payment 四步。这次设计出了真稿，整条流程重做：step 1 `2540:19394`「Confirm Your Room & Date」（房型摘要卡 + Guest Info + Add On Service 折叠条 + Cancellation Policy）、step 2 `2540:19621`「Price Breakdown」（价格明细表 + Coupons 券卡 + 支付渠道 + See Other Payment 折叠条），成功页按 `2540:19863` / `2540:19741` 重写成一屏两态（Booking Confirmed! / Booking Confirming）。新增 `LiteStepConfirm` + `LiteStepPay`，删除 `LiteStepDates` / `LiteStepGuests` / `LiteStepReview` / `LiteStepPayment` 四个旧组件。**`liteBookingShared.ts` 的换算表整表作废改实测** —— 真稿字号**比推导值小**（区块标题 20/32 而非 32/40、输入框高 56 文字 16 而非 64/24）。壳去掉顶栏与「Step N of 4」进度条（新稿两屏都没有），吸底栏由「预计总价 + 一枚大按钮」换成**两枚等宽按钮**。**数据层仍与完整模式共用 `useBookingWizard`**，只加了 `steps`（序列覆盖，Lite 传 `['guests','payment']`，**刻意复用原 step key** 以便两段校验原样生效）与 `confirmLogin`（未登录先弹确认浮层，完整模式默认关）两个可选口子；**顺带修掉一处护栏失效**：`goNext` 里「离店日期为空」的拦截原本限定 `step === 'dates'`，Lite 没有这一步就会整个失效、带着空 `endDate` 去下单被后端打回，已改为无条件前置判断。**已确认的取舍**：新稿把日期/人数画成只读摘要，按用户选定接上了现成弹层（`DatePickerSheet` / `GuestRoomSheet`）；支付主位卡放 **mTrip 钱包余额**（后端唯一真渠道），MMQR 等收进「See Other Payment」置灰 + Coming soon——照稿把 MMQR 摆主位的话默认那张卡付不了款；「View More」是就地展开加购卡列表（保险入口不丢）。**Add New Guest / Insurance 两页本次未动**——逐屏比对过，与已实现的 `1675:5777` / `1675:5900` 同版式。**已知缺口**：成功页 `confirming` 态目前产生不了（后端 `ORDER_STATUS` 没有「等酒店确认」这一档），两态都实现好放着；新稿没有 Special Requests 输入框，真实下单的 `remark` 因此恒为空；新稿成功页没有二维码，核销码仍在订单详情页。client-app typecheck 零报错、三份 i18n **1021 键零差异**、已删组件零残留；`scripts/check.ps1` 因本机未装 php 仍停在第 1 步后端 lint。⚠️ **未做真机 / Web 冒烟；完整模式订房流程需要回归**（动了共用的 Hook）；缅文需母语者复核。

client-app 关怀模式酒店详情页改版（2026-09-18，Figma section `Hotel Details Lite` **新稿** `2540:16881` / 首帧 `2540:16882`）：设计出了新版，Lite 搜索结果点酒店进的那一页首屏整个换掉——旧稿的「文字顶栏（返回 + Hotel Details + Hotel Policy）+ 标题卡 + 左 90×90 缩略图小房卡」改成「整宽图库 Hero（返回与星级压在图上）→ 标题卡（酒店名 / 评分 / 地址）→ Choose a Room 房卡列表 → Read Policies 描边按钮」；该帧的 Mobile Bottom Bar 在稿里是 `hidden`，故**本页没有底部价格栏**。**多选态整个删掉**（用户确认）：`mode` 切换、「+ Choose Multiple」链接、房卡加减器、底部 Total Price + 购物车 + Continue 合计栏全部移除——后端一单只收一个 sku，原先的 Continue 也只是带**第一个**选中房型进向导，本就是假功能。`LiteRoomCard` 按 `2540:17042` 重写成**整宽 192 封面在上**的大卡，结构与完整模式 `HotelRoomCard` 同型（封面定高 + overflow hidden、角标绝对定位、正文自带不透明底色、渐变 id 跟卡片走），字号取 Lite 档；封面图源改走 `resolveMediaUri` 过滤脏值（后台实测填过 `'111'`），圆点按**实际张数**渲染而非硬写三枚。**复用不新写**：Hero 直接用现成的 `HotelGallery`（渐变 / 圆点条 / 张数胶囊与新稿逐项吻合），只给它加了一个可选 `counterTextSize`（完整版 12 / 关怀版 16），完整模式调用点零改动；状态栏黑条 + 悬浮顶栏 + 客服悬浮球照搬完整版 `HotelDetailScreen`；九枚图标全部命中 `HomeIcon` 已有字形，房卡兜底图沿用 `TEMP_ROOM_COVERS`（370×192，正好是新稿封面框尺寸），**本次零新增图标与图片资产**。**评分口径**：稿上是十分制（9.3）而后端 `goods.rating` 是五分制，按用户确认 **×2 换算**显示，EXCELLENT 门槛仍按五分制原值判（≥4.5）。**未做**：房卡划线原价与「5% off for 7Nights」（`GoodsSku` 只有 `base_price`，没有原价/促销字段，组件留了可选 props 等后端下发）；房卡收藏心走 comingSoon（`addFavorite` 是**物业级**收藏，没有房型级接口，与完整版 `HotelRoomsTab` 同一处理）；Bestseller 接口无此标记，按「排序最前两张」等价处理。路由与入口一行未动。i18n 三份各 +4 键、−8 个失去调用点的键，`hotels.lite` 三份均 32 键零差异。client-app typecheck 零报错、三份 i18n 键集一致、已删键全仓零残留；`scripts/check.ps1` 因**本机未装 php** 停在第 1 步后端 lint（与本次改动无关，未动 PHP）；**未做真机 / Web 冒烟，需人工对图验收**。

客房管理「今日可售」看不出非今日订单（2026-09-17）：商户新增房型、设好客房总数后在 APP 下了该房型的单，卡片上的「今日可售」纹丝不动。根因**不是丢单**——`goods_daily_stock` 按日期存，订单只占「入住日 → 离店前一晚」那一行（`OrderStockService::datesOf`），而列表的「今日可售」只读 `stock_date = 今天` 的一行：那笔单入住的是**次日**，今天这一行不存在，列表便按房型默认可售配额兜底，与下单前完全一致（同房型次日剩余确实由 30 掉到 29）。那笔单落在"次日"则是因为订房向导 `normalizeDates()` 在没有入离日期时兜底写死「明天起 1 晚」，而「我的精选 → 酒店详情 → 订房向导」这条链路不带日期，用户以为订的是今天；搜索页默认却是「今天 → 后天」，两处口径不一致。**顺带推翻**了原计划的「审核通过时预生成日库存行」——生成出的今天那行同样是 30，治不了本现象，已放弃。修复两处：**①** `GET /merchant/rooms/list` 每行新增 `upcoming_days / upcoming_stock_left / upcoming_stock_date / upcoming_sold`（明天起 7 天内未关房日期的最低剩余、最低日期、窗口内已售+锁定间夜），merchant-web 卡片在「今日可售」旁显示「未来 7 天最低 29 · 9/18」并在窗口内有占用时高亮；**②** `bookingFormat.ts::normalizeDates` 兜底统一为「今天起 2 晚」，与 `defaultDateRange(2)` 对齐。新增 `backend/services/goods-service/test/room-list-availability.php`（13 条断言，已并入 `scripts/test-room-remediation.sh`）；质量基线四步等价执行全绿（390 文件 `php -l` 零错、shared 97 用例/968 断言、admin-web build、client-app typecheck）另加 merchant-web build。遗留：无头浏览器点击走查未做、后端 `date('Y-m-d')` 的 UTC/本地时区错位一天（北京时间 00:00–08:00）、门票页默认日期仍为「明天起 1 晚」。详见[客房整改计划](docs/plans/20-客房管理Figma与PRD整改计划.md)第 12 节。

客房默认可售配额回退修复（2026-09-16）：C 端 `POST /api/v1/app/order/create` 报 409「库存不足」的根因是 `RoomDefaults::stock()` 用 `??` 回退（`launch_stock ?? base_stock`），而 merchant-web 新建房型的 `launch_stock` 初值就是 0 —— **0 不是 null，空合并运算符不会回退**，于是「填了客房总数 40、没填默认可售配额」的房型在没有日库存记录时被补建成 `stock_total=0`，`OrderStockService::lock()` 判定 `available = 0 - 0 - 0 < 1` 抛 409；同一函数的另一个消费方（消费者日历）也一直返回 `stock=0`。已改为 `launch_stock > 0 ? launch_stock : base_stock`（0/null/缺失一律视为「未设置」，真要不卖应走停售或单日 `is_closed`），并在 `backend/shared/tests/cases/SupportTest.php` 补 0/null/缺失/负数回退与周末价回退用例。开发库房型 5 的 `launch_stock` 已设为 40，消费者日历 `stock` 由 0 恢复为 40；`goods_daily_stock` 补建 INSERT 的非空列已核对。同日把 merchant-web 侧一并收口（`merchant-web/src/views/rooms/components/RoomEditor.vue`）：客房总数变化时自动同步尚未设置或仍在跟随的默认可售配额（商户显式填过的更小值不覆盖）、打开编辑器时按客房总数补历史 0 值（补值在 baseline 捕获之前，不会「打开即脏」）、提交审核时拦截「客房总数 > 0 而配额 ≤ 0」（仅提交拦截，草稿仍允许不完整；客房总数 0 的复制草稿不拦）。13 条真实 Vue 响应式断言与 merchant-web 生产构建通过。详见[客房整改计划](docs/plans/20-客房管理Figma与PRD整改计划.md)。

商户端客房管理列表样式修复（2026-09-16）：搜索房型框按用户要求**去掉右侧搜索图标只留输入框**，改用仓库既有的 `a-input` + `@press-enter` 写法（回车查询）——原先用 `a-input-search` 时 antd 把按钮固定成 32px，全局 `.ant-input{min-height:34px}` 又把 affix 包裹层撑到 44px，两者不同高；现输入框实测 260×34、与同排下拉框一致，DOM 中不再有搜索按钮。客房卡片封面用 `display:grid` 时图片 `height:100%` 落到固有尺寸（实测 597px）并因 `.cover` 定位而盖住客房信息，现改为 flex 居中 + `overflow:hidden` + `object-fit:cover`，图片恒为封面高度（200px/窄屏 210px）。无头 Chrome 实测 + 前后截图对比，merchant-web 生产构建通过。详见[客房整改记录](docs/plans/audits/2026-09-16-room-remediation.md)。

客房管理整改（2026-09-16）：按 Figma `930:11444` 与 PRD v1.0.3 模块 2 完成[阶段 0–5](docs/plans/20-客房管理Figma与PRD整改计划.md)。商户 Web 已实现卡片列表、详情、四步编辑、图片/视频/360 全景/平面图热点；库存、周末价、取消政策快照、媒体归属、审核及订单删除门禁已收口，管理后台可审核完整媒体。`V20260916005000` 已应用，账本 18/18；客房专项、物业发布/消费者回归、389 PHP lint、shared 95/957、双 Web 构建、client 类型检查和桌面/窄屏检查通过。外部 VR/PMS 等待服务商；两个 App 功能代码未改。

酒店物业详情界面（2026-09-15）：按 Figma `696:4024` / `712:6419` 完成真实房型、房量、评分指标，六页签布局及 Hotel Details 整页编辑；新增物业双电话密文、邮箱、经纬度、图片上传与启停状态，消费者仍只收到启用图片。地图暂用静态占位，未修改两个 App。迁移已应用，双 Web 构建、隔离发布链路、383 PHP lint、95 shared 测试及桌面/手机预览通过。详见[商户端落地记录](docs/plans/13-商家端merchant-web落地.md)。

client-app 酒店页用户指引（2026-09-16，Figma section `Hotel Search Coach mark UI` `2150:4865`）：七步 coach mark 讲完整条订房链路（目的地 → 日期 → 住客 → 选酒店 → 选房 → 填资料 → 付款）。入口按要求是**筛选旁边的问号**：完整版酒店搜索页与结果页顶栏各加一枚问号圆按钮，关怀版搜索页顶栏那枚「how do I book ?」药片由 comingSoon 死链接到同一浮层并放大一档字号；**不自动弹**，只有点问号才出，左上角 Skip Tutorial 为快速关闭。设计稿实测取自 Coach Mark 2 `2154:7076` 的 design context（遮罩纯黑 .95、标题 Inter Bold 24 白 / 说明 16 `#D9E1FB`、底栏 Previous + 7 点 + Next），曲线箭头是设计稿导出 SVG 的单路径、**逐字符照搬未重绘**。**示例卡一律复用现成组件与设计稿同源演示数据**：步 4 `HotelResultCard` + `DEMO_RESULTS[0]`（就是稿上那家 Heritage Bagan），步 5 `HotelRoomCard` + `DETAIL_ROOMS[0]`（Standard Room / 4 Left / 1 Queen / 32 sqft / MMK 195,000 与稿逐字段吻合），步 6 `FormInput`，步 7 `PaymentMethodRow`；关怀模式下步 4/5 换 Lite 卡。**已知偏差**：4~7 步高亮的元素属于别的页面、当下并未挂载，做不成真实挖洞高亮——设计稿本身也是「遮罩 + 元素副本画在遮罩上」，故七步统一成「遮罩之上画该步示例卡」，示例卡是演示数据、不反映用户当前搜索结果；步 6 只画三栏（四栏整卡近 450 高，小屏放不下）。i18n 三份各补 18 键（连同下述修复共 990）。**冒烟时抓到一个既有 bug 并修了**：`hotels.detail.rooms.breakfast` 三份 i18n 里根本不存在，而 `lite/LiteRoomCard.tsx:109` 一直在 `t()` 它——关怀模式房型卡上凡 `breakfast===1` 的房型都会把原始键名当文案画出来（与本次引导无关，是第 5 步复用该卡后暴露的），已补三份。**Web 冒烟已做**：`expo start --web` + headless Chrome（402×874，playwright-core 驱动本机 Chrome，装在仓库外，未加任何依赖），两种模式各 35 条断言全绿（七步标题、第 1 步无 Previous、第 7 步 Done、Done/Skip 关闭、Previous 回退、重开从 01 起），并逐屏看过截图；完整版顶栏三枚圆按钮实测 x=20/298/346，问号确在筛选旁。冒烟时后端没起，金额显示为 EUR（`siteStore.currency` 初值，全局如此，非本功能问题），接上网关即为 MMK。client-app typecheck 零报错；**缅文文案非母语者产出，需人工过一遍**；真机（iOS/Android）冒烟仍未做。

client-app 关怀模式订房流程（2026-09-15，Figma section `Booking Flow` `759:9777`）：关怀模式的下单链路补齐，此前 Lite 详情页点 Choose 会掉回完整版向导、字号从 20/24 骤降到 14/16，现在搜索 → 详情 → 订房 → 成功页全程同一套字号。**设计侧没有出订房流程的 Lite 稿**——指定的这个 section 与完整模式已实现的 `Multi Booking Hotel Booking Flow` `1675:5776` 逐屏同构（逐帧截图比对过 `224:4808` ≡ `1675:6292`），故按仓库已确立的关怀模式换算规则从该稿**推导**：版式不变、每个元素放大一档，换算表写在 `components/hotel/booking/lite/liteBookingShared.ts` 头部。**业务逻辑抽成共享 Hook**：新增 `screens/hotel/useBookingWizard.ts` 承载原 `HotelBookingScreen` 的全部状态 / 副作用 / 下单支付（真实与演示两种模式、只开通钱包余额、加购与多住宿不提交、优惠券服务端试算），完整版页面只改取值来源、**JSX 与像素零变化**（与「我的精选」`useMyPickData` 同一做法），两种模式的实付金额与用券口径因此必然一致。新增 2 个路由 `HotelBookingLite`（4 步同一路由内切换）与 `BookingSuccessLite`，外加 `liteBookingShared` + 四个步骤组件；`HotelDetailLite` / `RoomDetailLite` 改跳 Lite 向导（完整模式不受影响）。**复用不重写**：日历只给 `BookingCalendar` 加了个 `lite` 尺寸开关（排布与选区数学两种模式同一份），选券弹窗、支付结果浮层、常旅客 / 新增旅客 / 保险三个子页全部复用完整模式那几个，**文案复用 `hotels.booking.*`，i18n 零新增键**（仍 971，三份一致）。**刻意砍掉的死路**：多住宿 `trip` 步与 Add More Stay（后端一单一个 sku，完整模式真实下单下本就只弹 Coming soon）、支付页银行卡 / 手机银行的展开层（展开后是写死的示例卡）、支付汇总卡的 View Details（跳完整版版式的页面会掉字号）、成功页的引流卡。加购、税费、渠道置灰口径与完整模式逐条一致。顺带修掉 3 处**既有**类型错（都在上一批未提交的 Lite 文件里）：两处向导入参 `goodsId/skuId` 应为 `propertyId/roomTypeId`，一处收藏映射 `f.goods_id` 应为 `f.property_id`。client-app typecheck 零报错；**未做真机冒烟**，`scripts/check.ps1` 因本机未装 php 停在第 1 步后端 lint（与本次改动无关，未动 PHP）。

client-app 关怀模式酒店详情七屏（2026-09-15，Figma section `Hotel Details Lite` `2352:5591`）：Lite 结果页点 Choose 之后的整条详情链路落地，七张稿做成 6 个路由——主详情页（`2492:10399` 单选 + `2707:13098` 多选**一页两态**：房卡 Choose ⇄ 加减器，多选时底部出 Total Price + 购物车 + Continue 合计栏）、房型详情 `RoomDetailLite`、信息页 `HotelInfoLite`、政策页 `HotelPolicyLite`、评价页 `HotelReviewsLite`、实景预览 `PropertyPreviewLite`，另加 `LiteRoomCard` 与四页共用的 `liteShared` 样式壳。**内容与完整模式同源**：设施/周边/评价/政策复用 `detailDemo` 与 `hotels.detail.*` 文案，不另造 Lite 数据；**退改规则接真实 `refundRules`**（rule_type 1/2/3，无规则按免费取消，与后端 `computeRefund` 兜底一致）。Lite 结果页卡片改跳 `HotelDetailLite`，关怀模式从搜索到选房全程留在 Lite 版。**刻意没做**：多选只算合计不多间下单（后端一单一个 sku，Continue 仍带第一个选中房型进订房向导，等 Lite 版订房流程再补）、房型详情不画「Tax & Service Fees (15%)」（结账实付里没有这笔）、设施卡不分三组（后端 facilities 无分类字段）、评分/评论/景点仍是设计稿数值（无评价接口）、360°/地图/区域页签 comingSoon。新增三枚 fluent 图标（`imageCopy` 项目已有，去重复用）；i18n 三份各补约 40 键。client-app typecheck 零报错；**i18n missing/extra 脚本因本机 Bash 限流未跑**，未做真机冒烟。

client-app 关怀模式酒店搜索三屏（2026-09-15，Figma section `Hotel Search Lite` `2312:6435`）：Lite 版**搜索页 + 结果页 + 筛选浮层**落地，关怀模式首页的 Hotels 卡改跳 `HotelsLite`（完整模式仍走 `Hotels`）。搜索页把设计稿的四个状态（默认 / 聚焦 / 输入中 / 已选目的地）落成一页一个 `focused` 状态，只保留搜索卡（完整版下面的折扣卡、促销卡、广告位关怀稿里没有），元素统一放大一档；新增 `LiteHotelCard`（星 24 / 心 32 / 名 24 / 价 20 + Choose 按钮）与 `GuestRoomSheet`（Edit Room & Guest，三行加减复用订房向导的 `GuestCounterRow`）。**筛选浮层直接复用完整模式的 `HotelFilterSheet`** —— Lite 稿与它逐段同构，再抄一份只会多一处要同步维护的地方；日期复用 `DatePickerSheet`，结果页数据/收藏/上拉加载与完整版同一套 `/app/goods/list`。最近搜索是真的（本地 `mtrip:hotel-recent`，最多 3 条）；因为没有地点库，设计稿「输入中」那屏的联想列表改成「用当前输入搜索 + Nearby + Search on Map + 最近搜索」，Nearby / 地图 / 语音 / how do I book 一律 comingSoon。新增 `HomeIcon.mic`（字形取自设计稿导出的 SVG，不是手画），大图沿用现成的 `hotels/hero.png`（比对过是同一张）。房间与入住人只在路由参数里回显、不参与列表请求（接口无此参数，日期同理）。i18n 三份各补 26 键（共 912，零 missing / 零 extra），client-app typecheck 零报错；未做真机冒烟。

client-app 注册页邮箱换姓名 + 登录/注册右上角按钮改版（2026-09-15）：注册表单第二栏由邮箱改为**姓名且必填**，提交后 AES 加密落 `user_info.real_name`（`AuthController::register` 新收 `realName`，`UserAuthService::register` 末尾加可选参；**不动 `real_name_status`**——自己填的名字不等于实名认证，也未写入 `nickname`，昵称仍是自动生成的「User+手机后四位」）。图标用设计稿同款 `fluent:rename-a-20-filled`，占位符 `user.namePlaceholder` = "Enter your name"（三语，i18n 885 键）；`SignupDraft.email?` → `realName`，`apiRegister` 入参同步替换，两个 email 文案键保留备后续「完善资料」页使用。右上角登录/注册入口按改版稿 Figma Onboarding `2540:13083`（Login `2540:13084` 节点 `2540:13182`、Signup `2540:13284` 同款）由纯白文字链改成**黑 25% 底、圆角 20、px12 py8 的药丸按钮**，文字 Inter SemiBold 20/24 白色；改在共用的 `AuthShell` 一处，登录/注册/验证码/推荐码/忘记密码五屏同时生效，**左侧返回键与其他样式按要求未动**。已真库端到端冒烟：经网关 8081 注册（后台无短信渠道，故不带 `verifyToken`），`user_info.real_name` 落 52 字节密文并能解回原文、`real_name_status` 保持 0，冒烟数据已逐表清理；client-app typecheck 零报错（这一轮真抓到一个漏改：`userStore.register` 的 `extra` 形参类型仍写着 `email?`，已修）、后端 `php -l` 通过、shared 95 用例/957 断言全绿、i18n 三份 885 键零差异。**注意改后端代码必须重启服务**——容器挂的是新代码但 Swoole 进程启动时就把类加载进内存了，`./mtrip.sh restart user-service` 之外还要单独重启 `user-service-app`（C 端 `/api/v1/app/*` 走的是这个孪生）。

注册恢复真实短信 OTP（2026-09-16）：SMSPoh 已可测试、后台已配好渠道，按既定删除清单移除临时固定码页——删掉 `screens/user/FixedOtpScreen.tsx`，以及 `RegisterScreen` 的 `USE_FIXED_OTP` 常量与那段 if、`navigation/index.tsx` 的 import 与 `Stack.Screen`、`navigation/types.ts` 的 `FixedOtp` 路由项。注册恢复为 `Register →(sms/send 发码)→ VerifyOtp →(sms/verify 换一次性 verifyToken)→ ReferralCode`；`VerifyOtpScreen` 自始至终原样保留，删完即自动接回，**本次没有新写任何代码**。**这是必修而不是清理**：后台新配的渠道（`sys_sms_channel` id=4，`provider_code=smspoh` / `status=1` / `site_id=0` 全局 / 未删除）已让 `SmsVerifyService::enabled()` 对所有站点返回 true，而 `AuthController::register` 是「渠道启用即强制」，固定码页永远拿不到 `verifyToken`，留着的话每次注册都会被 `40111 请先完成手机号短信验证` 打回。**验证**：① 取出渠道密文，在 user-service 容器内用它自己的 `MTRIP_AES_KEY` 成功解密出 api_key(41)/api_secret(32)、`sign_name` 非空——这四项正是 `channel()` 判 null 的全部条件，故 `50021 短信服务未配置` 不可能再出现；② 经网关不带 `verifyToken` 调 `register` 返回 `40111`，且 `user_info` 行数 6→6 **无副作用**，反证渠道确已生效；③ client-app typecheck 零报错。**未做**：真实收发短信的端到端（需要能收码的真实号码，留给用户自测）。

~~【临时】注册验证码改为纯前端固定码页（2026-09-15）~~（**已于 2026-09-16 撤销，见上一条**）：client-app 新增 `screens/user/FixedOtpScreen.tsx`（路由 `FixedOtp`），**只认 `123456`、纯前端校验、不发任何网络请求**，注册流程变为 `Register → FixedOtp → ReferralCode`；**后端一行没改**。可行的原因是后台当前没有启用中的短信渠道，`SmsVerifyService::enabled()` 为 false，`register` 不强制 `verifyToken`（已实测：`sms/send` 与 `sms/verify` 均回 `50021 短信服务未配置`，不带 token 的 `register` 正常成功）。真页 `VerifyOtpScreen` 原样保留、一行未动，新页刻意不复用它的组件以免删除时误伤。**接通真实 OTP 时的删除清单**：`FixedOtpScreen.tsx`、`RegisterScreen` 的 `USE_FIXED_OTP` 常量与那段 if、`navigation/index.tsx` 的 import 与 `Stack.Screen`、`navigation/types.ts` 的 `FixedOtp` 路由项（四处都带同一句「临时 · 接通真实 OTP 时删掉」注释），删完原「发码 → VerifyOtp」链路自动恢复。**先前那版后端万能码 `MTRIP_SMS_BYPASS_CODE` 已整体回滚**（服务、配置、compose、.env.example、三条单测、验证码页提示行全部还原）——那一版是真的认证绕过（知道手机号即可免密登录他人账号），且删光短信渠道也关不掉它。client-app typecheck 零报错、shared 95 用例/957 断言全绿、真库端到端冒烟通过且数据已清理。

client-app 关怀模式改为默认模式（2026-09-15）：引导流程由「纯开屏 → 语言 → 模式 → 主流程」缩回「纯开屏 → 语言 → 主流程」，`commonStore.liteMode` 初值改为 `true`，新装用户与从未选过模式的老用户直接进关怀版三屏。**模式选择页按要求原样保留**——`App.tsx` 新增 `ASK_MODE_ON_LAUNCH = false`，`'mode'` 那段 phase、`ChooseModeScreen` 渲染分支与 `onPickMode` 回调全部留着，翻回 `true` 即恢复三段引导。`hydrate()` 未改：本地存过 `mtrip:app-mode` 的用户仍读回自己的选择（**显式选择优先于默认值**，此前选过完整模式的人不会被强推）。改模式的唯一入口现在是「更多」页的 Lite Mode 开关（完整版与关怀版各有一个，同一份状态），已在代码注释里写明不能拿掉。`npm run typecheck` 零报错；未做真机冒烟。

client-app 支付收敛到余额一种（2026-09-15）：订房向导支付步与订单详情里，**只有 mTrip 钱包余额可用**，MMQR / KBZPay / Wave Pay / 到店付 / 银行卡 / 手机银行 / Stripe / PayPal 一律置灰并挂 Coming soon 角标，点按只弹提示、不会被选中，也不再发任何支付请求。余额支付是**真扣款**：`/api/v1/app/order/pay` 的 `payMethod` 白名单扩到 `[1,2,3]`，新增 `3=余额`，后端在同一事务内行锁扣 `user_info.balance`、写 `user_balance_log`（`change_type=2` 消费，金额记负数并带前后余额快照）、置订单已支付生成核销码、写 `finance_flow`（`flow_type=1` 收入 / `biz_type=1` 订单支付 / `pay_channel=3` / `trade_no=WALLET+流水号`），任一步失败整单回滚；`WalletService` 因此补了与 `credit()` 成对的 `debit()`，余额不足抛「钱包余额不足」。1/2 保留为 mock（不写资金流水），只是 C 端不再调用。App 侧支付页的钱包卡与余额行改读 `/app/user/me` 的真实余额，**进支付步与打开待支付订单详情会先刷新一次资料**（本地缓存的旧余额会把够钱的用户误判成余额不足），余额不足在客户端就拦住、不去创建那张十分钟后才过期的待支付订单，后端 `debit()` 是第二道闸；支付成功后刷新资料。两处重复的 `payOrder` 合并为 `api/pay.ts` 一份；i18n 三份各补 4 键（共 882，零 missing / 零 extra）。**未动 Trip 支付**（`TripController::pay` 仍只收 1/2，C 端没有入口调它）。质量基线四步全绿（后端 356 文件 `php -l` 零错、shared 95 用例/957 断言、admin-web build、client-app typecheck）——本机 PATH 无 php，前两步在 `mtrip-order-service` 镜像内跑。

client-app 关怀模式落地三屏（2026-09-14，Figma section Home Lite `2540:21120`）：`liteMode` 开始真的换页面——首页 / 我的精选 / 更多各出 Lite 版（大字号、大卡片、一屏之内不再有横滑与小图标）。**在 Tab 这一层分叉**：`MainTabs` 按 `liteMode` 选组件与 `LiteTabBar`，不在页面内写分支（两版版式差得远，塞进同一组件会变成两套并行 JSX）；优惠中心没有 Lite 稿，沿用完整模式那一页。「我的精选」的取数抽成 `useMyPickData` 供两种模式共用——同一账号在两种模式下看到的订单与收藏必须是同一份。Lite 首页的四个业务线就是 `QUICK_ACTIONS` 那四个，落地规则（route → goodsType → comingSoon）一字不差共用；插画另存 `assets/images/lite/*.png`（现有 `home/*.png` 是整块满幅的蓝色方块图标，叠在 Lite 的蓝卡上会多出一个蓝方块），Figma 导出的原始分辨率共 4.6MB 已按 3× 渲染尺寸压到 602KB。Lite More 按用户选定**补了设计稿没有的「语言 + 退出登录」卡**（缺了这两项，关怀模式用户退不出账号、改不回语言，只能卸载重装），站点与 GDPR 按设计稿去掉。新增 `Outfit_700Bold` 字重；i18n 三份各补 6 键（共 878，零 missing / 零 extra）。**未实现**：设计稿的「Multi Booking (2 Stay)」多住宿卡（后端一单只对应一个 sku，完整模式同样没做）。`npx tsc --noEmit` 零报错、`expo export -p web` 通过（四张插画与新文案均已进包），构建产物已清理。

client-app 开屏新增关怀模式选择页（2026-09-14，Figma Splash `2485:7324`）：引导流程补第三屏，变成「纯开屏 → 语言选择 → 模式选择 → 主流程」。两张模式卡（Lite / Full）各带一个 CTA，点哪张就按哪种模式直接进入；选择存本地 `commonStore.liteMode` / `modeChosen`（键 `mtrip:app-mode`），语言与模式各记各的状态，**老用户本地已有语言、没有模式记录时只补问模式这一屏**。「更多」页原先那个本地 `useState` + comingSoon 的 Lite Mode 开关已接到同一份状态，页面脚注承诺的「随时在设置里改」这才成立。开屏外壳（波浪 + logo）抽成 `components/splash/SplashBackdrop.tsx` 供两屏共用，视觉未改。i18n 三份各补 10 键（共 872 键，零 missing / 零 extra）。**`liteMode` 目前只记录选择，尚未改变任何页面的字号与信息密度**——设计稿描述的「更大的字、更简的页面」是一整套页面降级规则，需单独设计。`npm run typecheck` 与 `expo export -p web` 通过，构建产物已清理；`scripts/check.ps1` 因本机 PATH 无 php 停在第 1 步后端 lint（与本次改动无关，未动 PHP）。

2026-09-13 商户后台登录修复：`merchant-web/.env.development` 的传输密钥已与后端 `MTRIP_ADMIN_AES_KEY` 对齐，纠正旧注释中的错误密钥名；经本机网关加密请求不再报解密失败，返回用户名必填校验。部署时两个前端的 `VITE_LOGIN_AES_KEY` 均需匹配后端密钥，详见[商户端落地记录](docs/plans/13-商家端merchant-web落地.md)。

生产 MySQL 版本迁移（2026-09-09）：新增 `mtrip_system.schema_migrations` 与 `scripts/db-migrate.sh`，以有效 UTC 版本、SHA-256 和 MySQL 命名锁只执行 `database/migrations/` 中账本缺失的 SQL，并记录 Git commit、执行节点、耗时和成功/失败状态；唯一 `attempt_id` 防止并发失败进程改写其他执行者，批次结束会重新核对完整账本。`scripts/auto-deploy.sh --prod` 已改为每次拉取后先对比完整账本，迁移失败、历史文件改写/删除、版本重号或旧快照 rename/copy 会在任何代码发布前阻断；即使代码已最新也会复查上次遗漏，首次发布失败也会保留拉取前基线供下轮重放。compose 空库初始化会自动遍历迁移目录，失败登记 `failed` 且健康检查拒绝未完成账本；新增版本无需再逐条登记挂载。旧 `db-apply` 仅保留为开发环境补灌历史快照工具。静态脚本、命名校验及 fake Docker 状态机测试通过；本机无 Docker CLI，真实 MySQL/compose 验证待有 Docker 的环境执行。统一质量脚本因宿主机 PHP 7.2 不识别项目 PHP 8.1 语法而停在后端 lint，本次未改 PHP。

2026-09-12 空库迁移修复：MySQL 初始化 runner 改为放入自建 `mtrip-mysql:8.0` 镜像，以 0644 权限由 entrypoint source，规避 Docker Desktop 挂载 `.sh` 的 `bad interpreter: Permission denied`；构建时会将 Windows CRLF 转为 LF。健康检查还要求已执行版本数等于迁移文件数，避免空账本误判健康。隔离新库验证 3 个增量迁移自动执行，统一 KYC 模板 1 条、6 项资料。已有环境拉取代码后先执行 `bash scripts/db-migrate.sh`，再到 `deploy/` 执行 `bash mtrip.sh build mysql`；`auto-deploy.sh` 对 compose 变更仅提示手工重建。

merchant-app 状态栏规范（2026-09-08）：Figma 画布中的 iPhone 状态栏只作设备环境说明,页面代码不手绘时间/信号/电池；一律使用系统透明状态栏 + `SafeAreaView`。注册 Step 1 `839:6106` 与注册 Step 2 `839:6159` 已按此规范实现。

商户移动端 merchant-app 首屏（2026-09-08）：新增独立 `merchant-app/` 工程，不并入 C 端模块 10。技术栈、目录结构和请求/store/i18n 模式对齐 `client-app`，但存储 key 使用 `mtrip:merchant:*`，API 默认拼接 `/api/v1/merchant`。已按 Merchant PRD 梳理入驻认证、KYC、酒店运营、预订、结算、通知、RBAC、营销、评价和帮助中心范围，并新增独立计划 `docs/plans/17-商户移动端merchant-app.md`。Figma `mTrip_Merchant` node `839:5721` 的引导首屏已落地，Figma logo 与三枚功能图标已下载为本地资产；登录页先接入现有商户 Web 同口径的登录 challenge + Authenticator 2FA 数据流，注册、OTP、KYC 上传/审核、Access Code、扫码 2FA、Authenticator 绑定、生物识别和首页占位已按 Figma 原型连通；这些页面目前为本地演示状态，尚未接入移动端入驻 API。`npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过，构建产物已清理。

订房 Step 3 结账选券 C-M6（2026-09-07，Figma `228:5118`，对应9月计划第 2 周）：复核步的 Price Breakdown **进入即自动应用最优券**，点券行打开弹窗可更换 / 不使用 / 恢复最优券，改日期或间数后自动重新试算。后端新增 `GET /app/marketing/coupon/match-list`，返回本人全部未使用券的「本单实际抵扣额 + 不可用原因」，可用的按抵扣额排前面——**抵扣额一律由服务端算**（与下单 `PricingService::resolveCoupon` 同一公式），前端不自己算，否则复核页显示的优惠会与实付对不上；下单提交的是领券记录 id 而非金额。设计稿这张稿里**没有券行**，但预留了折扣行样式（隐藏节点 `869:2503`「Member Discount / - 27,750」），券行按它实现，唯一偏离是金额用主色（同色会被读成又一笔收费）。吸底栏与支付页汇总卡统一按「总额 − 券抵扣」显示，避免 Step 3 有优惠、Step 4 变回原价。实测：订单 150 时最优券抵扣被压到 150（`min(discount, base)`）、两张满减券以 `min_amount` 落到末尾；订单 400,000 时 15% 券 60,000 被封顶到 50,000 成为最优；端到端核对 `match-list` 给 5,000 与 `order/create` 实扣 5,000 完全一致。冒烟订单、库存锁定与临时账号已清理复核。四项门禁全绿。**已知不同源**：`resolveCoupon` 不校验券的适用房型而 `CouponView` 校验（方向安全，客户端更严），待第 2 周「创建订单再次校验资格」补齐。

优惠中心真实化 C-M6 / C-M6.1（2026-09-07，对应《2026年9月酒店核心业务开发计划》第 1 周）：优惠中心由静态页升级为**全链路真实数据**。**后端**新增 `App\Service\CouponView` 作为优惠券字段的唯一出口——领券中心 / 活动详情 / 券详情 / 我的券 / 结账择优共用同一套「券类型 / 优惠值 / 门槛 / 封顶 / 适用酒店房型 / 有效期 / 叠加规则 / 状态 / 不可用原因」口径，状态与原因一律下发机器码由各端 i18n；新增 `GET /app/marketing/coupon/detail`（`receiveId` 我的券 / `couponId` 券模板）与 `POST /app/marketing/coupon/redeem`（**促销码兑换**，校验站点、活动状态、有效期、总量、每人限兑与重复兑换，成功写领券记录）。促销码的五类失败**拆成独立错误码**（`40411` 不存在 / `40911` 过期 / `40912` 兑完 / `40913` 重复 / `40914` 资格不符），只靠 40401+40901 区分不出来。**数据库**新增幂等脚本 `database/marketing/08-consumer-coupon-promo.sql`：`marketing_coupon` 补 `sku_ids`（适用房型）与 `stackable`（叠加规则）、`marketing_promo_code` 补 `coupon_id`（兑换发放的券模板）、新增 `marketing_promo_code_redeem`（原表只有总量计数、没有按人记录，`per_user_limit` 实际无法生效）。**App** 新增 `api/marketing.ts` 与 `screens/promotions/couponFormat.ts`（券字段 → 卡片文案的唯一出口），优惠活动 / 我的优惠券 / 券详情 / 券卡全部改吃真实接口，我的券实现有效/已用/失效三分类，促销码可真兑换，「立即使用」跳酒店搜索；**登录后不再出现静态券**，为空给空态文案，设计稿示例券只留给未登录。券详情的条款改为由券数据生成（门槛/封顶/适用酒店房型/叠加/有效期）。实测：领取、限领、领完、兑换成功、重复兑换、码不存在、未生效、兑完、未绑券、跨站点十条路径错误码各不相同；best-match 在 40 万订单上正确选中封顶 5 万的折扣券而非 3 万满减券。四项质量门禁全绿（后端 344 文件 `php -l` 零错、shared 58 用例/858 断言、admin-web build、client-app typecheck + `expo export -p web`），冒烟数据已逐表清理复核；未执行 Git 操作。

client-app「我的精选 / 收藏酒店」接真实收藏（2026-09-03）：接口本来就接着（`/app/user/favorite/list`），问题是**页面不刷新**与**空收藏时用示例卡冒充**。`MyPickScreen` 改用 `useFocusEffect`（它是常驻底部 Tab，`useEffect` 只在挂载时跑，从酒店页收藏完切回来还是旧数据）；登录后一律显示真实收藏，为空给空态文案，设计稿示例卡只留给未登录。`StayCard` 新增可选 `favorite` / `onToggleFavorite`，收藏列表里的心形改为实心可点，点击调 `/app/user/favorite/remove` 取消收藏并就地移除；收藏的酒店点卡改跳设计稿的 `HotelDetail`（与搜索结果页一致，原先一律跳通用 `GoodsDetail`）。`npx tsc --noEmit` 零报错；接口侧以网关日志与 `user_favorite` 表核对，UI 交互未实跑。

本地栈启动方式修正（2026-09-03）：**一律用 `deploy/mtrip.sh`，不要直接敲 `docker compose`**。自「管理端 / APP 端服务分离」起，网关有 5 条 upstream 指向 APP 孪生池（`*-service-app`，定义在 `docker-compose.app-pool.yml`），裸 `docker compose up -d` 只加载 `yml + override` 起不出孪生，nginx 启动期解析不到主机名会 `[emerg]` 退出并被反复拉起——即 `mtrip-gateway-1` 无限重启。`CLAUDE.md` / `deploy/README.md` / `启动开发指南.md` 的命令已全部改写。同批：修 `mtrip.sh health` 的网关探针误报（`MTRIP_CLIENT_SIGN=false` 时预期是 400 不是 401，原先恒定退 1）；补跑漏执行的 `database/merchant/38-merchant-code-sequence.sql`（数据卷建于 2026-08-28，之后新增的脚本不会自动补跑，缺 `merchant_code_sequence` 会让商户编号分配报表不存在）。现 13 个容器全 Up、health 全绿。

App 短信验证接入 SMSPoh Verify API V3（2026-09-08）：C 端**注册 / 验证码登录 / 忘记密码**三个场景全部接上真实短信（此前验证码页是预填 `123456` 的走过场）。链路统一为 `POST /app/auth/sms/send` 发码 → `sms/verify` 验码换**一次性 `verifyToken`**（Redis，10 分钟）→ 由 `register` / `login-by-sms` / `reset-password` 兑换；**验证码本身后端不持有**（SMSPoh 只回 `requestId`，码由服务商校验），票据绑定「站点 + 场景 + 手机号」三者，防止拿自己号码验出的票据去注册别人的号码。**服务商口径易踩的两点**：参数全部走 query string 而非 JSON body；鉴权是 `accessToken=base64(APIKey:APISecret)`，base64 的 `+ / =` 必须转义（`+` 会被解成空格导致凭证失效，已锁单测）。凭证配在 `sys_sms_channel`（新增 `provider_code='smspoh'` 与 `api_secret`/`brand_name`/`pin_length`/`max_invalid_attempts` 四列，迁移 `database/system/11-sms-smspoh.sql`），后台「配置 → 短信配置」可增删改、可分站点。**强制策略是「渠道启用即强制」**：本站点存在启用中的 smspoh 渠道时注册必须带 `verifyToken`（否则 `40111`），没配渠道则照旧放行——本机开发不必申请凭证，生产装上凭证自动生效；App 端同步：发码返回 `50021` 时注册流程直接跳过验证码页，两边口径一致。三道限流：同号同场景 60 秒冷却、同号每日 10 条、同 IP 每小时 20 条。**手机号必须补国家码**：App 把「+95」画成静态标签却从不拼进请求，用户填的 `9971183240` 以 `99` 开头，不属于 SMSPoh 接受的 `09xxxxxxxx / 959xxxxxxx / +959xxxxxx` 三种前缀，故 `sys_sms_channel` 增加可配的 `country_code`（默认 95），**只在出网那一刻**归一成 E.164——库里 `mobile` / `mobile_hash` 仍按用户原样输入存，改存储格式会让存量账号登不进来。同批**修掉 HANDOFF 记了两次的注册遗留隐患**——`UserAuthService::register` 的建号与绑推荐人现已包进 `Db::transaction`，推荐码填错不再留下「注册失败但账号已建」的孤儿账号；票据也改为**注册成功后才作废**，改完推荐码可直接重试而不用再等一条短信（已实测：填错码 → 回滚 0 账号 + 票据保留 → 同票据重试注册成功）。

client-app H5 输入框聚焦黄框修复（2026-09-03）：RN Web 把 `TextInput` 落成真实 `<input>`，浏览器的两套默认外观会盖到设计稿上——`:focus` 的系统 outline（Chromium 蓝，部分国产内核是黄的）与 `-webkit-autofill` 的自动填充底色（老版 Chrome / Edge / 国产浏览器是黄的）。新增 `utils/webStyles.ts` 的 `applyWebGlobalStyles()`，`App.tsx` 启动调一次，**只在 web 生效、原生端空转**：`input/textarea/select:focus { outline: none }` + 自动填充用「把 background-color 过渡拖到 100000s」压住（不用 inset box-shadow 老写法，因为项目输入框底色有 `#EFF4FF` 与纯白两种）。按钮/链接的焦点框刻意保留（键盘可达性）。全项目 20 个 `TextInput` 散在 14 个文件，故走全局补丁，新增输入框自动生效。

client-app「更多」页去掉原生顶栏（2026-09-03）：该页只保留设计稿 `1690:4642` 的 mTrip 字标栏，原生导航头（居中 More）去掉——`MoreTab` 补 `headerShown: false`，它此前是唯一没设的 Tab（bottom-tabs 6.6.1 默认 `true`，所以才多出那条）。`MineScreen` 的 `SafeAreaView edges={['top']}` 必须保留：原生头一关，状态栏高度就得页面自己让开（react-navigation 只透传 header 高度、不扣安全区，两处是绑定的）。该页 mTrip 栏**维持现状不改**（用户明确要求）：目前只有 logo，设计稿右侧的积分胶囊与铃铛不补。

client-app 首页搜索框按钮溢出修复（2026-09-03）：部分机型 / H5 上首页搜索框的 Explore 按钮会被顶出圆角白底。根因是 `components/home/SearchSection.tsx` 的输入框只写了 `flex: 1` 而**漏了 `minWidth: 0`**——全项目 5 处 `flex: 1` 的 TextInput 只有它漏了；web 端 TextInput 落成 `<input>`，其 `min-width: auto` 约等于 20 个字符宽，`flex: 1` 压不下去，富余空间为负时整行溢出。已补 `minWidth: 0`，并给按钮加 `flexShrink: 1` + 文字 `numberOfLines={1}` 作为窄屏 / 超大系统字号 / 缅甸语长文案的兜底（宁可省略号也不顶破外框）。`npx tsc --noEmit` 零报错；未在真机复现回归。

client-app 注册链路补齐验证码与推荐码两步（2026-09-03）：按 Figma Onboarding section `752:9380` 新增**短信验证码页**（`566:3741`/`566:3902`，路由 `VerifyOtp`）与**推荐码页**（`1077:1734`，路由 `ReferralCode`），注册流程变成「注册表单 → 验证码 → 推荐码」三步。**短信通道尚未接入**：验证码页进入即预填演示码 `123456`，Continue 只校验「填满 6 位」、填什么都通过，重发按钮只重置倒计时（接真实短信时的三处改动已写在文件头注释里）。**推荐码则是真的会上送**——`apiRegister` 入参补 `referralCode`，Continue 带码、Skip 不带码。由于后端 `/app/auth/register` 一次性收「手机号 + 密码 + 推荐码」，注册请求整体后移到推荐码页，`RegisterScreen` 改为只校验不落库并透传 `SignupDraft`。同批把 Onboarding 四张稿逐字相同的外壳（主色底 + 插画 + 顶部栏 + logo/标语）抽成 `components/user/AuthShell.tsx`，Login/Register 一并改用（取值未动）。**遗留隐患**：后端 `UserAuthService::register` 先插 `user_info` 再校验推荐码且两步不在事务里，推荐码填错会「注册失败但账号已建」，修法（包进 `Db::transaction`）需起后端验证，本次未改。`npx tsc --noEmit` 零报错；未跑真机流程，未执行 Git 操作。

mtrip-ops 输入框修复与发布管理重做（2026-09-02）：① **输入框「矮一条缝」的根因**是 `app.css` 里一条无差别的 `label input { height:auto }` —— 本意让复选框恢复原生尺寸，却把登录页 `<label>用户名<input></label>` 里的文本框高度也清零了；已收窄为只作用于 checkbox/radio，并把输入框统一提到 48px（登录页 52px）、补齐 hover/focus 环与 placeholder 配色、给 select 换自绘箭头。顺手理顺一处主题欠债：四套主题本就定义了 `--field` 变量供输入框使用，基础样式却硬编码白色再让深色主题打补丁，现直接用 `var(--field)` 并删掉补丁规则。② **发布管理页重做**：此前面板只暴露了 dry-run，现补齐 auto-deploy 的两种用法——「自动部署」（`auto-deploy.sh` 无参数：拉取 + 按变更精准构建/重启）与「指定目标发布」（`auto-deploy.sh <目标>`：跳过 git 拉取与洁净门禁，目标按前端/后端主池/APP 孪生/网关四组分列），各带预检与真执行两个按钮、`高风险` 徽标与二次确认；`enableActions=false` 时按钮置灰；工作区不干净时提前警告 ff-only 会中止。同时**修掉一个会腰斩部署的问题**：命令默认超时 180s，而含前端构建的全量部署必然超时被 KILL，部署类命令超时改为 15 分钟。

mtrip-ops 账号鉴权与启停脚本（2026-09-02）：运维控制台此前**完全没有鉴权**，而 `ops.config.json` 里 `enableActions: true` —— 任何能连到 `127.0.0.1:56700` 的人都能读全部业务日志、跑 `git pull`、重启任意服务、备份数据库。新增 `mtrip-ops/src/auth.js`（零依赖，scrypt 加盐哈希 + `timingSafeEqual`，用户存 `data/users.json` 权限 `0600`，会话为进程内 Map + 32 字节随机 sid，cookie `HttpOnly; SameSite=Strict`），全站需登录；三角色 RBAC **viewer / operator / admin**（只读 / +白名单动作 / +账号管理），判定走 `can()` 且路由层默认拒绝；改角色或禁用账号对目标用户**当前会话立即生效**；最后一个可用管理员不能被降级/禁用/删除。首次启动自动建 admin 并**随机生成口令只打印一次**（`./ops.sh logs` 回看）。同批补齐 `docs/03-安全模型.md` 写明却一直没实现的审计字段——命令审计现在记录**操作人与来源 IP**，`/audit` 页新增两列。另新增 `mtrip-ops/ops.sh`（`start|stop|restart|status|logs`）：校验 Node≥20、拒绝重复启动、等端口就绪才报成功、stop 先 TERM 后 KILL，pid 存活判断额外校验 `/proc/<pid>/cmdline` 防 pid 复用误杀。已知取舍：会话在内存，**进程重启即全部登出**。

client-app H5 纳入部署链路（2026-09-02）：移动端补齐为**第四个静态站点** `client`（产物 `deploy/web/client/`，网关直连端口 8093，构建走 `npm run build:web` = `expo export -p web --clear`）。`client-app/*` 变更在 cron 模式下自动构建发布，强制目标新增 `client-app|client|h5`；**iOS/Android 商店发版仍走人工 EAS，刻意不进脚本**（`mobile|native` 只提示）。同批修掉三个既有缺陷：① `client-app/.env.production` 的 `EXPO_PUBLIC_API_BASE_URL` 原为 `/api/v1`，该变量语义是 **origin** 不是路径前缀，会拼成 `/api/v1/api/v1/app/...` 全部 404 —— 正确值是 `/`（留空也不行，Expo 会把空值当未定义丢弃并回落到 `https://api.mtrip.com`，已由编译产物实测确认）；② `build:web` 必须带 `--clear`，否则 Metro 按源文件内容缓存 transform，只改 `.env` 会把过期值编进包；③ `deploy/web/<app>/index.html` 占位页被 git 跟踪、发布即被覆盖，导致 ff-only 洁净门禁在首次发布后**永久中止所有 cron 部署**，已用 pathspec `':!deploy/web'` 把发布目标排除出洁净判断。另适配宝塔面板：`rsync` 加 `--exclude='.user.ini' --exclude='.htaccess'` 保护面板生成的跨站隔离文件（`.user.ini` 被 `chattr +i`，删会报 `Operation not permitted` 让整次发布失败）；宝塔站点需自行反代 `/api/` 与 `/uploads/` 到网关 :8081，配置片段见 `deploy/README.md` 第 7 节。

auto-deploy 指定目标强制发布（2026-09-02）：`scripts/auto-deploy.sh` 现支持 `scripts/auto-deploy.sh admin-web` 这类 target 模式，跳过 `git fetch`、落后检查、ff-only merge 和工作区干净门禁，直接用当前工作区构建发布指定前端；后端 `*-service` / `*-service-app` / `gateway` 可直接重启。无 target 的 cron 自动部署仍保持原安全策略。（其中「`client-app` 继续提示需单独 Expo/商店发版」一条已被上方条目取代。）

client-app 订房收尾（2026-09-01）：① 搜索页选好的入离日期一路透传到订房向导（此前选完房日期会跳回默认值），并把金额改为由 `units`（每晚每间基数）× 晚数 × 间数 实时推算，演示/真实两种模式共用一套算法（默认 1 晚 1 间时与设计稿原值一致），修掉「写着 3 Nights 却显示 1 晚金额」；② 预订成功页的二维码改为现场生成 `/app/order/pay` 返回的核销码 `verifyCode`（新增依赖 `react-native-qrcode-svg`，peer 为已装的 `react-native-svg`），无核销码时回落设计稿静态图；③ 「我的精选」的预订卡与收藏酒店卡也回落设计稿临时封面，兜底规则统一到 `tempCoverFor()`，与酒店搜索结果页同一套。后端 `create` 实测 1 晚 1 间 = 150、2 晚 2 间 = 600、3 晚 1 间 = 450，与前端算法一致。

client-app 订房接后端下单（2026-09-01）：订房向导由「纯静态页」升级为**双模式**——从酒店详情真实房型卡 Select 进入时带 `goodsId`/`skuId`，进入**真实模式**：酒店名/房型名/单价取自 `/app/goods/detail`，房费按「`base_price` × 晚数 × 间数」随日期与间数重算，支付步真的调 `/app/order/create` + `/app/order/pay` 落单（**支付渠道本次不做**——后端 `pay` 本来就是 mock，点哪个渠道都直接成功），成功页展示真实单号与实付；不带参数进入仍是演示模式，数值走 `bookingDemo.ts` 不发请求。真实模式下加购项只展示不提交（后端无价目表）、多住宿走 comingSoon（后端一次只收一个 sku）、价格明细不再显示设计稿那条 10% 税费（后端定价链路里没有）。**顺带修了一个后端硬伤**：`order_main.guests` 建成了 `JSON` 却存 AES 密文，导致任何带住客名单的下单都 500，已加幂等脚本 `database/order/06-guests-column-type-fix.sql`（JSON → TEXT）并登记进 compose initdb。实测 1 晚 1 间 = 150、2 晚 2 间 = 600 与前端算法一致，冒烟数据已逐表清理复核。`npm run typecheck` 零报错、`expo export -p web` 打包通过；未执行 Git 操作。

client-app 订房流程（2026-09-01）：按 Figma section `Multi Booking Hotel Booking Flow` `1675:5776` 新增 4 步订房向导 `screens/hotel/HotelBookingScreen.tsx`（路由 `HotelBooking`，一个路由 + 内部分步：日期确认 → 旅客信息 → 复核确认 →（多住宿才有）行程明细 → 支付），以及新增旅客 / 旅行保险 / Stay 明细 / 预订成功四个独立屏。酒店详情房型卡的 Select 与底栏「Choose my room」由 comingSoon 改为真正进入流程。新增 `components/hotel/booking/*` 16 个文件、19 枚设计稿图标、15 张素材，`hotels.booking.*` 中英缅各 186 键（三份逐键对齐，共 781 键）。当时是静态页，数值走 `screens/hotel/bookingDemo.ts`，交互只在页面内生效（已于同日接后端下单，见上一条）。`npm run typecheck` 零报错、`expo export -p web` 打包通过（15 张素材全部进包）；未执行 Git 操作。

client-app 通知页（2026-08-31）：按 Figma section `1770:3863` 新增 `screens/notification/NotificationScreen.tsx`（System / Booking 两个页签，路由 `Notifications`），首页与「我的精选」顶部栏的铃铛由 comingSoon 改跳这里。同批把出现四次的分段页签抽成 `components/common/SegmentedTabs.tsx`（优惠中心 / 推荐明细 / 教程 / 通知共用）。**静态页**——App 侧没有消息接口，数据走 `notificationDemo.ts`。`npm run typecheck` 零报错、`expo export -p web` 打包通过；未执行 Git 操作。

client-app「更多」及其子页（2026-08-31）：按 Figma section `More` `1695:5951` 重做 `screens/user/MineScreen.tsx`，并补齐 8 个子页（`screens/more/*`：Account / Travelers / EditEmail / Referral / ReferralStatus / HowReferralWorks / Guides / LegalTerms，均新增 Stack 路由）。新增 `components/more/*` 与 21 枚设计稿图标。**除资料与余额外都是静态页**——后端没有钱包/推荐查询/教程/条款接口，数据走 `screens/more/moreDemo.ts`，动作 comingSoon（推荐码复制是真的）。设计稿没有的多站点/多语言/GDPR/订单入口收进「更多」页新增的第三张卡，功能未丢。`npm run typecheck` 零报错、`expo export -p web` 打包通过；未执行 Git 操作。

client-app 优惠中心（2026-08-31）：按 Figma `M-Trip / Promotion` node `1633:3300` 重做 `screens/promotions/PromotionsScreen.tsx`（原为占位空页），落成「一个壳 + 两个页签（优惠活动 / 我的优惠券）+ 使用说明与领券成功两个弹层」，并新增券详情页与 `CouponDetail` 路由。优惠券卡、内容卡壳、页签等收敛到 `components/promotion/*`；`HomeIcon` 新增 8 枚设计稿图标，新增依赖 `expo-clipboard`（券码复制）。**当前是静态页**：后端无活动/优惠券接口，数据走 `screens/promotions/promoSections.ts`，「领取」弹设计稿提示、其余动作 comingSoon。`npm run typecheck` 零报错、`expo export -p web` 打包通过；未执行 Git 操作。

client-app 开屏与首次语言选择（2026-08-31）：按 Figma `M-Trip / Splash` node `452:2190` + `2163:8057` 新增 `screens/splash/SplashScreen.tsx`，`App.tsx` 改为 boot → language → app 三段驱动（开屏最少停留 1.2s，取代原 `LoadingView`）。**首次进入**弹语言选择卡，默认选中系统语言（新装 expo-localization，取不到回落 en-US），选定后写本地不再出现。新增缅甸语 `assets/i18n/my-MM.json`（382 键与 en-US 逐键对齐，**机器翻译，上线前需母语者复核**），`SUPPORTED_LANGS` 扩为 en-US / my-MM / zh-CN。`npm run typecheck` 零报错、`expo export -p web` 打包通过；未执行 Git 操作。

client-app 注册页重做（2026-08-31）：按 Figma `M-Trip / Signup` node `505:1498` 重做 `screens/user/RegisterScreen.tsx`，与登录页同一套版式（主色底 + 插画 + 顶部栏 + 白色表单卡）。表单改为手机号(+95)/邮箱/密码/确认密码 + 条款勾选，删掉设计稿没有的昵称栏；`HomeIcon` 新增 `mail`（fluent:mail-20-filled 导出 path）。邮箱值已上送但 user-service `AuthController::register` 暂未接收该入参，落库需后端补一行。`npm run typecheck` 零报错；未执行 Git 操作。

S6 Git补充（2026-08-28）：用户已单次授权S6清单32文件本地提交，不推送；标题、范围及验证见[阶段日志](docs/plans/m12/CHANGELOG.md)。下方S6“未提交”为开发交付快照，后续Git操作仍需单独授权。

S6更新（2026-08-28）：规则版本/草稿发布隔离、不可覆盖的合规与警告历史、暂停/复核恢复、分级权限及事务内站内通知已实现；S1—S6隔离回归470项通过，313 PHP/58共享用例858断言/admin构建/client类型检查通过。32迁移本地重复验证；四个空数据页面及弹窗、中英切换已检查，完整有数据UI和生产上线待S7验收。详见[阶段6交付](docs/plans/m12/07-s6-delivery.md)。基线da15250，本阶段未暂存/提交/推送。

Git补充（2026-08-28）：用户已单次授权S5交付清单29文件本地提交，不推送；标题、范围和验证见[阶段开发日志](docs/plans/m12/CHANGELOG.md)。下方S5“未提交”和HEAD=b924cb6属于开发交付快照；后续阶段仍需单独授权。

商户账号体系三期（2026-08-31）：补齐管理端对商户的三项管控——**功能模块授权**（`merchant_module_grant` + `merchant_menu.module_key`，裁剪 merchant-web 菜单与 JWT 权限快照）、**内置角色预设**（新增 `商户运营人员`/`商户客服`，原先每个 account_type 只有一个"管理员"）、**子账号配额**（`sub_account_limit` 默认 3，`AccountController::create` 前置拦截）。同时修复 admin-web `merchant/account` 商户下拉不预载导致恒为空的问题。新增 3 个 SQL 已登记 initdb（27a/39o/39p），存量库需按 [docs/plans/12-商家账号体系.md](docs/plans/12-商家账号体系.md)「升级说明」增量执行。未跑 Docker 联调（本机无 docker 权限），未执行 Git 操作。

S5更新（2026-08-28）：酒店真实关联、按市场独立草稿/发布、优先组排序、实时展示资格及热门目的地已完成核心编码。S1—S5共395项集成通过，S5重复5轮并发套件通过，310个PHP文件/58单测858断言/admin构建/client类型检查通过；已验证后台空市场和预览，有数据的完整UI及移动端实测待验。详见[阶段5交付](docs/plans/m12/06-s5-delivery.md)。31迁移已本地重复验证；未生成真实酒店或发布内容。HEAD=b924cb6，S5未暂存/提交/推送。

Git补充（2026-08-28）：用户已单次授权S4及后续商户看板修复共61文件本地提交，不推送；标题、范围及验证见[阶段开发日志](docs/plans/m12/CHANGELOG.md)。以下“未提交”和HEAD=232fd3e属于提交前的历史快照，后续阶段仍需单独授权。

修复补充（2026-08-28）：商户工作台`/api/v1/merchant/stats/dashboard`内部错误已修复：本地补执行既有marketing/07归属字段迁移，趋势分组改用当前Hyperf支持的写法。新增14项真实看板查询回归，连同既有集成共314项通过，58单测/858断言通过；订单服务已重启。未执行Git提交，详情见[商户端计划](docs/plans/13-商家端merchant-web落地.md)。

S4更新（2026-08-28）：账号级强制Google Authenticator与真实临时模拟登录已完成核心开发；S4 92项、S1—S4共300项集成检查，58单测/858断言及双端构建通过。仅本地匿名页面完成浏览器冒烟，真实扫码与完整UI流程待验；详见[阶段4交付](docs/plans/m12/05-s4-delivery.md)。开发库已应用30迁移，现有商户JWT失效，下次登录需独立绑定2FA。HEAD=232fd3e（S3），S4未暂存、未提交、未推送。

Git补充(2026-08-27)：用户已单次授权S3本地提交，不推送；提交范围和日志见[阶段开发日志](docs/plans/m12/CHANGELOG.md)。下文“S3未暂存、未提交”指阶段交付时的历史快照；后续阶段仍需单独授权。

补充(2026-08-27)：PRD模块12商户管理S1状态闭环、S2酒店目录/档案/物业关联、S3证件版本/活动/站内通知已实现并通过核心测试。酒店优先，餐厅及外部通知服务商对接延期。S3共70项、累计208项集成检查通过；浏览器视觉、完整上传及模块11端到端仍未验，详见[阶段3交付](docs/plans/m12/04-s3-delivery.md)。S1＋S2已按单次授权联合提交87cfb66；S3未暂存、未提交，Git由用户操作。

模块 01~07、09、10 已完成;模块 08(部署与网关)完成 82%——deploy 基础设施、auto-deploy 指定目标强制发布、权限键统一与 **08-6 部署后四步验证(2026-07-30 全部通过:11 容器全 Up、八服务 healthz ok、网关 8081 无签名 401、.env 注入生效)** 已落地,剩余 08-7 全链路联调待执行,清单见 [docs/plans/08-部署与网关.md](docs/plans/08-部署与网关.md)。

商户端 M8 促销与活动管理按 Figma 整页重写（2026-09-21）：设计源 `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`（6 画板 = Percentage/Fixed/Coupon Code 的列表态 + 创建抽屉）。`merchant-web` 的 `/promotions` 重写为「H1 + Add New Promotion + 四张统计卡 + Tab 条（Percentage / Fixed Amount / Coupon Code / Long Stay）+ 卡片网格或表格 + 新建/编辑抽屉」，并新增 `/promotions/analytics`（曝光/领券/预订/转化率/促销收益/商户出资/ROI + 趋势图 + 逐券明细）与 `/campaigns`（平台活动详情、参与资格、出资模式、活动条款、接受或拒绝邀请）。`marketing-service` 的商户促销接口新增 `options`/`performance`/`duplicate` 与 7 个规则字段，新增 `Merchant/CampaignController` 与 C 端 `POST /app/marketing/impression` 曝光上报，`client-app` 促销中心与券详情已接上报。关键口径：`coupon_type` 是计价轴（折扣券的 `discount_value` 为 10 分制折扣率），另立展示轴 `promotion_kind`，换算收口在后端 `discountPair()`；`finance_account_entry.coupon_id` 存的是领券记录 ID 而非券模板 ID，效果分析须经 `marketing_coupon_receive` 换算。新增迁移 `database/marketing/09-merchant-promotion-rules.sql`（登记 initdb）与 `database/migrations/V20260921120000__merchant-promotion-campaign-menu.sql`，网关登记 `campaigns → marketing_service`。`merchant-web npm run build` 与 `client-app npm run typecheck` 零报错；新增 `merchant-web/scripts/check-promotions-figma.mjs` 真实 SSR 渲染校验 **199/199 GREEN**（含 30 枚断言集 path 逐字断言）。详见 [M8 实现方案](docs/plans/实现方案-Merchant-M8-营销活动.md)。未做登录态浏览器走查（环境无浏览器自动化、开发库无已知密码商户账号）。

补充(2026-08-23):商家端 `merchant-web` 已完成全局样式同步与 M5/M6/M8/M9/M10 首轮页面/接口增量,详见 [docs/plans/13-商家端merchant-web落地.md](docs/plans/13-商家端merchant-web落地.md)、[docs/plans/实现方案-Merchant-全模块差距与样式同步.md](docs/plans/实现方案-Merchant-全模块差距与样式同步.md) 与 [docs/plans/实现方案-Merchant-M8-营销活动.md](docs/plans/实现方案-Merchant-M8-营销活动.md)。

商户 App KYC 联动（2026-09-10）：后台审核发送的是申请级统一资料清单，不按 Business Type 分流；merchant-app 已从本地点击原型改为读取状态、选择真实文件并上传/提交，服务端仍以 `stage=3` 强制门禁。增量迁移为 `database/migrations/V20260910110000__unify-merchant-kyc-template.sql`；M9-M12 的 Access Code/首次 2FA 绑定尚待实现。
