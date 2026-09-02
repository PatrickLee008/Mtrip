# Mtrip 海外旅游 SaaS 平台

多站点海外旅游 SaaS:平台管理后台 + 商户/供应商体系 + C 端移动应用,覆盖酒店/门票商品、订单核销、财务结算、营销优惠全链路。

## 技术栈


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
| **运维监控台方案与计划** | [mtrip-ops/docs/](mtrip-ops/docs/) + [docs/plans/16-运维监控.md](docs/plans/16-运维监控.md) |
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

补充(2026-08-23):商家端 `merchant-web` 已完成全局样式同步与 M5/M6/M8/M9/M10 首轮页面/接口增量,详见 [docs/plans/13-商家端merchant-web落地.md](docs/plans/13-商家端merchant-web落地.md)、[docs/plans/实现方案-Merchant-全模块差距与样式同步.md](docs/plans/实现方案-Merchant-全模块差距与样式同步.md) 与 [docs/plans/实现方案-Merchant-M8-营销活动.md](docs/plans/实现方案-Merchant-M8-营销活动.md)。
