# 预订管理（Bookings Admin）

## 概述

平台超管对全平台预订、退款请求、结算与对账、历史记录的统一管理入口。位于左侧导航 **Business Operations（业务运营）> Hotel Operations（酒店运营）** 分组下，共 4 个子页面共用同一份 `bookings` mock 数据（50 条，`src/data/platformData.ts`），由 `tab: PageId` 区分展示逻辑与列布局。

源文件：`UI设计/Super Admin Portal/src/pages/BookingAdminPage.tsx`

PageId 列表：
- `bookings-admin` — All Bookings（全部预订）
- `bookings-refunds` — Refund Requests（退款请求）
- `bookings-settlements` — Settlement & Reconciliation（结算与对账）
- `bookings-history` — Booking History（预订历史）

## 子页面 / Tabs

| PageId | 标题 | 副标题 | 说明 |
|---|---|---|---|
| `bookings-admin` | All Bookings | Manage all platform bookings, refunds, and settlements | 默认 tab，全量预订列表 + 快捷操作入口 |
| `bookings-refunds` | Refund Requests | Review and process guest refund requests | 仅展示 `refundStatus === 'requested'` 的记录，含 SLA 计时 |
| `bookings-settlements` | Settlement & Reconciliation | Financial settlements, payouts, and reconciliation records | 全量预订按「结算单」视角展示，含发票/对账状态 |
| `bookings-history` | Booking History | Completed and historical booking records with full audit trail | 仅展示 `completed`/`cancelled` 记录，含时间线入口 |

Badge 含义（组件级）：
- `BookingBadge`（bookingStatus）：confirmed(绿) / completed(灰) / cancelled(红) / no_show(浅灰) / checked_in(蓝)，展示时下划线转连字符（如 `checked-in`）
- `RefundBadge`（refundStatus）：none 显示 `—`；requested(黄) / approved(绿) / rejected(红) / processed(灰)
- `SettleBadge`（settlementStatus）：settled(绿) / pending(黄) / processing(蓝) / overdue(红)
- `InvoiceBadge`（推导字段，非 mock 原生）：Issued(绿) / Pending(黄) / Overdue(红)
- `ReconciliationBadge`（推导字段）：Matched(绿) / In Review(蓝) / Unmatched(橙)
- `PriorityBadge`（仅退款页，推导字段）：High(红) / Medium(黄) / Low(绿)

## 功能清单

### 公共头部（所有 tab）
- 标题 + 副标题（按 tab 切换文案）
- 右上角按钮：`Date Range`（日期范围选择，未接交互）、`Export`（导出）

### KPI 卡片（按 tab 切换指标集，卡片高亮色随数值语义变化）

**All Bookings（5 卡）**
| 指标 | 计算方式 |
|---|---|
| Today's Bookings | 硬编码 142（无对应 mock 字段） |
| Completed | `bookingStatus === 'completed'` 计数 |
| Cancelled | `bookingStatus === 'cancelled'` 计数 |
| Refund Requested | `refundStatus === 'requested'` 计数 |
| Pending Settlement | `settlementStatus === 'pending'` 计数 |

**Settlement & Reconciliation（4 卡）**
| 指标 | 计算方式 |
|---|---|
| Total Settlements | `bookings.length` |
| Settled | `settlementStatus === 'settled'` 计数 |
| Pending Payout | `settlementStatus in (pending, processing)` 计数 |
| Overdue | `settlementStatus === 'overdue'` 计数 |

**Refund Requests（4 卡）**
| 指标 | 计算方式 |
|---|---|
| Pending Refunds | 退款请求行数 |
| Total Requested | `Σ(refundAmount ?? amount*0.5)`，¥ 格式化 |
| Avg Processing Time | 硬编码 "3.2 days" |
| SLA Breaches | 硬编码 2 |

**Booking History（5 卡）**
| 指标 | 计算方式 |
|---|---|
| Total Historical | completed+cancelled 计数 |
| Completed | 同上子集中 completed 计数 |
| Cancelled | 同上子集中 cancelled 计数 |
| With Refunds | `refundStatus !== 'none'` 计数 |
| Settled | `settlementStatus === 'settled'` 计数 |

