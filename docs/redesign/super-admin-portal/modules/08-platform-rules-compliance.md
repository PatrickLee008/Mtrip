# 平台规则与合规（Platform Rules & Compliance）

## 概述

平台超管定义**面向商户的平台规则**并执行合规治理:规则库(发布/下线/归档)、商户违规工单、警告历史(分级/升级/吊销)、合规审计历史(评分/复核)。对应现有 `cops/fraud`(用户侧风控)在**商户侧**的对应物。位于 Platform Rules & Compliance 组。

来源文件:`UI设计/Super Admin Portal/src/pages/PlatformRulesPage.tsx`(~47KB,4 套页面本地 mock)。按 `tab` 顶部 4 个内嵌 Tab 切换。

PageId 列表:
- `platform-rules` — Platform Rules(规则库)
- `merchant-violations` — Merchant Violations(违规工单)· badge 4
- `warning-history` — Warning History(警告历史)
- `compliance-history` — Compliance History(合规审计历史)

## 子页面 / Tabs

| PageId | 标题 | 图标 |
|---|---|---|
| `platform-rules` | Platform Rules | FileText |
| `merchant-violations` | Merchant Violations | ShieldAlert |
| `warning-history` | Warning History | AlertTriangle |
| `compliance-history` | Compliance History | History |

## 功能清单

### Platform Rules（规则库）
- KPI 4:Total Rules(8)/ Active Rules(6)/ Draft Rules(2)/ Open Violations(4)。
- 表格列:规则(id+title)、Category(Booking/Listing/Operations/Pricing/Reviews/Finance/Compliance/Marketing)、Status(active/draft)、Severity(critical/high/medium/low)、Applies(适用范围:All Merchants / Hotel,Resort / Affiliates)、Created、Last Updated、Actions。
- 行操作(MoreMenu):View / Edit Rule / Duplicate Rule / Publish 或 Unpublish / Archive Rule / Delete Rule。
- 新建规则。

### Merchant Violations（违规工单）
- KPI 4:Total Violations / Open / Resolved / Critical Severity。
- 表格列:违规(id)、Merchant(名+MCH-id)、Rule(触发规则)、Severity、Status(open/resolved)、Date、Action(处置动作文案)、Assigned To(处理人/Compliance Team)。
- 行操作:Assign/Reassign、Issue Warning、Suspend Merchant、Mark as Resolved / View Resolution / Reopen Case。

### Warning History（警告历史）
- 表格列:警告(id)、Merchant、Reason、Level(1st/2nd/3rd Warning)、Date、Issued By、Expires(有效期)。
- 行操作:View Warning Details、Extend Expiry(+30d)、Escalate Warning(升级到下一级)、Revoke Warning(吊销)。
- 顶部菜单:Issue Warning、Warning Templates(可复用模板)、Warning Settings(阈值与升级配置)。

### Compliance History（合规审计历史）
- 表格列:记录(id)、Merchant、Event(年度复核/文档续期/违规调查关闭/价格一致性审计/文档续期逾期)、Result(Pass/Warning/Fail)、Score(0-100)、Date、Reviewer。
- 行操作:Export Record、View Related Merchant、Reopen Investigation。

## 数据结构

```typescript
// 规则
interface Rule { id; title; category; status: 'active'|'draft'; severity: 'critical'|'high'|'medium'|'low'
  created; lastUpdated; applies: string }

// 违规
interface Violation { id; merchant; merchantId; rule; severity; status: 'open'|'resolved'
  date; action: string; assignedTo: string }

// 警告
interface Warning { id; merchant; merchantId; reason; level: '1st Warning'|'2nd Warning'|'3rd Warning'
  date; issuedBy; expires }

// 合规审计
interface ComplianceRecord { id; merchant; merchantId; event; result: 'Pass'|'Warning'|'Fail'
  score: number; date; reviewer }

// 处置动作机
type RuleDialog = { type: 'publish'|'unpublish'|'archive'|'delete'; id; title }
type ViolationDialog = { type: 'suspend'|'warn'|'resolve'|'reopen'; id; merchant }
type WarningDialog = { type: 'revoke'|'escalate'; id; merchant; level }
type ComplianceDialog = { type: 'reopen'; id; merchant }
```

### 推断实体（后端建模,见 data-structures.md）
`platform_rule`(规则库 + category/severity/applies/status)、`merchant_violation`(违规工单 + 处理人 + 处置动作)、`merchant_warning`(警告 + level/expires/issuedBy)、`compliance_history`(审计 + result/score/reviewer)。警告模板 `warning_template`、警告阈值配置。

## 状态机 / 流转

- **规则**:`draft → (Publish) → active → (Unpublish) → draft`;`→ archive`(归档保留审计);`→ delete`。发布即对匹配商户生效。
- **违规**:`open →(Mark Resolved)→ resolved →(Reopen)→ open`;可 Issue Warning / Suspend Merchant。
- **警告**:`1st → (Escalate) → 2nd → 3rd`;可 Revoke(移出合规记录)/ Extend Expiry;逾期自动失效。三级警告可联动暂停(对应 PRD 商户侧治理)。
- **合规审计**:`Pass / Warning / Fail`(带评分);Fail 可 Reopen Investigation。

## 备注（后端缺口）

1. 全新模块:需 `platform_rule`/`merchant_violation`/`merchant_warning`/`compliance_history` 四表 + 规则引擎(按 category/severity/applies 匹配商户并执行)。
2. **警告分级 → 升级 → 暂停** 是商户侧治理闭环,需与商户管理(暂停/拉黑)、通知(邮件通知商户)联动。
3. 违规工单需指派/处理人、SLA、与商户档案关联;可复用审计/操作日志基础设施。
4. 合规评分(score)口径与年度复核流程需后端定义;规则/警告模板与阈值需平台可配。
5. 与用户侧风控(`user_fraud`/`user_appeal`、cops/fraud)是不同主体(商户 vs C 端用户),但可共用「规则-违规-处置-申诉」范式。
