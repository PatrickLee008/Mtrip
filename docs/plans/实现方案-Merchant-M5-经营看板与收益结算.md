# 实现方案 — Merchant App M5:经营看板真实化 + 收益结算

> 配套文档:`续作-Merchant-下一步与提示词.md`(覆盖矩阵/工程约定)、`13-商家端merchant-web落地.md`、`设计文档/mTrip_Merchant App PRD_v1.0.md`(Module 5 + Merchant Dashboard 章节)。
> 状态:**首轮已实现(待联调);2026-09-21 收益页已按 Figma `1306:18423` 整页重写(见第 9 节)**。已完成 dashboard 真实化、收益结算页、order/finance 商户视角接口、网关与菜单登记;2026-08-23 M8 完成后 Active Promotions 已改为真实统计;2026-09-21 起入住率已接真实日库存(不再依赖 M3 占位),ADR 仍未接入。
> 更新时间:2026-09-21

---

## 1. 需求摘要(来自 PRD)

**Merchant Dashboard(全局看板)**
- 物业选择:All Properties + 单物业筛选,指标随之刷新。
- 运营概览 KPI:Total Hotels / Today's Bookings / Today's Check-ins / Today's Check-outs / Current Guests / Occupancy Rate / Revenue Today / Pending Confirmations / Pending Settlement / Active Promotions。
- 运营告警:PM S 同步失败 / 连接超时 / 系统通知 / 物业告警(可看日志)。
- 业务洞察图表:Revenue Trend / Occupancy Trend / Booking Trend。
- 物业表现表:Hotel Name / Today's Bookings / Occupancy / Revenue Today / Property Status。
- 今日运营:Hotel / Booking ID / Guest / Room / Check-in / Check-out / Booking Status(可跳转模块)。

**Module 5 Business Dashboard, Earnings & Settlement**
- 动作卡:新预订 / 待确认 / 今日入住离店 / 未读消息 / 系统通知 / 运营告警。
- 经营指标:预订量、间夜数、入住率、营收、ADR、佣金、打款指标。
- 订单级财务拆解:订单金额 / 折扣 / 平台补贴营销 / 佣金 / 扣减 / 税费 / 净结算。
- 结算按 Booking ID,每单独立结算状态;结算单支持日/周/月视图(按结算周期)。
- 结算历史:Business ID / 支付凭证 / 打款日 / 结算状态 / 可下载报告。
- 打款状态跟踪:Pending / Processing / Paid / Failed。
- 对账差异上报 + 结算申诉工作流;可导出财务报表/发票。

---

## 2. 目标与范围

**In Scope(M5 首轮)**
1. 经营看板 `dashboard` 从占位 → 真实数据:运营概览 KPI + 业务洞察图表(营收/预订趋势)+ 物业表现表 + 今日运营表 + 运营告警位。
2. 新增「收益与结算」页:商户视角的结算单列表/详情/对账申诉/导出(只读 + 申诉;确认/打款为平台动作,商户不做)。
3. 后端补齐商户视角的统计接口(订单域)与结算查询接口(财务域),数据范围强制 `MerchantContext::scopeMerchantIds()`。
4. 网关登记 `stats`/`earnings` 上游;种子菜单补「经营分析 / 收益结算」。

**Out of Scope(留后续,本方案仅标注依赖)**
- 入住率/ADR/间夜数:依赖 M2 客房 + M3 房量库存价格(当前无房型/房量域,首轮以"预订量/营收/结算"为主,入住率与 ADR 暂以 `—` 占位并标注待 M3 接入)。
- Active Promotions / 营销:2026-08-23 已随 M8 接入 `marketing_coupon` 真实统计。
- 未读消息 / 系统通知:依赖 M6 通知中心(首轮告警区仅展示运营类静态/同步告警占位,真实通知留 M6)。
- 结算单自动生成周期、发票、平台级申诉审批流:依赖财务模块08 定时任务与配置,本方案只做查询与前端申诉入口。

---

## 3. 现状盘点