### 搜索 / 筛选栏（除 settlements 外通用）
- 关键词搜索框：匹配 `id` / `guestName` / `merchantName` / `hotelName`（大小写不敏感，部分匹配）
- `bookings-admin` / `bookings-refunds` / `bookings-history`：下拉「All Booking Status」（Confirmed/Completed/Cancelled）+ 下拉「All Refund Status」（Requested/Approved/Processed）—— **UI 存在但未接筛选逻辑**（仅展示，未绑定 state）
- `bookings-settlements`：下拉「All Settlement Status」（Settled/Pending/Overdue）+ 下拉「All Invoice Status」（Issued/Pending/Overdue）—— 同样未接逻辑
- 末尾恒有下拉「All Settlement」（Settled/Pending/Overdue，所有 tab 均显示，冗余/装饰性）
- 右侧结果计数：`{total} results`

### 表格分页
- 每页 10 条，分页控件：上一页/下一页 + 页码按钮（最多显示 6 个，settlements/history/refunds 无该限制截断逻辑差异，admin tab 同样 10/页）
- 底部文案：`Showing {start+1}–{end} of {total}`

---

### Tab: All Bookings（默认列表）
表格列（11 列）：
1. Booking ID（等宽蓝色文本，如 `B-xxxx`）
2. Guest（姓名 + 电话两行）
3. Merchant / Hotel（商户名 truncate + 房型两行，注意此列第二行显示的是 `roomType` 而非酒店名）
4. Amount（¥ 千分位）
5. Commission（¥，红色）
6. Booking Status（BookingBadge）
7. Refund Status（RefundBadge）
8. Settlement（SettleBadge）
9. Channel（原始文本）
10. Date（`createdAt` 取前 10 位，即日期部分）
11. Actions

行操作：
- 查看详情（Eye 图标，蓝色）→ 打开 Booking Detail Drawer
- 若 `refundStatus === 'requested'`：额外显示「审核退款」按钮（CheckCircle，橙色）→ 打开 Refund Review Dialog
- 若 `settlementStatus in (pending, processing)`：额外显示「处理结算」按钮（DollarSign，绿色）→ 打开 Settlement Dialog
- 行整体 `cursor: pointer`，但点击行本身未绑定跳转（仅 hover 变色）

无批量操作（无复选框）。

---

### Tab: Refund Requests
仅显示 `refundStatus === 'requested'` 的行。表格列（10 列）：
1. Booking ID
2. Guest（姓名 + 电话）
3. Merchant（商户名 truncate + 酒店名两行）
4. Refund Reason（推导：`bookingStatus==='cancelled'` → "Guest Cancellation"；`no_show` → "No Show — Policy Refund"；否则 "Service Issue"）
5. Requested Amount（`refundAmount ?? round(amount*0.5)`，¥，橙色加粗）
6. Requested By（恒为 "Guest"，硬编码）
7. Refund Method（推导，按行索引轮询 `['Original Payment','Bank Transfer','Platform Credit']`）
8. Priority（PriorityBadge，推导：amount≥3000→High，≥1000→Medium，否则 Low）
9. SLA Timer（`SlaTimer` 组件：截止日 = createdAt+5天；剩余天数≤0 显示"Overdue"红色；≤2天橙色；否则绿色显示"{n}d left"，等宽字体）
10. Actions

行操作（More 菜单 + 查看按钮）：
- 查看（Eye）→ 打开 Booking Detail Drawer
- More 菜单：Approve Refund（CheckCircle）→ Approve Refund Dialog；Reject Refund（XCircle，危险色）→ Reject Refund Dialog；Request Additional Info（Info，仅 toast）；View Booking（Eye，仅 toast）

---

### Tab: Settlement & Reconciliation
展示全部 `bookings`（非仅退款/历史子集）。表格列（11 列）：
1. Settlement ID（`SET-{booking.id}`，等宽蓝色）
2. Merchant（商户名 + 酒店名两行，均 truncate max-w-120px）
3. Settlement Period（`checkIn – checkOut`，等宽）
4. Gross Revenue（¥ `amount`）
5. Commission（¥ `commission`，红色）
6. Net Payout（`amount - commission`，绿色）
7. Settlement Status（SettleBadge）
8. Payment Date（推导：`checkOut + 7天`）
9. Invoice Status（InvoiceBadge，推导：settled→Issued；overdue→Overdue；否则 Pending）
10. Reconciliation（ReconciliationBadge，推导：settled→Matched；processing→In Review；否则 Unmatched）
11. Actions

