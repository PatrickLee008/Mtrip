#01 仪表盘（Dashboard）

## 概述

平台运营总览首页：汇总商户审核/商户/预订/收入/退款/结算/带货达人（Affiliate）/系统告警等核心 KPI，展示平台收入与预订趋势图表、待审核商户队列、近期活动动态、系统通知，以及独立的「促销活动运营总览」区块（活动 KPI、活动明细表、促销采纳率、优惠券统计）。

对应路由 / PageId：`dashboard`（侧边栏顶层菜单，无子 Tab）。页面内多处链接跳转到其他模块：`reports`（完整报表）、`verification`（商户验证队列）、`campaigns-analytics`（活动完整分析）、`campaigns`（活动管理）。

来源文件：`UI设计/Super Admin Portal/src/pages/DashboardPage.tsx`

## 子页面 / Tabs

本页无 Tab 切换，是单一整页布局，自上而下分为 5 个区块：

1. **8 张核心 KPI 卡片**（4+4 两行网格）
2. **图表行 1**：平台收入趋势（宽图）+ 预订趋势 + 商户增长（迷你图）
3. **图表行 2**：退款趋势 + 结算趋势 + 带货达人增长（迷你图）
4. **底部两栏**：商户验证队列表格（左） + 近期活动动态 & 系统通知（右）
5. **促销活动运营总览**（独立分区，含分割线）：5 张活动 KPI 卡 + 活动表现表格 + 促销采纳率环形图 + 优惠券统计

## 功能清单

### 区块 1 — 核心 KPI 卡片（8 张，每张含图标、数值、环比说明、10 点迷你折线图 sparkline）

| # | 指标 Label | 数值来源 | 附加说明 | 趋势方向 |
|---|---|---|---|---|
| 1 | Pending Merchant Approvals | `platformStats.pendingVerification` | "+3 since yesterday" / +42% | 下降态（up:false，橙色警示） |
| 2 | Active Merchants | `platformStats.approvedMerchants` | "+2 this week" / +8% | 上升 |
| 3 | Today's Bookings | `platformStats.todayBookings` | "+18% vs yesterday" | 上升 |
| 4 | Platform Revenue MTD | 固定文案 "MMK 48.3B" | "+12.4% YoY" | 上升 |
| 5 | Pending Refund Requests | `platformStats.pendingRefunds` | "3 marked urgent" / +2 | 下降态（警示） |
| 6 | Pending Settlement | `platformStats.pendingSettlements` | "MMK 2.1M total value" | 无方向 |
| 7 | Affiliate Applications | 固定 "3" | "2 new today" / +2 | 无方向 |
| 8 | System Alerts | 固定 "5" | "2 critical" | 下降态（警示） |

每卡片元素：图标（带背景色块）、右上角 sparkline（80×32 SVG 面积图+折线）、大号等宽字体数值、Label、趋势箭头（TrendingUp/TrendingDown 或无）、百分比徽标、说明文案。

### 区块 2 — 图表行 1（3 栏，2:1:1）

- **Platform Revenue Trend**（宽卡）：12 个月折线面积图（500×128 SVG），标题+副标题「Monthly gross revenue (MMK B) · 2024」，右上角「Full Report」按钮 → `onNavigate('reports')`；图上每点绘制圆点 + X 轴月份标签（Jan–Dec）；3 条横向网格参考线。
- **Booking Trend**：迷你图（MiniChart），副标题「bookings / month」。
- **Merchant Growth**：迷你图，副标题「total active merchants」。

### 区块 3 — 图表行 2（3 栏等宽）

- **Refund Trend**：迷你图，「refund requests / month」。
- **Settlement Trend**：迷你图（数据 = revenueData × 0.86），「MMK M settled / month」。
- **Affiliate Growth**：迷你图，「total active affiliates」。

### 区块 4 — 底部两栏

**左：Merchant Verification Queue（商户验证队列表格）**
- 标题副文案：「Requires review · N merchants」，N = `pendingVerifs.length`（取 `merchants` 中 `verificationStatus==='pending'` 前 6 条）。
- 右上「View All」→ `onNavigate('verification')`。
- 表格列：Merchant（商户名+ID两行）、Category（品类，下划线替换空格）、City、Submitted（提交日期）、Status（Pending / Under Review / Resubmission 三态徽标，按索引轮询分配）、Reviewer（审核人名字，取名字首段，5 人轮询：Zhang Wei / Li Min / Wang Fang / Chen Jing / Liu Yang）、Action（「Review」按钮 → `onNavigate('verification')`）。