| 层 | 已有(可复用) | 缺口 |
|---|---|---|
| 前端 merchant-web | `dashboard/index.vue`(占位)、`store/order/goods` 页、`PageContainer/StatusTag/AmountText`、`echarts@5`、`vue-i18c`、`utils/http`(get/post)、`api/order.ts` 范式 | dashboard 无真实数据;无 `earnings`/`stats` api;无结算页;无图表封装组件 |
| 后端 order-service | `Merchant/OrderController`(已用 `MerchantContext::scopeMerchantIds()` 做范围)、`Admin/AdminStatsController`(大屏/趋势/排行/报表聚合逻辑) | 无**商户视角**统计接口(趋势/物业表现/今日运营) |
| 后端 finance-service | `SettleController`(结算单列表/详情/确认/打款/争议)、`FinanceController`(总览/流水/月度报表)、`WithdrawController` | 仅 admin 路由(`/api/v1/admin/finance/*`);无**商户视角**结算查询;`finance_merchant_settle` 表已含 `merchant_id`/`site_id` 可复用 |
| 网关 | `map $merchant_module` 已含 auth/account/role/store/order/goods | 缺 `stats`(→order_service)、`earnings`(→finance_service) |
| 种子 | `04-merchant-menu.sql` 已含 dashboard/account/role/store/order/goods | 缺「经营分析 / 收益结算」菜单与 perm_key |
| 数据模型 | `order_main`(pay_amount/platform_commission/merchant_receivable/order_status/order_type)、`finance_merchant_settle`(settle_no/settle_cycle/settle_amount/status 0待确认1已确认2已打款3争议)、`finance_flow` | 商户视角需在查询里把 `applySiteScope` 换成 `scopeMerchantIds` 过滤 |

---

## 4. 差距分析(逐能力)

| PRD 能力 | 现状 | 后端缺口 | 前端缺口 |
|---|---|---|---|
| 运营概览 KPI(10 项) | 硬编码 0 | 需 `merchant/stats/dashboard` 聚合(复用 AdminStatsController 逻辑,改商户范围) | dashboard 接入接口,占用率/ADR 占位 |
| 业务洞察图表(3 趋势) | 无 | 同上接口返回 trend 数组 | 封装 echarts 折线/面积图组件 |
| 物业表现表 | 无 | stats 接口返回按物业(merchant/store)分组 | a-table 渲染 |
| 今日运营表 | 无 | stats 接口返回近 N 条待处理订单 | a-table + 跳转订单详情 |
| 运营告警 | 无(铃铛占位) | 暂用静态/同步告警位,真实通知留 M6 | 告警卡片区 |
| 收益总览(营收/佣金/待结算) | 无 | `merchant/earnings/overview`(复用 FinanceController::overview,改商户范围) | earnings 页头部卡片 |
| 结算单列表/详情 | 无 | `merchant/earnings/settle/list` `/detail`(复用 SettleController,加商户范围,去除 confirm/markPaid 写操作) | earnings 页列表 + 抽屉详情 |
| 对账申诉 | 无(平台侧争议) | `merchant/earnings/settle/dispute`(复用 SettleController::dispute,仅商户对自身单提争议) | 详情页"提交差异/申诉"按钮 |
| 结算单导出 | 无 | `merchant/earnings/settle/export`(后端生成 CSV,或前端按列表 CSV) | 导出按钮 |
| 打款状态跟踪 Pending/Processing/Paid/Failed | 无 | 由 `finance_merchant_settle.status` 映射(0/1/2/3→映射文案;Failed 由退款/异常流入,首轮 status 三态即可) | StatusTag 渲染 |
| 订单级财务拆解 | 无 | settle/detail 已含 settle_amount 等;订单级金额拆解由 `order_main` 字段(platform_commission/merchant_receivable)提供 | 详情抽屉分段展示 |

---

## 5. 后端接口契约(新增/改造)

### 5.1 order-service — 商户统计(新增 `Merchant/StatsController`)
路由追加到 `config/routes.php` 的 `/api/v1/merchant/stats` 组(挂 `MerchantAuthMiddleware` + `OperationLogMiddleware`):