行操作：
- 查看结算详情（Eye）→ 打开 Settlement Detail Drawer（清空备注草稿）
- More 菜单：Download Settlement Report（toast）；Generate Invoice（toast）；Mark as Paid → 打开 Mark as Paid Dialog

---

### Tab: Booking History
仅显示 `bookingStatus in (completed, cancelled)`。表格列（14 列，注意存在重复列）：
1. Booking ID
2. Guest（姓名+电话）
3. Merchant / Hotel（商户名 truncate + roomType）
4. Amount
5. Commission
6. Booking Status（BookingBadge）
7. Refund Status（RefundBadge）
8. Settlement（SettleBadge）
9. Final Status（**与列 6 重复**，同样渲染 BookingBadge）
10. Refund Outcome（**与列 7 重复**，同样渲染 RefundBadge）
11. Settlement Outcome（**与列 8 重复**，同样渲染 SettleBadge）
12. Completed（`checkOut` 日期，等宽灰色）
13. TL（Timeline 快捷按钮，蓝底圆角方块，点击打开 Booking Timeline Drawer）
14. Actions

行操作：
- 查看详情（Eye）→ Booking Detail Drawer
- More 菜单：View Timeline（Clock）→ Booking Timeline Drawer；Export Record（toast）；View Related Settlement（toast）

> 注：History 表格第 9–11 列与第 6–8 列内容完全重复（原型演示阶段的设计冗余），正式实现时应去重，仅保留一组即可，或替换为「结算结果」等更有信息量的派生字段。

---

### 弹窗 / 抽屉

**Booking Detail Drawer**（宽 600px，标题 `Booking {id}`，副标题 `{merchantName} · {checkIn} to {checkOut}`）
- Booking Timeline 区块（简化版 3 步时间线，非完整审计时间线）：
  1. Booking Created（`createdAt`，蓝点）
  2. Payment Received（`createdAt`，绿点）
  3. 动态第三步：confirmed→"Awaiting Check-in"(橙)；checked_in→"Guest Checked In"(绿)；其他→"Booking Completed"(绿)，日期为 `checkIn`
- 详情字段网格（2 列）：Guest Name / Guest Email / Guest Phone(mono) / Channel / Room Type / Nights / Check-in(mono) / Check-out(mono) / Booking Amount / Commission（含百分比）/ Booking Status / Settlement Status / Promo Code Applied（若有，mono）/ Refund Status（若非 none）/ Refund Amount（若有）

**Refund Review Dialog**（variant=warning，All Bookings tab 触发）
- 文案：`Approve refund of ¥{amount} for booking {id} — {guestName}?`
- 确认按钮：Approve Refund → loading 800ms → success toast

**Settlement Dialog**（variant=confirm，All Bookings tab 触发，处理结算）
- 文案：`Process settlement of ¥{amount} for booking {id}?`
- 确认按钮：Process Settlement → success toast

**Mark as Paid Dialog**（variant=confirm，Settlements tab 触发）
- 文案：`Mark settlement SET-{id} as paid? Net payout ¥{amount-commission} will be recorded.`
- 确认按钮：Mark as Paid → success toast

**Approve Refund Dialog**（variant=success，Refunds tab 触发）
- 文案：`Approve refund of ¥{refundAmount ?? amount*0.5} for booking {id} — {guestName}?`

**Reject Refund Dialog**（variant=danger，Refunds tab 触发）
- 文案：`Reject the refund request for booking {id} — {guestName}? This action cannot be undone.`
- 确认后 error toast

