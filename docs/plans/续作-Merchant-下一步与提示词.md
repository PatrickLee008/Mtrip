# Merchant App 续作:下一步与新会话提示词

> 用途:下次开新会话开发 **merchant-web(商家中心)** 时,先读本文件即可接着干。
> 权威细节见 [13-商家端merchant-web落地.md](./13-商家端merchant-web落地.md)、[HANDOFF.md](./HANDOFF.md) 顶部「★ 需求基准变更」,以及 `设计文档/mTrip_Merchant App PRD_v1.0.md`(英文全文) / `mTrip_Merchant App PRD_v1.0.pdf`。
> 更新时间:2026-08-23
> ⚠ **需求边界澄清**:本文件只管 **商家端 merchant-web**(需求基准 = Merchant App PRD v1.0)。HANDOFF 里大量"商户验证/Onboarding"是 **admin-web 平台侧**(Super Admin Portal PRD)按商户申请做审核,与商家端是两回事,切勿混淆。

---

## 一句话现状

merchant-web(Vue3+Vite+TS+antdv,端口 **5174**)骨架与**首批 6 页**已在计划 13 落地:登录 / 工作台占位 / 组织与权限(子账号+角色,RBAC) / 门店(store) / 订单核销(order) / 商品(goods)。2026-08-14 已按 Figma 原型(big-plank-58319748)重构主框架:228px 白色侧边栏(主体切换器+分组菜单+Logout)+ 56px Header(面包屑/搜索/通知铃铛/用户下拉),主色 `#2563EB`、字体 Plus Jakarta Sans、移除多页签与暗色模式。后端 merchant-service / order-service(goods 核销) / goods-service(商品) / 网关 `/api/v1/merchant/*` 已通,RBAC 四表已种子化。

**2026-08-23 补充**:用户明确"不只做 M5,其他模块也要检查和修改",且第一步先做样式同步。已用公共 CSS 覆盖层统一 merchant-web 卡片/筛选表单/按钮/表格/分页/弹窗抽屉到 Hotel Merchant Dashboard 原型口径,并在 `04-merchant-menu.sql` 补齐 M2/M3/M5/M6/M8/M9/M10 菜单入口(未实现组件回退 WIP)。详见 `实现方案-Merchant-全模块差距与样式同步.md`。

**2026-08-23 晚间补充**:M5/M6/M9/M10 已完成首轮可运行增量——M5 经营看板真实化 + 收益结算, M6 通知中心 + 设置, M9 评价管理, M10 帮助中心轻量页;新增 order/finance/merchant/goods 四处商户视角接口,`mtrip.conf` 已登记 `stats`/`earnings`/`notifications`/`reviews`,新增 SQL 已登记 initdb。`D:\BtSoft\php\81\php.exe -l` 与 `cd merchant-web; npm run build` 均通过。后续重点转向 M8 营销活动、M2 客房模型、M3 房量价格库存。

**对照 Merchant App PRD v1.0 的 10 个 Module,目前仅 Module 7(RBAC & Staff)实质完成,Module 4(订单核销)部分完成,其余 8 个模块在 merchant-web 侧基本为空(多为 wip 占位或根本无菜单/无页面)。** 视觉原型 `UI设计/Hotel Merchant Dashboard`(React+Tailwind+shadcn)提供了 6 个 screen 的UI 参考(Guest Messages / Promotions / Reviews / Settings / Staff / Support),但其技术栈与 merchant-web 不同,**只能照搬视觉与交互,不能直接复用代码**。

---

## 开工先做两件事

1. **看提交状态**:`git -C E:\GIT\jiaxu\Mtrip status --short`、`git log --oneline -15`。本轮约定"逐增量本地验收后由用户在 dev 统一提交";若有未提交改动,先按增量粒度 commit。
2. **跑一次前端基线**:`cd E:\GIT\jiaxu\Mtrip\merchant-web && npm run build`(= `vue-tsc --noEmit && vite build`)。
   > 注意:`scripts/check.ps1` **不含 merchant-web**(只覆盖 backend/shared/admin-web/client-app)。merchant-web 的质量门是自己的 `npm run build`,改动后必须本地跑通(EXIT=0)再提交。
   > 后端若动了 merchant/finance/marketing/goods/order 服务,请用户在终端跑 `scripts/check.ps1` 四步全绿(或至少 `backend php -l`)。AI 侧命令常被安全分类器限流,届时由**用户在终端手动跑并回贴结果**。

---

## PRD 覆盖矩阵(10 Module → merchant-web 现状)