```
GET /api/v1/merchant/stats/dashboard
  query: propertyId?(单物业筛选,留空=本主体全部); startDate?; endDate?(默认近30天)
  返回(对齐 AdminStatsController::dashboard,但 applyMerchantScope 替代 applySiteScope):
    kpi: { todayBookingCount, todayCheckInCount, todayCheckOutCount, currentGuestCount,
           revenueToday, pendingConfirmationCount, pendingSettleCount, activePromotionCount,
           totalPropertyCount, occupancyRate(暂null) }
    trend: [{ date, bookingCount, salesAmount }]            // Booking Trend + Revenue Trend 合并
    propertyPerformance: [{ propertyId, propertyName, todayBookings, occupancy(null), revenueToday, status }]
    todayOperations: [{ orderId, orderNo, guest, room, checkIn, checkOut, status }]
  说明:
    - todayCheckIn/Out、currentGuest、occupancy 依赖 M3 房量库存,首轮 return null/—,注释待 M3。
    - activePromotionCount 已接 M8,统计当前 merchant 范围内有效的 `marketing_coupon`。
    - pendingConfirmationCount = 待支付/待确认订单数;revenueToday = 今日已支付 pay_amount 求和。
    - 数据范围用 MerchantContext::scopeMerchantIds() 注入 whereIn('merchant_id', ...)。
```

### 5.2 finance-service — 商户收益结算(新增 `/api/v1/merchant/earnings` 路由组)
在 `config/routes.php` 新增路由组(挂 `MerchantAuthMiddleware`,**不加** `OperationLogMiddleware` 可选;写操作加 Permission 注解):

```
GET  /api/v1/merchant/earnings/overview         -> FinanceController::merchantOverview (复用 overview,改商户范围)
GET  /api/v1/merchant/earnings/settle/list      -> SettleController::merchantIndex  (复用 index,whereIn merchant_id)
GET  /api/v1/merchant/earnings/settle/detail    -> SettleController::detail          (加商户范围断言)
POST /api/v1/merchant/earnings/settle/dispute   -> SettleController::dispute         #[Permission('mch:earnings:dispute')] (商户仅对自身单提争议)
GET  /api/v1/merchant/earnings/settle/export    -> SettleController::merchantExport (CSV,前端亦可纯前端导出,二选一)
```
- 改造点:`FinanceController::overview` 内 `applySiteScope` 改为商户范围(新增 `merchantOverview` 或加 `merchantId` 从 `MerchantContext` 取);`SettleController::merchantIndex` 把 `applySiteScope` + `merchantId` 入参改为 `MerchantContext::scopeMerchantIds()` 强制过滤(商户不可查他人)。
- **不开放** `confirm`/`markPaid`(平台动作),商户端仅查询 + 申诉。
- 结算单状态映射:0→Pending/待确认,1→Processing/已确认,2→Paid/已打款,3→Failed or Disputed(按 PRD Failed 语义,首轮用 Disputed 区分争议)。需在 `StatusTag`/i18n 统一定义。

### 5.3 网关 `deploy/openresty/conf.d/mtrip.conf`
`map $merchant_module $merchant_upstream` 追加两行(改完 `docker compose restart gateway`):
```
    stats     order_service;
    earnings  finance_service;
```

---

## 6. 种子菜单登记(`database/seed/04-merchant-menu.sql`)
在 `dashboard`(100)后追加「经营分析」目录与「收益结算」页面(含 account_scope、perm_key 与后端 `#[Permission]` 对齐):
```sql
INSERT IGNORE INTO `merchant_menu` (id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,icon,sort,account_scope) VALUES
(600,0,'经营分析','Analytics','menu.analytics','mch:analytics',1,'/analytics','',          'PieChartOutlined', 6,'1,2,3'),
(610,600,'经营看板','Dashboard','menu.analytics.dashboard','mch:analytics:dashboard',2,'/analytics/dashboard','analytics/dashboard','DashboardOutlined',1,'1,2,3'),
(620,0,'收益结算','Earnings','menu.earnings','mch:earnings:list',2,'/earnings','earnings/index','AccountBookOutlined',7,'1,2,3');
INSERT IGNORE INTO `merchant_menu` (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort,account_scope) VALUES
(62001,620,'导出结算单','Export','mch:earnings:export',3,1,'1,2,3'),
(62002,620,'提交申诉','Dispute','mch:earnings:dispute',3,2,'1,2,3');
```
> 注:`dashboard`(100) 已是首屏独立页,本方案把"真实化"仍落在 `dashboard/index.vue`;新增「经营分析」目录承载 analytics 页(与 dashboard 并存或合并,评审时定)。若合并,可省略 600/610 直接扩 dashboard。

---

## 7. 前端拆解