**Booking Timeline Drawer**（宽 560px，History tab 的 TL 按钮 / More 菜单触发）
- 汇总条：Booking Status / Refund / Settlement 三个 Badge + Events 计数
- 异常横幅：若存在 `exception: true` 事件，显示黄色告警条
- 完整审计时间线（基于 `buildTimeline(booking)` 动态生成，见下方"数据结构"节的 `TimelineEventKind`），每个事件含图标节点（含专属配色）、标题、备注、日期时间、操作者 chip（System/Finance System 为灰色 chip，人工操作者为蓝色 chip）；`completed`/`settlement_paid`/`refund_approved` 显示绿色对勾；`exception` 事件显示红色告警图标
- 底部：Export Audit Log 按钮 + 事件计数/最后更新时间

**Settlement Detail Drawer**（宽 600px，Settlements tab 的查看按钮触发）
- 总体结果横幅（Overall Result Banner）：Matched(绿,ShieldCheck图标) / Under Review(蓝,Clock图标) / Unmatched(红,AlertCircle图标)，结果由 `settlementStatus` 推导：settled→Matched；processing→Under Review；其他→Unmatched；同时右侧显示 `ReconciliationBadge`
- Settlement Info 卡片（2 列网格，8 字段）：Settlement ID / Booking Reference / Merchant / Hotel / Settlement Period / Payment Date / Invoice Status / Settlement Status
- Reconciliation Summary 表格（Expected vs Actual 对比，5 行）：Gross Revenue / Commission / Net Payout / Invoice Status / Payment Status，每行含 `RowIcon`（match=绿勾/mismatch=红告警/pending=橙圆点）与状态文案（Matched/Unmatched/Pending）
  - Actual 值为模拟偏差：非 settled 状态时 `actualGross = amount - (overdue ? amount*3% : 0)`，`actualComm = commission + (overdue ? commission*1% : 0)`
- Discrepancy Reasons 列表（若有不匹配项，黄色提示框，逐条列出差异原因文案）
- Investigation Notes：多行文本框（受控 `noteValue`），填写后出现"Save Note"按钮（仅 toast，不持久化）
- 底部操作：
  - 非 Matched 时显示「Mark as Reconciled」→ 打开 Reconcile Confirmation Dialog
  - Unmatched 时额外显示「Set to Under Review」（仅 toast）
  - 右侧「Download Report」（仅 toast）

**Reconcile Confirmation Dialog**（variant=confirm）
- 文案：`Mark settlement SET-{id} as reconciled? This will record the investigation notes and close the reconciliation review.`
- 确认后关闭 Reconcile Dialog 与 Settlement Detail Drawer，success toast

## 数据结构

共享实体（来自 `src/data/platformData.ts`，Bookings/Inventory 两模块通用）：

```typescript
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'checked_in'
export type RefundStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'processed'
export type SettlementStatus = 'settled' | 'pending' | 'processing' | 'overdue'

export interface Booking {
  id: string
  merchantId: string
  merchantName: string
  hotelName: string
  guestName: string
  guestPhone: string
  guestEmail: string
  checkIn: string
  checkOut: string
  nights: number
  roomType: string
  amount: number
  commission: number
  bookingStatus: BookingStatus
  refundStatus: RefundStatus
  refundAmount?: number
  settlementStatus: SettlementStatus
  channel: string
  createdAt: string
  promotionCode?: string
}
```

页面本地类型（`BookingAdminPage.tsx` 内定义，非共享）：

```typescript
type TimelineEventKind =
  | 'created' | 'confirmed' | 'checkin' | 'checkout' | 'cancelled'
  | 'refund_requested' | 'refund_approved' | 'refund_rejected' | 'refund_processed'
  | 'settlement_generated' | 'settlement_paid' | 'completed'

interface TimelineEvent {
  kind: TimelineEventKind
  label: string
  date: string
  actor: string
  note?: string
  exception?: boolean
}

type RowStatus = 'match' | 'mismatch' | 'pending'

interface ReconcRowData {
  label: string
  expected: string
  actual: string
  status: RowStatus
}
```

推导字段（非 mock 原生，前端计算得出，正式后端应作为持久化字段或视图计算列返回）：