**右：Recent Activity + System Notifications（纵向堆叠两张卡）**

- **Recent Activity**（近期活动动态，展示最近 5 条，副标题「Last 24 hours」）：每条含彩色图标圆点、活动类型（type，彩色文字）、描述 msg、相对时间 time。8 条硬编码样例活动类型：Merchant Approved / Merchant Suspended / Refund Approved / Settlement Completed / Affiliate Approved / Campaign Created / User Role Updated / Platform Rule Published。
- **System Notifications**（系统通知，2 列网格展示前 6 条）：每条含严重级别图标（danger/warning/info 三色）、消息文案 msg、CTA 文案（cta，UI 未绑定跳转）。7 条样例通知，覆盖：文档过期提醒、验证队列积压、欺诈标记、结算周期提醒、达人提现待批、活动暂停、系统维护公告。

### 区块 5 — Campaign Performance Overview（促销活动运营总览，独立分区）

分区头：图标+标题「Campaign Performance Overview」+ 副标题「Active promotions, coupon tracking, and merchant adoption · Dec 2024」，右侧「Full Analytics」按钮 → `onNavigate('campaigns-analytics')`。

**5 张活动 KPI 卡（`campaignKpis`）：**

| Label | 数值 | 说明 sub | Footer |
|---|---|---|---|
| Active Platform Campaigns | 7 | mTrip-managed campaigns | +2 launched this month |
| Merchant Promo Participation | 30 / 100 | Merchants with active promotions | 30% merchant promo adoption rate |
| Campaign Budget Used | MMK 173.0M | of MMK 280.0M total budget | 62% utilization across all campaigns |
| Coupons Redeemed | 41,836 | of 58,420 claimed | 71.6% redemption rate this month |
| Welcome Rewards Performance | 8,140 | New users converted | 83.1% conv. rate · MMK 4.9M revenue |

卡片含图标、数值（22–24px 等宽字体）、Up/Down 徽标（可选）、底部彩色 footer 说明。

**Campaign Performance 表格**（主区，占 1fr）+ 右侧固定宽 320px 侧栏：

- 表格右上「Manage」按钮 → `onNavigate('campaigns')`。
- 表格列：Campaign Name（带状态色点）、Merchants（参与商户数）、Coupons Claimed（已领取）、Coupons Redeemed（已核销，绿色高亮）、Redemption Rate（进度条+百分比，≥70% 绿 / ≥50% 橙 / 其余红）、Budget Used (MMK)、Status（active/paused/scheduled 徽标）。
- 5 行样例数据（`campaignRows`）：Summer Escape / Thingyan Special / Weekend Flash Sale / New User Welcome / Early Bird 2025，字段：name, merchants, claimed, redeemed, budget, status。

**右侧栏 — Promotion Adoption（促销采纳率卡）：**
- 环形图（DonutChart，SVG，pct=30，蓝色），中心显示百分比+「Adoption」小字。
- 图例两项：Running Promos（30，进度条）/ Not Running（70，进度条）。
- 「Total Merchants」小方块：100。
- 底部「Adoption Rate」行：30%。

**右侧栏 — Coupon Statistics（优惠券统计卡）：**
- 4 项指标 + 各自进度条（除最后一项外）：Coupons Issued 80,000（100%）、Coupons Claimed 58,420（73%）、Coupons Redeemed 41,836（52%）、Discount Given MMK 86.4M（无进度条）。
- 底部提示条：「71.6% overall redemption rate this month」。

### 特殊组件（SVG 手绘图表，非第三方图表库）

- `Spark`：80×32 迷你 sparkline（KPI 卡内）。
- `MiniChart`：可配置宽高的面积折线图，含 3 条网格参考线。
- `buildPath`：将数值数组转换为 SVG path（折线 + 填充区域），线性归一化 min/max。
- `DonutChart`：88×88 环形进度图，SVG stroke-dasharray 实现。

## 数据结构

### 共享自 `platformData.ts`