### 7.1 改造 `views/dashboard/index.vue`(真实化)
- 删除 KPI 硬编码 0,`onMounted` 调 `apiStatsDashboard()`,KPI 按 `account_type` 过滤展示(沿用现有 `kpis` computed 结构,值取自接口)。
- 新增三个区块(原型对齐:白卡、圆角 8、`#F4F6FB` 背景):
  - **业务洞察**:封装 `components/EchartsCard.vue`(基于 echarts,接收 option),画 Revenue Trend + Booking Trend 双折线/面积。
  - **物业表现**:`a-table` 渲染 `propertyPerformance`(Hotel / Today's Bookings / Occupancy(—) / Revenue Today / Status)。
  - **今日运营**:`a-table` 渲染 `todayOperations`,行可点跳转 `/order/detail?id=`。
  - **运营告警**:告警卡片区(首轮静态/占位,接 M6)。
- 「物业切换器」已存在于侧边栏(SideMenu 假数据),首轮 dashboard 暂以"本主体全部"为主,单物业筛选 `propertyId` 作为预留参数(接 store 列表真实化时启用)。

### 7.2 新增 `views/earnings/index.vue`(收益与结算)
- 头部 3 卡:累计营收 / 待结算金额 / 已打款(来自 `apiEarningsOverview`)。
- 结算单列表 `a-table`:结算单号 / 周期 / 结算金额 / 状态(StatusTag 映射 Pending/Processing/Paid/Disputed)/ 操作(详情、导出、申诉)。
- 详情抽屉:订单级财务拆解(订单金额、平台佣金、商户应收、净结算)、打款状态、凭证;`mch:earnings:dispute` 按钮提交差异说明(dispute 接口)。
- 导出:`mch:earnings:export` 或前端 CSV(参考 admin 订单导出做法)。

### 7.3 API 层(新增)
- `src/api/stats.ts`:`apiStatsDashboard(params)` → `get('/merchant/stats/dashboard', params)`。
- `src/api/earnings.ts`:`apiEarningsOverview()` / `apiSettleList(params)` / `apiSettleDetail(id)` / `apiSettleDispute(payload)` / `apiSettleExport(params)`。

### 7.4 组件与 i18n
- 新增 `components/EchartsCard.vue`(echarts 初始化/resize/dispose 封装,主题色 `#2563EB`)。
- `locales/zh-CN.ts` + `en-US.ts` 新增命名空间 `analytics.*` / `earnings.*`(概览卡、结算单状态、申诉、导出、财务拆解字段);菜单 i18n 补 `menu.analytics*` / `menu.earnings*`。
- 结算状态枚举 `STATUS_MAP` 改为 `computed`+`t()` 随语言刷新。

---

## 8. 验收标准
1. `docker compose restart gateway` 后,`/api/v1/merchant/stats/dashboard` 与 `/api/v1/merchant/earnings/*` 经网关可达(401 未登录、200 带数据)。
2. 商户 A 只能查到自身 `scopeMerchantIds()` 内的订单与结算单(越权 merchant_id 被 `assertMerchantScope` 拒绝)。
3. dashboard 10 项 KPI 中可计算项(预订量/营收/待结算等)显示真实值;入住率/ADR 显 `—` 且标注待 M3。
4. earnings 页结算单列表/详情/申诉/导出可用;状态 Tag 四态正确。
5. 图表在 dashboard 正常渲染(无 console error),窗口 resize 不崩。
6. `cd merchant-web && npm run build` 全绿;后端 `scripts/check.ps1` 全绿。
7. 中英文切换,新增文案全部跟随 `t()`。

---

## 9. 风险与待定
- **入住率/ADR/间夜数**:强依赖 M2 客房 + M3 房量库存(当前无房型/房量域)。首轮不做,UI 占位并标注,避免伪造指标。建议 M3 落地后回头补 `stats/dashboard` 的 occupancy 计算。
- **Active Promotions**:已接 M8 首轮商家营销活动;平台审核流/活动效果分析仍归 M8 后续。
- **通知/告警真实数据**:依赖 M6,首轮 dashboard 告警区仅静态占位。
- **结算单生成与发票**:依赖财务模块08 定时任务与周期配置;本方案只做查询 + 申诉入口,自动生成归专项。
- **Failed 状态**:PRD 有 Failed,但现有 `finance_merchant_settle.status` 仅 0/1/2/3(争议)。首轮将 3 映射为 Disputed,Failed 待退款异常链路明确后再补(或复用退款状态)。
- **数据主权**:订单台账在 order-service、余额/结算在 finance-service,遵循既有分域;merchant-web 只查询,不跨域写。

---

## 10. 子任务清单(供逐条执行,每条可独立验收)
1. [x] **后端-order**:新增 `Merchant/StatsController::dashboard`,路由 `/api/v1/merchant/stats` 组,按 `MerchantContext::scopeMerchantIds()` 强制范围;`php -l` 通过。
2. [x] **后端-finance**:新增 `Merchant/EarningsController` 的 overview/list/detail/dispute;路由 `/api/v1/merchant/earnings` 组 + `mch:earnings:dispute` Permission 注解。
3. [x] **网关**:`mtrip.conf` 的 `map $merchant_module` 加 `stats→order_service`、`earnings→finance_service`。
4. [x] **种子**:`04-merchant-menu.sql` 加「收益结算」页面与 `mch:earnings:export/dispute` 按钮权限。
5. [x] **前端-api**:`api/stats.ts`、`api/earnings.ts`。
6. [x] **前端-组件**:`components/EChartCard.vue`。
7. [x] **前端-dashboard**:真实化 KPI + 趋势图 + 物业表现 + 今日运营 + 告警位。
8. [x] **前端-earnings**:`views/earnings/index.vue`(列表/详情抽屉/申诉/前端 CSV 导出)。
9. [x] **前端-i18n**:`dashboard.*` / `earnings.*` 中英文词条 + 菜单 i18n。
10. [x] **联调验收**:`php -l`、`merchant-web npm run build`、隔离库集成回归 `scripts/test-dashboard-earnings.sh`(47/47)
    与 Figma 校验 `scripts/check-earnings-figma.mjs`(230/230)均已通过。登录态浏览器视觉走查仍待具备会话后补验。

---

## 11. 2026-09-21 追加:收益页按 Figma `1306:18423` 整页重写

**设计源**:file `fsK2rrl2sadcowrxspvGV8`(mTrip_Merchant)SECTION `1306:18423`「Business Dashboard & Settlement」
= 整页画板 `1306:14653` + 导出弹窗 `1493:16429` + 通知抽屉 `1352:14573`(属 M6,未做)。

**范围判定**:稿面侧边栏同时保留 PORTFOLIO 的 `Dashboard` 与 BUSINESS 的 `Dashboard & Earnings`,
后者即现有菜单 800 `/earnings`。故本次只重写 `/earnings`,**不动** `/dashboard`、路由、网关、菜单种子与权限键。

### 11.1 前端落地(merchant-web)

| 稿面帧 | 组件 | 数据来源 |
|---|---|---|
| 页头 | `index.vue` | 周期选择(This Month / Last Month / Last 30 / Last 7,功能性)+ Export Report |
| summary-row ×4 | `SummaryCard` + `SparklineBars` | 到达/离店人数、入住率 + 周环比、Sync Errors |
| financial-row 左 | `DailyRevenueCard` | `stats.trend` 每日营收柱(图例 Daily Revenue) |
| financial-row 右 | `EarningsBreakdownCard` | `earnings.overview`(Gross / 折扣 / 佣金率 / Net 高亮块) |
| grid-row-1 | `TrendLineCard` + `OccupancyAreaCard` | `stats.trend` 折线 + Peak;`stats.occupancyTrend` 面积 + Avg |
| grid-row-2 | `BookingVolumeCard` + `RoomTypeDonutCard` | `stats.trend` 按星期聚合;`stats.roomTypePerformance` 环形 |
| settlements-card | `SettlementsTable` | `stats.recentBookings`(7 列 + Payment/Booking Status 双徽标) |
| Export Report Dialog | `ExportReportModal` | 报告类型下拉 + 日期区间 + 三张格式卡(仅 CSV 可用) |

- 图表手写 SVG/DOM,**不引 echarts**(与 availability / promotions 同处理,SSR 可断言);主色取稿面 `#4169ED`,
  独立 `tokens.less` 令牌组,勿替换为全局变量。
- 删除稿面没画的旧块:6 张统计卡、筛选表单卡、结算单列表 + 详情抽屉 + 申诉弹窗(权限键全部保留)。
- 导出弹窗的 Excel / PDF 卡按用户决定置灰并标注「即将开放」,不引入 xlsx / pdf 依赖。
- `views/availability/useDismiss.ts` 提升为 `src/composables/useDismiss.ts`,两页共用。

### 11.2 后端补字段

- `order-service Merchant/StatsController::dashboard`:真实 `occupancyRate`(替换原写死 `null`)、
  `occupancyWeekDelta`、到达/离店人数与单量、`syncErrorCount`、`occupancyTrend`、
  `roomTypePerformance`、`recentBookings`,并回显 `startDate/endDate`。默认区间仍 7 天(`/dashboard` 不受影响)。
- `finance-service Merchant/EarningsController::overview`:`commissionRate`、`currency`。
- **路由、网关、菜单、权限键零改动。**

### 11.3 口径(替换第 1/4 节中「入住率依赖 M2/M3」的旧表述)

- **入住率**:逐物业计算后汇总 —— 有 `goods_daily_stock` 行时取 已售/总量;
  无日库存行时回退「`hotel_room_type.base_stock` 为分母 + 在住间夜数(`use_date ≤ 当日 < end_date`,
  状态 1/2/3,按 `quantity`)为分子」。混合组合两侧都计入。
  `occupancyRate` = 区间日均;`occupancyWeekDelta` = 近 7 日均值 − 前 7 日均值(百分点)。
- **人数** = `order_main.guests` 密文里的住客名单条数(复用 `decryptField`),为空回退 `quantity`。
- **Sync Errors** = `order_sync_log.status=2` 且区间内,join `order_main` 按物业范围收窄。
- **房型占比** = 区间内 `order_status IN (1,2,3)` 按 `room_type_id + sku_name` 聚合取前 6。
- **币种** = `merchant_account.currency`(默认账户优先)→ `hotel_room_type.currency` → `THB`。
  ⚠ `merchant_store` **没有** currency 列。
- **徽标**:Payment 按 `pay_method=4` → Pay at Hotel、`payment_status 3/4` → Refund、`2` → Paid、其余 Unpaid;
  Booking Status 由 `booking_status 1–6` 直映,`0`(旧数据)回退 `order_status`。
- 稿面副标题 "your restaurant's sales performance" 系餐饮模板误抄,改为 "your property's"。

### 11.4 验证

- `merchant-web/scripts/check-earnings-figma.mjs`:SSR 真实渲染 + 稿面硬值与令牌断言,**230/230 GREEN**(手动跑)。
- `scripts/test-dashboard-earnings.sh`:隔离库集成回归,**47/47 PASS**(订单 38 + 财务 9)。
- `cd merchant-web && npm run build` 通过;改动 PHP `php -l` 通过。
- **改后端后必须热重启**:容器挂了本地源码,但 Hyperf/Swoole 长驻 worker 一旦加载类就留在进程内存,
  改方法体不重启不生效。只跑 CLI 集成测试会全绿而 HTTP 端仍返回旧结构,前端拿到缺字段响应即白屏
  (`reading 'slice'`)且 spinner 卡死。本次已 `./mtrip.sh restart order-service` / `order-service-app` /
  `finance-service`,并用真实 HTTP 复核:`/merchant/stats/dashboard` 返回
  `occupancyTrend(30) / roomTypePerformance(2) / recentBookings(6)` 与全部新 kpi 键,
  `/merchant/earnings/overview` 返回 `currency=MMK`、`commissionRate=8.51`。
- 前端 `index.vue` 已加 `normalizeStats/normalizeOverview` 兜底并把 `loadAll` 收进 `try/finally`,
  后端(含旧版本)缺字段时只降级为「该项无数据」。
- 走查修复:稿面 `export-btn` 标固定 44px 而同排 `date-picker` 是 hug(≈41px),照稿实现两边天然不等高。
  已立 `@ea-control-height: 44px` 统一页头两控件、弹窗 Cancel/Download 与下拉框,纵向 padding 归零只留横向;
  校验脚本补 10 条断言核对编译产物 CSS 规则体高度 → **240/240 GREEN**。

### 11.5 未做

- ADR / 间夜数仍未接入;通知抽屉 `1352:14573` 属 M6;登录态浏览器视觉走查(无可用会话)。
- Excel / PDF 导出未实现(依赖未引入)。
