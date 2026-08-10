# 报表与分析（Reports & Analytics）

## 概述

平台超管的**经营分析与报表中心**:高管仪表盘、交易报表、业务报表、自定义报表构建器。对应现有 `stats/*`(dashboard/site/merchant/goods/finance)的重组升级。位于 Reports & Analytics 组。

来源文件:`UI设计/Super Admin Portal/src/pages/ReportsPage.tsx`(~64KB)。按 `tab` 路由到 4 个子页面组件。

PageId 列表:
- `reports` — Executive Dashboard(高管仪表盘)
- `reports-transactions` — Transaction Reports(交易报表)
- `reports-business` — Business Reports(业务报表)
- `reports-custom` — Custom Reports(自定义报表)

## 子页面 / Tabs

| PageId | 标题 | 组件 |
|---|---|---|
| `reports` | Executive Dashboard | 内嵌主视图 |
| `reports-transactions` | Transaction Reports | TransactionReportsPage |
| `reports-business` | Business Reports | BusinessReportsPage |
| `reports-custom` | Custom Reports | CustomReportsPage |

## 功能清单

### Executive Dashboard（高管仪表盘）
- KPI 4:Platform Revenue YTD(MMK 578.9B,+18.4% vs 2023)、Total Bookings YTD(284,710,+22.1%)、Active Merchants(26,4 new)、Avg Commission Rate(8.6%,MTD 有效率)。
- 图表:12 月双序列折线(Revenue MMK B / Total Bookings 00s);Top Merchants 榜(`topMerchants`)。
- 导出。

### Transaction Reports（交易报表）
- KPI 5:Total Volume / Commission Earned / Transactions / Pending / Failed+Reversed。
- 筛选:类型/状态/支付方式/日期/关键词。
- 表格列:交易(id)、bookingId、customer、merchant、type、method、gross、commission、merchantPayout、net、status、datetime;支持排序(datetime/gross/commission/net)。
- 详情抽屉:金额分解(Gross/Commission/Merchant Payout/Net)+ 明细(Transaction ID/Booking ID/Customer/Merchant/Payment Method/Date&Time)。

### Business Reports（业务报表)
- 6 个报表卡(点击生成/导出):Merchant Reports / Booking Reports / Revenue Reports / Campaign Reports / Affiliate Reports / Inventory Reports(各带说明与指标)。
- 通用筛选(BusinessReportFilter:dateFrom/dateTo/merchant/status)。

### Custom Reports（自定义报表构建器）
- 配置:Report Type、Date Range(from→to)、Merchant(默认 All)、Columns(多选,`REPORT_TYPE_COLUMNS` 按报表类型给可选列)、Export Format(CSV/Excel/PDF)、Extra Filters(自定义 key-value 过滤,可多条)。
- 右侧预览摘要 + 生成/导出;未选列时红色提示。

## 数据结构

```typescript
type TxType = 'Booking Payment'|'Refund'|'Merchant Settlement'|'Affiliate Commission'
  |'Campaign Budget'|'Voucher Redemption'|'Coupon Discount'|'Promotion Discount'|'Withdrawal'
type TxStatus = 'Completed'|'Pending'|'Failed'|'Reversed'|'Processing'
type PayMethod = 'Card'|'Bank Transfer'|'Alipay'|'WeChat Pay'|'Platform Credits'|'Wallet'

interface Transaction {
  id; datetime; type: TxType; bookingId; customer; merchant; method: PayMethod
  gross; commission; merchantPayout; net; status: TxStatus
}

interface ReportCard { id; title; description; icon; /* metrics */ }
interface BusinessReportFilter { dateFrom; dateTo; merchant; status }
const REPORT_TYPE_COLUMNS: Record<string, string[]>  // 每种报表类型的可选列
```

### 实体 → 现有映射
交易报表→聚合 `finance_flow`/`order_main`/`finance_account_entry`;业务报表→各域聚合(商户/订单/营收/活动/达人/库存);自定义报表→报表构建器 + 导出服务。复用 `AdminStatsController`。

## 状态机 / 流转

纯只读分析 + 导出;交易状态 `Pending → Processing → Completed`/`Failed → Reversed`。

## 备注（后端缺口）

1. 需统一聚合接口层(YTD/MTD、同比、Top 榜、时间序列),口径与 Dashboard 模块共享,避免重复。
2. 交易报表的 9 类交易(含 Affiliate Commission/Campaign Budget/Voucher/Coupon/Promotion/Withdrawal)要求交易账本覆盖促销与达人流水——需 `finance_account_entry` 扩展交易类型枚举。
3. 自定义报表构建器需元数据驱动(报表类型→可选列→过滤→导出格式),后端提供列定义与异步导出(CSV/Excel/PDF)。
4. 金额单位 MMK,走站点货币配置。