```typescript
export const platformStats = {
  totalMerchants: number
  pendingVerification: number   // merchants 中 verificationStatus==='pending' 的计数
  approvedMerchants: number     // verificationStatus==='approved' 的计数
  suspendedMerchants: number    // status==='suspended' 的计数
  todayBookings: number         // 硬编码 142
  pendingRefunds: number        // bookings 中 refundStatus==='requested' 的计数
  pendingSettlements: number    // bookings 中 settlementStatus==='pending' 的计数
  platformRevenueMTD: number    // 硬编码 48312400
  affiliateCommissionMTD: number
  activeCampaigns: number
}
```
依赖 `merchants: Merchant[]`（见 03-merchant-management.md 数据结构一节，字段同源）。

### 页面本地定义（均为 mock 常量数组，无正式 interface，按用途推断字段表）

**KPI 卡对象 `kpis[]`**

| 字段 | 类型 | 含义 |
|---|---|---|
| label | string | 指标名称 |
| value | string | 展示数值（已格式化） |
| change | string | 说明文案 |
| pct | string \| null | 百分比徽标文案 |
| up | boolean \| null | 趋势方向（true=涨/绿，false=跌/红，null=不显示箭头） |
| icon | LucideIcon | 图标组件 |
| color / bg | string | 主色 / 背景色（hex） |
| spark | number[] | 10 点迷你走势数据 |

**活动 KPI 卡对象 `campaignKpis[]`**：label, value, sub, footer, icon, color, bg, up(boolean\|null)。

**活动表格行 `campaignRows[]`**：name, merchants(number), claimed(number), redeemed(number), budget(string), status('active'\|'paused'\|'scheduled'\|'ended')。

**优惠券统计 `couponStats[]`**：label, value(string), color。

**验证队列行**：直接复用 `merchants` 中 `verificationStatus==='pending'` 前 6 条（`Merchant` 类型，见模块 03），叠加页面本地派生字段：
- `status`：按行索引对 `['Pending','Under Review','Resubmission']` 取模轮询（非真实数据字段，仅演示态）。
- `reviewer`：按索引对 5 人名单取模轮询。

**活动动态 `activities[]`**：type(string), msg(string), time(string 相对时间), color(string), icon(LucideIcon)。

**系统通知 `notifications[]`**：severity('danger'\|'warning'\|'info'), msg(string), cta(string，仅文案未绑定动作)。

**图表原始数据（数值数组，仅前端展示用）**：`revenueData`（12 月收入，单位 MMK B）、`bookingData`（12 月预订量）、`merchantGrowth`（12 月累计活跃商户数）、`refundData`（12 月退款请求数）、`affiliateData`（12 月累计活跃达人数）、`months`（月份标签）。

## 状态机 / 流转

本页为纯展示（只读）仪表盘，无状态流转；所有交互均为「跳转到其他模块」：

- KPI/图表本身不可点击（除「Full Report」「View All」「Manage」「Full Analytics」四个跳转按钮）。
- 验证队列表格行的「Review」按钮跳转到 `verification` 模块，不在本页内处理审核动作。

## 备注

- 页面顶部 8 个 KPI 中，「Affiliate Applications」「System Alerts」两项数值为硬编码占位（"3"、"5"），未接入 `platformStats`，后端需另建对应统计口径（待审核达人申请数、系统告警数）。
- 「Platform Revenue MTD」卡片数值为硬编码字符串 "MMK 48.3B"，与 `platformStats.platformRevenueMTD`（48,312,400，单位应为最小货币单位或万单位）口径不一致，需后端确认统一单位与格式化规则。
- 所有折线图/环形图/sparkline 均为页面内手写 SVG（无 ECharts/Recharts 等库依赖），后端只需提供时间序列数值，前端自行渲染。
- 「System Notifications」区块的 7 条通知 cta 按钮当前未绑定实际跳转/接口，仅作为 UI 占位，需要后端设计对应待办中心/通知中心能力（含未读计数、跳转目标）。
- 「Campaign Performance Overview」区块的活动/优惠券统计数据在本页与「活动分析」模块（`campaigns-analytics`，未在本次范围内）存在重叠，建议由同一后端聚合接口提供，避免口径不一致。
- 「Merchant Verification Queue」表格中的 Status（Pending/Under Review/Resubmission）与 Reviewer 为前端按索引轮询伪造，真实数据应来自后端审核工单表，字段含义可参考模块 02（商户验证）。
