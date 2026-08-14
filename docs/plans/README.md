# Mtrip 开发工作计划总览

> 本目录存放各模块工作计划,每个模块独立一个文件,内含任务清单与完成状态。
> 状态标记:`[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[-]` 本期不做
> 每完成一项任务,同步更新对应模块计划文件及本总览表。

## 项目目录约定

```
MTrip/
├── backend/                 # 后端微服务(Hyperf 3.1 + Swoole,Docker 运行)
│   ├── shared/              # 共享组件包
│   └── services/            # 二级目录按微服务拆分(8个服务)
├── admin-web/               # 平台管理后台(Vue3+Vite+TS+Ant Design Vue)
├── merchant-web/            # 商户后台(本期仅占位)
├── client-app/              # C端 Expo(模块10 已落地)
├── database/                # 数据库 DDL + 种子数据,按服务分目录
├── deploy/                  # docker-compose、OpenResty 网关、k8s
├── docs/
│   ├── plans/               # 工作计划(本目录)
│   ├── guides/              # 开发指导文件(api/standards/frontend 分目录)
│   ├── reference/           # 需求文档提取文本
│   └── tools/               # 辅助脚本
└── 设计文档/                # 原始 docx 需求文档
```

## 模块进度总览

| 序号 | 模块计划文件 | 内容 | 状态 | 进度 |
|------|-------------|------|------|------|
| 01 | [01-后端共享组件包.md](./01-后端共享组件包.md) | backend/shared 统一响应/JWT/隔离/审计 | 已完成(单测于模块08-8 补齐) | 100% |
| 02 | [02-系统服务system-service.md](./02-系统服务system-service.md) | RBAC/站点/日志/配置/客户端鉴权(14底层模块) | 已完成(联调归模块08) | 100% |
| 03 | [03-数据库设计.md](./03-数据库设计.md) | 全套 DDL + 种子数据 | 已完成 | 100% |
| 04 | [04-管理后台框架.md](./04-管理后台框架.md) | admin-web 脚手架/布局/登录/动态菜单 | 已完成(联调归模块08) | 100% |
| 05 | [05-管理后台系统页面.md](./05-管理后台系统页面.md) | 系统管理/系统配置/日志全部页面 | 已完成(联调归模块08) | 100% |
| 06 | [06-业务微服务.md](./06-业务微服务.md) | 商户/商品/订单等 7 个业务服务 | 已完成(联调归模块08) | 100% |
| 07 | [07-管理后台业务页面.md](./07-管理后台业务页面.md) | 商户/商品/订单/财务/营销/统计/核销页面 | 已完成(联调归模块08) | 100% |
| 08 | [08-部署与网关.md](./08-部署与网关.md) | docker-compose/OpenResty/联调验证 | 部分完成(08-6 启动验证已通过,08-7 联调待执行) | 80% |
| 09 | [09-移动端微服务.md](./09-移动端微服务.md) | C端 /api/v1/app/* 接口(user/goods/order等) | 已完成(联调归模块07/08) | 100% |
| 10 | [10-移动端App框架.md](./10-移动端App框架.md) | client-app Expo51+RN+TS 多端工程 | 已完成(冒烟联调归模块08) | 100% |

## 实施顺序(首期里程碑)

1. 01 共享组件包 → 2. 03 数据库 → 3. 02 系统服务 → 4. 04 管理后台框架
→ 5. 05 系统页面 → 6. 06 业务服务(商户/商品/订单优先) → 7. 07 业务页面 → 8. 08 部署联调

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-28 | 初始建立各模块计划 |
| 2026-07-28 | 模块01 共享组件包 19 个文件编码完成,单测延至模块08;开始模块03 数据库 |
| 2026-07-28 | 模块03 完成:18 个 SQL(两库 54 表 + 种子数据),本机 MySQL 8.0.29 全量执行验收零报错;开始模块02 system-service |
| 2026-07-28 | 模块02 完成:system-service 全量编码(15 Controller/14 Model/AuthService,49 文件),php -l 全量语法检查通过;Docker 运行联调归模块08;开始模块04 admin-web 框架 |
| 2026-07-28 | 新增模块09(移动端微服务)与模块10(client-app Expo 框架):提取《移动端前端框架设计方案》,确定公用微服务双前缀路由方案(goods/order 公用,user-service 移动端为主新建) |
| 2026-07-28 | 模块04 完成：admin-web 工程底座 41 文件(脚手架/主题/布局/登录/动态路由/v-perm/i18n)，npm run build 零 TS 报错；开始模块05 系统页面 |
| 2026-07-28 | 模块05 完成：系统管理/系统日志/系统配置共 14 个页面 + useTable/exportCsv/3 个 API 模块(20 文件)，npm run build 零 TS 报错；测试类按钮与接口联调归模块08；开始模块06 业务微服务 |
| 2026-07-28 | 模块09 完成：user/goods/order 三新服务 + system-service C端公开站点接口 + shared UserContext/UserAuthMiddleware，php -l 全量 116 文件零错误 |
| 2026-07-28 | 模块10 完成：client-app 全量落地(配置/请求层/store/i18n/组件/导航/9页面)，npm install + tsc --noEmit 零错误；新增 docs/guides/api/移动端接口规范.md；Expo 冒烟联调归模块08 |
| 2026-07-28 | 新增根级 .gitignore(后端 vendor/.env/runtime、前端产物、临时目录)与 docs/guides/setup/启动开发指南.md(数据库初始化/四服务/双前端启动步骤) |
| 2026-07-28 | 模块06 进行中：merchant-service 完成(16 文件，端口 9505，商户 11 接口 + 供应商 14 接口，php -l 全部通过)；下一步 goods-service 补管理端接口 |
| 2026-07-28 | 模块06 进行中：goods-service 管理端完成(5 文件 + 26 条路由)、order-service 管理端完成(4 文件 + 13 条路由 + 退款回补库存)，php -l 全部通过；下一步 finance/user/marketing/payment 四骨架 |
| 2026-07-28 | 模块06 进行中：finance(9506 资金/提现/结算 13 接口)、user 管理端(5 接口)、marketing(9507 优惠券 9 接口)、payment(9508 渠道抽象+Webhook 回调)全部完成，php -l 四服务通过；下一步 06-5 八服务终检 |
| 2026-07-28 | 模块06 完成：八服务 php -l 全量复检零错误(共 175 文件)+ shared 通过；Docker 运行联调归模块08；开始模块07 管理后台业务页面 |
| 2026-07-28 | 模块07 进行中：07-1 商户管理完成(api/merchant.ts + list/account/stats 三页，npm run build 零 TS 报错)；下一步 07-2 商品管理 5 页 |
| 2026-07-28 | 模块07 进行中：07-2 商品管理完成(api/goods.ts + GoodsManage 共享组件 + hotel/ticket/category/stock/audit 五页，build 零 TS 报错)；下一步 07-3 订单管理 |
| 2026-07-28 | 模块07 进行中：07-3 订单管理完成(api/order.ts 13 接口 + OrderManage 共享组件 + all/hotel/ticket/refund/verify 五页，StatusTag 色值扩展，build 零 TS 报错)；order/export 回退 wip 由 CSV 按钮承担；下一步 07-4 供应商+用户 8 页 |
| 2026-07-28 | 模块07 进行中：07-4 供应商+用户完成(api/user.ts 5 接口 + supplier list/goods/settle 三页 + user list/feedback 两页，build 零 TS 报错)；supplier/report、user/level、user/log 回退 wip；下一步 07-5 财务+营销 9 页 |
| 2026-07-28 | 模块07 进行中：07-5 财务+营销完成(api/finance.ts 13 接口 + api/marketing.ts 9 接口 + overview/msettle 双Tab含提现/flow/coupon 双Tab + SettleManage 共享组件双薄壳，build 零 TS 报错)；finance/tax、marketing/activity\|banner\|points 回退 wip；下一步 07-6 数据大屏+统计/核销页+build 终检 |
| 2026-07-28 | 模块07 完成：07-6 数据大屏+统计/核销完成(后端补建 AdminStatsController dashboard/report + finance report 3 只读接口 php -l 零错误；api/stats.ts + EChart 封装 + dashboard/StatsReport 共享组件三薄壳/finance 报表/verify-log 共 9 文件)，npm run build 终检零 TS 报错(11.80s)；verify/device\|rule 回退 wip；接口联调归模块08；开始模块08 部署与网关联调 |
| 2026-07-28 | 模块08 进行中:08-2 权限键前后端统一完成(shared Permission 注解支持多键任一匹配;业务五服务 53 处注解键全改菜单种子 perm_key,83 键全部对齐 02-menu.sql,php -l 零错误);下一步 deploy/ docker-compose + OpenResty 网关 |
| 2026-07-28 | 模块08 进行中:08-3~08-5 deploy/ 基础设施完成(docker-compose.yml MySQL/Redis/八服务/OpenResty 编排 + 18 SQL 编号初始化;openresty/ 网关 map 路由/CORS/限流 30r/s/统一错误 JSON;deploy/.env.example;k8s/ 目录预留;admin-web vite proxy 改指网关 8080);下一步 08-6 docker compose 启动验证 |
| 2026-07-28 | 模块08 进行中:08-8 shared 包单测完成(backend/shared/tests/ 26 用例/96 断言全过,本机 PHP 8.1 直跑;修复 CryptoHelper 空串解密边界与 OrderNoGenerator 同毫秒碰撞 2 个 bug),模块01 升 100%;08-6 启动验证阻塞于本机无 Docker 环境(WSL2 虚拟机平台服务不可用),待用户安装 Docker Desktop |
| 2026-07-28 | 模块08 收尾定格 60%:经用户确认 08-6 启动验证/08-7 联调延后至 Docker 就绪(恢复清单已写入 08 计划文件);启动开发指南重写(Docker Compose 一键启动/端口表补齐 9506~9508/WSL2 故障 FAQ) |
| 2026-07-28 | 首次 Git 提交前整理:新建根 README.md(技术栈/目录结构/快速开始/规范索引/核心约定速览);merchant-web、docs/guides/frontend|standards 补占位 README 防空目录丢失 |
| 2026-07-28 | 新增 deploy/docker-compose.override.yml 开发期热更新(本地 app/config/shared 挂载进容器,改代码 restart 约 2 秒生效免重建镜像;各服务日志挂出到 deploy/logs/<服务名>/ 宿主机直查);启动指南新增 2.2 节「改代码后如何生效」 |
| 2026-07-28 | 启动指南新增 2.0 节「Windows 安装 Docker Desktop 与配置 WSL2」四步流程+诊断命令表(无需 Hyper-V,仅虚拟机平台+WSL 功能);实机确认本机 BIOS 虚拟化已开,仅缺「虚拟机平台」功能待启用重启 |
| 2026-07-30 | 模块08 进展:08-6 部署后四步验证全部通过(11 容器全 Up/八服务 healthz ok/网关 8081 无签名 401 符合预期/.env 注入生效,实际输出记录在 08 计划文件),模块 60%→80%;剩余 08-7 全链路联调 |
| 2026-08-01 | 新增 [差距分析-ConsumerApp-PRDv1.0.md](./差距分析-ConsumerApp-PRDv1.0.md):对照新需求《设计文档/mTrip_ Consumer App PRD_v1.0.md》逐一评估框架/数据结构/后端/业务满足度(框架80%/数据35%/接口25%/业务20%),给出 15 模块差距表 + 改造技术方案 + 实施路线;标注三项架构级改动(退款钱包化/Trip多酒店拆单分摊/促销出资分账)需先设计签字。待评审 |
| 2026-08-01 | 确认 **Consumer App PRD v1.0 为唯一真需求**(旧三份 docx 仅框架期设计,现有 8 服务/54 表降级为可复用底座);新增 [实现方案-ConsumerApp-PRDv1.0.md](./实现方案-ConsumerApp-PRDv1.0.md):重新定基 + 目标数据模型全景(复用/改造/新建三态)+ 服务拓扑 + M0~M4 里程碑 + M0/M1 建表级 DDL + 下单/支付/退款核心业务改造。待评审,建议从 M0+M1 单酒店预订闭环起步 |
| 2026-08-02 | **Consumer App PRD v1.0 实现落地(dev 分支,每增量 check.ps1 四步全绿)**:M0 地基(缅甸双价/订单增强/退款钱包化)→ M1 核心预订闭环(下单双价+长住+券+多住客 / 常旅客·公民价·评价 / 退款透明+平台便民费)→ M2 促销与用户资产(收藏 / 促销中心·My Coupons·自动择优 / 推荐返利)→ M3 运营与风控(通知中心 / 动态主题 / 风控申诉 / 结算出资分账 / 客服聊天)→ M4 Trip 多酒店 → admin 管理端(8 功能后端+#[Permission]+菜单种子「移动运营1300」+ admin-web cops/* 8 页)。**三项架构级 A1 退款钱包化 / A2 Trip / A3 出资分账全部落地**;PRD 四层(数据/后端/C端/admin)整体闭环。遗留(非首发):Module3 后台可配置筛选、通知多渠道分发、正式支付渠道、Phase2 AI/保险——清单见实现方案文末「遗留清单」 |
| 2026-08-14 | merchant-web 布局原型化改造(见 [13-商家端merchant-web落地.md](./13-商家端merchant-web落地.md) 新增章节):按 Figma 原型重构侧边栏(228px 白底/主体切换器/分组菜单/底部登出)与 Header(面包屑/搜索/通知/用户区);移除多页签与暗色模式;全局主色改 #2563EB、字体 Plus Jakarta Sans;vue-tsc 零报错 |