| 字段名 | 类型 | 含义 | 推导规则 |
|---|---|---|---|
| invoiceStatus | 'Issued'\|'Pending'\|'Overdue' | 发票状态 | settled→Issued；overdue→Overdue；否则 Pending |
| reconciliationStatus | 'Matched'\|'Unmatched'\|'In Review' | 对账状态 | settled→Matched；processing→In Review；否则 Unmatched |
| refundReason | string | 退款原因 | cancelled→'Guest Cancellation'；no_show→'No Show — Policy Refund'；否则'Service Issue' |
| refundMethod | string | 退款方式 | 按行索引轮询 3 种方式（Original Payment / Bank Transfer / Platform Credit） |
| priority | 'High'\|'Medium'\|'Low' | 退款优先级 | amount≥3000→High，≥1000→Medium，否则 Low |
| netPayout | number | 净支付额 | `amount - commission` |
| paymentDate | string | 支付/打款日期 | `checkOut + 7天` |
| slaDeadline | string | SLA 截止日 | `createdAt + 5天` |

## 状态机 / 流转

**预订状态（bookingStatus）**：`confirmed → checked_in → completed`；或 `confirmed → cancelled`；或 `confirmed → no_show`。UI 未提供状态转换的操作入口（各状态均由 mock 静态生成，无人工推进按钮）。

**退款状态（refundStatus）**：
```
none → requested → approved → processed
              └──→ rejected（终态，不可逆，UI 文案标注"cannot be undone"）
```
- `requested`：进入 Refund Requests tab 队列，受 SLA 计时器约束（5 天窗口）
- `approved`：审批通过，等待处理，Timeline 记录 "Refund Approved" 事件
- `rejected`：驳回，Timeline 记录 exception 事件
- `processed`：终态，资金已退回原支付方式，Timeline 记录 "Refund Disbursed"

**结算状态（settlementStatus）**：
```
pending → processing → settled
   └────────────────→ overdue（异常分支，超时未打款触发升级）
```
- `pending` / `processing`：可在 All Bookings 触发「处理结算」，在 Settlements tab 触发「Mark as Paid」
- `settled`：终态，对账结果自动判定为 Matched
- `overdue`：Timeline 记录 "Settlement Overdue" 异常事件（升级触发，exception=true），对账结果为 Unmatched

**对账结果（Reconciliation，Settlement Detail Drawer 内计算）**：
```
Unmatched（settlementStatus in pending/overdue） → Under Review（点击"Set to Under Review"或 settlementStatus=processing）→ Matched（点击"Mark as Reconciled"或 settlementStatus=settled）
```

## 备注

以下能力目前仅为前端静态/推导展示，需后端提供真实数据与写接口支持：

1. **退款审批/驳回落库**：Approve/Reject Refund 目前仅 setTimeout 模拟 + toast，需要后端接口记录审批人、时间、理由，并驱动 `refundStatus` 真实流转。
2. **结算处理/标记已付**：Process Settlement、Mark as Paid 需要接入真实财务/打款系统，返回结算单号、打款流水号。
3. **对账明细计算**：当前 Expected vs Actual 的差异（3%/1% 偏移）是前端硬编码模拟；真实场景需要后端从支付网关、商户对账单等数据源计算实际到账金额与预期差异。
4. **投资调查备注（Investigation Notes）**：文本框内容仅前端状态，未持久化，需要后端存储备注历史（含操作人、时间）。
5. **发票状态**：目前由结算状态推导，真实场景应对接独立的发票/开票系统状态。
6. **完整审计时间线**：`buildTimeline()` 是前端按规则拼接的模拟事件序列，正式实现应改为后端返回真实操作日志（审计表）。
7. **搜索栏筛选下拉**（Booking/Refund/Settlement/Invoice Status 下拉）当前均为纯展示，未绑定任何过滤逻辑，需要补齐交互并对接后端筛选参数。
8. **Date Range / Export 按钮**：均无实际交互（Export 部分子操作有 toast 但无真实文件生成），需要后端导出接口（CSV/Excel/PDF）。
9. **SLA 计时**：固定 5 天窗口硬编码在前端，应改为可配置的平台规则（按退款类型/商户等级差异化）。
10. **"Today's Bookings"、"Avg Processing Time"、"SLA Breaches"** 等 KPI 为硬编码占位值，需要后端聚合统计接口。
11. **History 表格重复列**（Final Status/Refund Outcome/Settlement Outcome 与前三个状态列重复）应在正式设计稿中去重或替换为有意义的派生字段（如"结算最终结果"文案而非重复 Badge）。