| PRD Module | 中文 | merchant-web 现状 | 后端依赖 | 优先级建议 |
|---|---|---|---|---|
| M1 Registration, Verification & Admin Approval | 入驻/验证/平台审批 | **基本不在商家端**(审批是 admin-web 平台侧)。商家端只需一个"我的入驻状态/待补件"查看页 | user-service / merchant_info 状态查询 | 低(平台侧已大改,商家端仅补状态展示) |
| M2 Hotel & Room Management | 酒店与客房管理 | `store` 页是通用门店 CRUD,**无客房/房型/设施/政策**。Hotel 专属字段缺失 | goods-service 或 merchant-service 扩 `store`→`room` 子实体 | 中(需先定领域模型) |
| M3 Availability, Inventory & Pricing | 房量/库存/价格 | **完全未建**。无日历、无价规、无配额 | 需 inventory/pricing 域(可挂 goods-service 或新建),与 C 端预订联动 | 高(核心营收能力)但后端重 |
| M4 Booking Management | 预订管理 | `order` 页有 列表/详情/核销(verify)。**缺** 改单/取消/退款/客人详情 | order-service 已部分支持 | 中(补全闭环) |
| M5 Business Dashboard, Earnings & Settlement | 经营看板/收益/结算 | **首轮已实现**:dashboard 真实 KPI/趋势/物业表现/今日运营,`earnings` 结算单列表/详情/申诉/CSV 导出 | 已新增 order-service stats 与 finance-service earnings;入住率/ADR/Active Promotions 待 M2/M3/M8 | 已首轮闭环,待联调 |
| M6 Notifications & Settings | 通知与设置 | **首轮已实现**:通知列表/已读/Header 未读数 + 设置页资料/通知偏好/改密/语言地区 | 已新增 merchant-service notifications;通知偏好服务端持久化和 2FA/设备管理待后续 | 已首轮闭环,待联调 |
| M7 RBAC & Staff Management | 角色权限与员工 | ✅ **已完成**(account 子账号 + role 角色,四表 RBAC,模块 13 落地) | merchant-service 已通 | 已闭环,仅随新模块补权限位 |
| M8 Promotion & Campaign Management | 营销活动 | **未建**(原型 PromotionsScreen) | marketing-service 需补 merchant 管理接口 | 中 |
| M9 Reviews & Ratings Management | 评价管理 | **首轮已实现**:评价统计/列表/筛选/商家回复/标记平台复核 | 已新增 goods-service merchant reviews;平台复核队列待 admin 侧消费标记字段 | 已首轮闭环,待联调 |
| M10 Merchant Support & Help Center | 帮助中心 | **轻量已实现**:FAQ/指南/邮箱支持入口 | 缺结构化支持工单表与流转接口 | 低(后续 support ticket 专项) |

> 原型 6 screen 与上述映射:Guest Messages → 可并入 M4/M6;Promotions → M8;Reviews → M9;Settings → M6;Staff → M7(已建,UI 风格对齐原型即可);Support → M10。

---

## 关键工程约定(勿违反)

- **三条硬约定**(根 `AGENTS.md`):统一响应 `{code,message,data}`(成功 `code=0`);`#[Permission('键')]` 的键必须与 `database/seed/04-merchant-menu.sql` 的 `perm_key` 对齐,前端按钮用 `v-perm` 同键;站点隔离 `site_id=0` 超管全平台,其余强制本站点(`MerchantContext::scopeMerchantIds()`)。
- **网关登记(极易漏)**:新增一个 merchant 二级模块路由 `/api/v1/merchant/{模块}/*` 后,必须同步在 `deploy/openresty/conf.d/mtrip.conf` 的 `map $merchant_module $merchant_upstream` 里登记「模块 → 上游服务」(auth/account/role/store→merchant_service、order→order_service、goods→goods_service;新增如 earnings→finance_service、promotions→marketing_service 等需补)。改完 `docker compose restart gateway`。漏登 = 接口服务正常也 404。
- **菜单种子登记**:新页面必须在 `database/seed/04-merchant-menu.sql` 加菜单行(`account_scope` 控制 1集团/2商户/3门店可见),`perm_key` 与后端 `#[Permission]` 对齐;组件路径与 `router/dynamic.ts` 的 `resolveComponent` 回退规则一致(无 Vue 文件自动回退 `views/wip/index.vue`)。
- **数据迁移登记**:新增 `database/**/*.sql` 必须登记进 `deploy/docker-compose.yml` 的 mysql `initdb.d` 挂载列表(编号顺序 = 执行顺序)。initdb **只在空数据卷首次执行**,漏挂 = 全新环境缺表。
- **视觉对齐原型**:主色 `#2563EB`、背景 `#F4F6FB`、边框 `#E2E8F0`、字体 Plus Jakarta Sans(已在 `index.html`+`theme.ts`)。新增页面组件风格需与 `UI设计/Hotel Merchant Dashboard` 视觉一致(圆角 8、浅色分组、留白)。原型是 React/shadcn,**只抄视觉不抄代码**,用 antdv 等价组件实现。
- **本地化**:所有文案走 `vue-i18n`(`locales/zh-CN.ts` + `en-US.ts` + `menuI18n.ts`),菜单标题走种子中/英文名,页面内状态/枚举改为 `computed`+`t()` 随语言切换刷新(参考 admin-web 入驻页 80 键国际化做法)。

