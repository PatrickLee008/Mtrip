# Mtrip 海外旅游 SaaS 平台

多站点海外旅游 SaaS:平台管理后台 + 商户/供应商体系 + C 端移动应用,覆盖酒店/门票商品、订单核销、财务结算、营销优惠全链路。

## 技术栈

admin-web 主题与公共资源补充（2026-08-30）：`cops/theme` 编辑主题资源从 JSON 字符串改为控件化编辑，弹窗 1180px、资源卡一行三列；缩略图接入公共资源选择弹窗。存储配置新增阿里云 OSS 驱动/endpoint，system-service 新增文件树、上传、目录过滤、目录新增/删除和 local/aliyun 实际资源删除接口；公共资源组件支持单选/多选、限定文件类型（不限/图片/视频/图片+视频等）、图片/文档/视频/音频上传选择，以及根目录/子目录维护。PHP lint、admin-web build、compose config 通过，本地迁移和 system-service 重建已执行。

M12餐厅资料展示（2026-08-29，未提交）：商户详情不再过滤餐厅等非酒店业务，补充类型列并显示现有联系资料/KYC；酒店专用物业关联边界不变，不扩展餐厅运营。admin构建与Browser混合业务核验通过，临时测试资料已清理，见[追加整改记录](docs/plans/m12/09-all-merchants-ui.md)。

M12列表整改（2026-08-29）：菜单统一“商户管理/所有商户”，四状态卡片、验证页搜索栏、八列与四图标入口落地；新增独立佣金档位，读取真实入驻类型及账号最后登录。33迁移已本地应用，499项隔离回归及统一质量检查通过；本次单次授权18文件本地提交、不推送，见[整改记录](docs/plans/m12/09-all-merchants-ui.md)。

M12 S7（2026-08-28）：本地独立环境、两轮历史迁移/124表恢复、473项集成和160项真实网关检查通过；修复商户服务权限切面未注册及证件驳回按钮文案。完整页面/在线原型验收尚未全部收口，见[阶段7记录](docs/plans/m12/08-s7-delivery.md)。真实扫码由用户后测，生产验收不在本轮范围；用户本次授权将19个S7文件与原ReviewController.php改动联合本地提交，不推送，后续提交仍需单独授权。

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

模块 01~07、09、10 已完成;模块 08(部署与网关)完成 80%——deploy 基础设施、权限键统一与 **08-6 部署后四步验证(2026-07-30 全部通过:11 容器全 Up、八服务 healthz ok、网关 8081 无签名 401、.env 注入生效)** 已落地,剩余 08-7 全链路联调待执行,清单见 [docs/plans/08-部署与网关.md](docs/plans/08-部署与网关.md)。

补充(2026-08-23):商家端 `merchant-web` 已完成全局样式同步与 M5/M6/M8/M9/M10 首轮页面/接口增量,详见 [docs/plans/13-商家端merchant-web落地.md](docs/plans/13-商家端merchant-web落地.md)、[docs/plans/实现方案-Merchant-全模块差距与样式同步.md](docs/plans/实现方案-Merchant-全模块差距与样式同步.md) 与 [docs/plans/实现方案-Merchant-M8-营销活动.md](docs/plans/实现方案-Merchant-M8-营销活动.md)。