---

## 推荐首批增量顺序(设计优先,逐增量验收)

> 遵循项目"先严格思考设计再产出"的纪律:每个模块先出**差距分析 + 实现方案**(含后端接口契约/字段/权限位/网关与种子登记清单),评审通过后再写代码。

1. **P0 — M5 经营看板真实化 + 收益结算(首轮已完成,待联调)**
   - 先补 `dashboard` 真实统计(调用 order/goods/store 计数接口,替换硬编码 0);
   - 新增「收益与结算」页:依赖 finance-service 补 merchant 视角接口(收益汇总/结算单/提现记录)。
   - 价值最高、直接替代占位、原型 Dashboard 区块(Operational Summary / Business Insights / Property Performance / Today's Operations)可 1:1 还原。
2. **P1 — M6 设置页 + 通知中心(首轮已完成,待联调)**
   - 设置页低后端依赖(改密已有,补资料/通知偏好/主题),可纯前端+既有接口先做;
   - 通知中心接站内信 `notify_record`(C 端已埋事件),Header 铃铛接真实计数。
3. **P2 — M8 营销活动(下一优先级)**
   - 依赖 marketing-service 补 merchant 管理接口;原型 PromotionsScreen 还原列表/新建/状态。
4. **P3 — M9 评价管理(首轮已完成,待联调)**
   - 依赖 review 域接口;原型 ReviewsScreen 还原评价列表/回复/隐藏。
5. **P4 — M2 客房管理 / M3 房量库存价格**
   - 需先定领域模型(store→room 子实体、inventory/pricing 域归属),后端工作量最大,建议单独立项设计。
6. **P5 — M10 帮助中心(轻量页已完成) / M1 入驻状态展示(轻量)**
   - 帮助中心纯前端静态;入驻状态展示接 user-service 查询。

---

## 复制粘贴给新会话的提示词(主提示词)

```
本项目正在开发商家端 merchant-web(需求基准 = 设计文档/mTrip_Merchant App PRD_v1.0.md,英文全文;PDF 同目录)。
请先读 docs/plans/续作-Merchant-下一步与提示词.md(含 PRD 覆盖矩阵与工程约定)、docs/plans/13-商家端merchant-web落地.md、
docs/plans/HANDOFF.md 顶部「★ 需求基准变更」,再读 merchant-web/src 现有代码(骨架+account/role/store/order/goods/dashboard 已落地,
2026-08-14 已按 Figma 原型重构主框架)与 UI设计/Hotel Merchant Dashboard 原型(仅视觉参考,React/shadcn 不抄代码)。

现状:merchant-web 端口 5174,骨架与 RBAC/订单核销/商品/门店 首批页已建;工作台 dashboard 是占位(统计硬编码 0),
M5 收益结算/M6 设置通知/M8 营销/M9 评价/M2 客房/M3 房量价格/M10 帮助中心 在商家端基本为空。后端 merchant-service/order/goods 已通,
网关 /api/v1/merchant/* 已路由。

第一步:git status 看有无未提交改动,有则按增量粒度在 dev 提交;再 cd merchant-web && npm run build 确认 vue-tsc 全绿。

然后按我指定的方向继续(我会给具体 Module,例如"做 M5 经营看板真实化+收益结算"):
  - 坚持设计优先:先产出该模块的差距分析+实现方案(后端接口契约/字段/权限位/网关 map 与 04-merchant-menu 种子登记清单/前端页面与组件拆解),
    评审通过后再写代码;
  - 遵守三条硬约定(Permission 键对齐 04-merchant-menu 种子 / 统一响应 / 站点隔离);
  - 新增 merchant 模块路由必在 deploy/openresty/conf.d/mtrip.conf 的 map $merchant_module 登记上游,新 SQL 必登记 initdb 挂载;
  - 视觉对齐 Hotel Merchant Dashboard 原型(主色 #2563EB、背景 #F4F6FB、Plus Jakarta Sans、圆角 8),用 antdv 等价实现;
  - 文案全量走 vue-i18n(zh-CN/en-US/menuI18n),状态/枚举 computed+t() 随语言刷新;
  - 改动后 cd merchant-web && npm run build 全绿再交付;后端改动提醒用户在终端跑 scripts/check.ps1。
每完成一项同步更新 docs/plans/ 对应文档、README 进度表、HANDOFF(若涉及平台级变更)。

注意:本机服务由我(用户)控制启停,你(AI)只给命令与脚本,不要替我启动 docker 或前端 dev server。
```

---

## 给单次增量用的提示词模板(以 M5 为例)

```
继续开发 merchant-web 的 Module 5(经营看板真实化 + 收益结算)。
先读 docs/plans/续作-Merchant-下一步与提示词.md 的「PRD 覆盖矩阵」「工程约定」,以及 merchant-web/src/views/dashboard/index.vue(当前占位)。
请先产出:
  1) 差距分析:当前 dashboard 硬编码 0 的 KPI 分别由哪些后端接口提供(无则需在 order/goods/store 或 finance-service 新增);
  2) 实现方案:
     - 后端:finance-service 需新增哪些 merchant 视角接口(收益汇总/结算单列表/提现记录),字段、Permission 键、路由前缀;
     - 网关:mtrip.conf 的 map $merchant_module 是否需新增 earnings→finance_service;
     - 种子:04-merchant-menu.sql 是否新增「经营分析/收益结算」菜单(含 account_scope、perm_key);
     - 前端:dashboard 真实化改造 + 新增 earnings/index.vue(图表用 echarts,已在依赖),组件拆解与 i18n 词条清单。
评审通过后再编码;编码后 cd merchant-web && npm run build 全绿。
```

> 其余 Module 把上面模板里的"Module 5 / dashboard / finance-service / earnings"替换即可复用。

## 2026-08-23 M8 补充完成

- M8 营销活动已完成首轮可运行增量:新增 marketing-service `/api/v1/merchant/promotions/*` 商家视角接口,前端新增 `merchant-web/src/views/promotions/index.vue` 与 `api/promotions.ts`。
- 数据模型差异已补:`marketing_coupon` 新增 `merchant_id`、`created_by_merchant_admin`;全新 DDL `database/marketing/01-marketing.sql` 已覆盖,存量幂等脚本 `database/marketing/07-merchant-promotion-owner.sql` 已登记 `deploy/docker-compose.yml` initdb。
- 网关 `deploy/openresty/conf.d/mtrip.conf` 已登记 `promotions -> marketing_service`;权限按钮 `mch:promotions:add/edit/status/delete` 已同步 `database/seed/04-merchant-menu.sql`,前端按钮同键 `v-perm`。
- dashboard 的 Active Promotions 已接真实 `marketing_coupon` 统计;M5 剩余入住率/ADR 仍等待 M2/M3 房型和房量价格域。
- 最新验证:`D:\BtSoft\php\81\php.exe -l` 检查新增/修改 PHP 文件通过,`cd merchant-web; npm run build` 通过(EXIT=0,仅 Vite chunk 体积警告)。
- 后续优先级建议调整为:M2 客房/房型管理 -> M3 房量价格日历 -> M10 结构化工单;M8 后续再接平台审核流与效果分析。

## 2026-08-23 M2/M3 补充完成

- M2 客房/房型管理已完成首轮可运行增量:新增 goods-service `/api/v1/merchant/rooms/*`,前端新增 `merchant-web/src/views/rooms/index.vue` 与 `api/rooms.ts`,按原型 RoomsScreen 实现酒店筛选、房型表格、全页创建/编辑表单、设施/媒体/价格/库存/政策、固定底部动作条。
- M3 房量与价格已完成首轮可运行增量:新增 goods-service `/api/v1/merchant/availability/*`,前端新增 `merchant-web/src/views/availability/index.vue` 与 `api/availability.ts`,按原型 AvailabilityScreen 实现工具栏、PMS/CM 状态、图例、日历网格、单日抽屉、批量更新、规则与告警面板。
- 数据模型差异已补:`hotel_room_type` 新增房型编码/描述/容量/楼层景观/政策/周末价/加床价/视频/发布状态等字段,`goods_daily_stock` 新增 min/max stay、CTA/CTD、来源、备注字段;全新 DDL `database/goods/01-goods.sql` 已覆盖,存量幂等迁移 `database/goods/06-merchant-room-availability-fields.sql` 已登记 `deploy/docker-compose.yml` initdb。
- 网关 `deploy/openresty/conf.d/mtrip.conf` 已登记 `rooms -> goods_service`、`availability -> goods_service`;按钮权限 `mch:rooms:add/edit/status/delete`、`mch:availability:edit/bulk-update/sync` 已同步 `database/seed/04-merchant-menu.sql`,前端按钮同键 `v-perm`。
- 最新验证:`D:\BtSoft\php\81\php.exe -l` 检查新增/修改 PHP 文件通过,`cd merchant-web; npm run build` 通过(EXIT=0,仅 Vite chunk 体积警告)。
- 后续优先级建议调整为:M4 预订改退/Guest Messages -> M10 结构化工单 -> M2/M3 平台审核流、PMS/CM 真实同步与动态定价规则。
