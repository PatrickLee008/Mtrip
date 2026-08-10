# 带货达人与联盟（Affiliate & Influencer）

## 概述

平台超管对**B2B 带货渠道**(网红/博主/KOL/OTA 合作方/企业客户)的全流程管理:入驻申请审核、合作方名录、联盟计划(佣金规则+奖励规则)配置、奖励钱包与提现、反欺诈与合规、联盟折扣码。**这是新设计中最全新的一块**,现有后台只有 C 端消费者返利(`user_referral`),没有 B2B 达人体系。

来源文件:`UI设计/Super Admin Portal/src/pages/AffiliatePage.tsx`(~168KB;数据 `affiliates`/`affiliateCodes` 共享 + 页面内 6 套 mock)。主组件按 `tab` 路由到 6 个子页面组件。

PageId 列表:
- `affiliates` — Affiliate Applications(申请审核)· badge 3
- `affiliates-partner` — Partner Directory(合作方名录)
- `affiliates-program` — Affiliate Program(计划配置)
- `affiliates-withdrawals` — Reward Wallet(奖励钱包/提现)
- `affiliates-fraud` — Fraud & Compliance(反欺诈)· badge 2
- `affiliates-codes` — Affiliate Codes(联盟折扣码)
- (`affiliates-referral` → 单独的 ReferralCampaignsPage,见 06b)

## 子页面 / Tabs

| PageId | 标题 | 用途 |
|---|---|---|
| `affiliates` | Affiliate Applications | 待审达人申请,通过/驳回 |
| `affiliates-partner` | Partner Directory | 已合作达人/机构名录 |
| `affiliates-program` | Affiliate Program | 佣金规则 + 奖励规则 + 全局参数配置 |
| `affiliates-withdrawals` | Reward Wallet | 奖励钱包流水与提现/核销 |
| `affiliates-fraud` | Fraud & Compliance | 欺诈案件调查 + 反欺诈规则开关 |
| `affiliates-codes` | Affiliate Codes | 联盟折扣码 CRUD + 推广链接 |

## 功能清单

### 1. Affiliate Applications（申请审核）
- KPI:待审/本月通过/拒绝 等。
- 筛选:关键词 + 类型(influencer/blogger/kol/ota_partner/corporate)+ 风险等级。
- 表格列:达人(名+handle)、类型(TypeBadge)、平台/粉丝数、佣金率、fraudScore(FraudBar,≥60 红/≥25 橙/其余绿)、状态、加入日、Actions(查看/通过/驳回)。
- 详情抽屉:达人资料;通过弹窗 / 驳回弹窗。

### 2. Partner Directory（合作方名录）
- 按 `PartnerType` 三分:influencer / business_affiliate / user_referral(与 C 端返利打通展示)。
- 表格列:name+handle、partnerType(带 meta 色)、affiliateType、followers、bookings、revenue、commissionRate、status、country、joinDate。

### 3. Affiliate Program（计划配置）—— 平台可配置引擎
- **Commission Rules(佣金规则)表**:name、affiliateType、rate(%)、minBookingValue、enabled;可增删改。默认 6 条(Influencer 8%/KOL 10%/OTA 5%/Corporate 4%/Blogger 6%/User Referral 3%)。
- **Reward Rules(奖励规则)表**:trigger(registration/completed_payment/completed_stay)、target(referrer/referee/both)、rewardType(credits/cashback)、rewardValue、enabled。默认 3 条。
- 全局参数:referralExpiry(推荐有效期天数,默认 30)、minBooking(最低起订额,默认 200)等。

### 4. Reward Wallet（奖励钱包/提现）
- KPI:总余额/待发/已发/已核销。
- 表格/流水列:交易号、用户(名+handle+referralCode)、当前余额、来源(rewardSource)、campaign、交易类型(txType)、奖励类型(rewardType)、金额+单位(pts / MMK credits)、balanceBefore/After、状态、时间、到期日、关联订单/推荐。
- 详情抽屉:交易时间线(Reward Earned→Credited→Redeemed)、关联订单/推荐、核销备注;人工调整(Manual Credit/Deduction)。

### 5. Fraud & Compliance（反欺诈）
- **Fraud Cases(欺诈案件)表**:案件号、达人(名+handle)、类型、fraudScore、riskLevel(high/medium/low)、可疑行为(suspiciousActivity)、证据摘要、调查状态(investigating/under_review/resolved/dismissed)、reviewer、检测日、达人状态。
- 处置:暂停/恢复达人、标记 resolved/dismissed。
- **Fraud Rules(反欺诈规则)开关表**:name、description、action(allow/flag/block)、enabled。默认 8 条(同 IP 推荐/同设备指纹/自我推荐/重复手机邮箱/单设备最多账号/单日最多推荐/奖励冻结期/VPN 代理检测)。

### 6. Affiliate Codes（联盟折扣码）
- KPI:活跃码/总用量/带来 GMV/佣金 等。
- 表格列:code(可复制)、达人(名+handle)、promotionType(percentage/fixed/free_night/cashback)、折扣值(discountDisplay)、推广链接(可复制/打开)、状态(active/paused/expired/draft)、有效期、usageCount/usageLimit、perUserLimit、eligibleMerchants(all/selected + merchantCount)、bookings/conversions/revenue/commission、lastUsed。
- **创建/编辑表单**(`CodeFormState`):code(可自动生成,前缀=达人名首字母)、affiliateId(下拉全部达人)、promotionType、discountValue、startDate/endDate、usageLimit、perUserLimit、eligibleMerchants、merchantCount、status;含推广链接复制。

## 数据结构

### 共享自 `platformData.ts`

```typescript
interface Affiliate {
  id; name; handle; type: 'influencer'|'blogger'|'kol'|'ota_partner'|'corporate'
  platform; followers; status: 'active'|'pending'|'suspended'|'rejected'
  commissionRate; totalEarnings; withdrawable; totalReferrals; conversions
  joinDate; lastActivity; fraudScore
}

interface AffiliateCode {
  id; code; affiliateId; affiliateName; affiliateHandle; affiliateType
  promotionType: 'percentage'|'fixed'|'free_night'|'cashback'
  discountValue; discountDisplay; referralLink
  status: 'active'|'paused'|'expired'|'draft'
  startDate; endDate; usageLimit; usageCount; perUserLimit
  eligibleMerchants: 'all'|'selected'; merchantCount
  bookings; conversions; revenue; commission; commissionRate
  lastUsed?; createdBy; createdAt
}
```

### 页面本地类型（后端需据此建表）

```typescript
// 奖励钱包
type WalletRewardSource = 'Referral Campaign'|'Referral Bonus'|'Booking Reward'|'Promotional Campaign'|'Manual Adjustment'|'System Reward'
type WalletTxType   = 'Reward Earned'|'Reward Redeemed'|'Reward Expired'|'Manual Credit'|'Manual Deduction'|'Adjustment'
type WalletRewardType = 'Travel Credits'|'Reward Points'|'Coupon'|'Voucher'
type WalletStatus     = 'Pending'|'Credited'|'Redeemed'|'Expired'|'Cancelled'
interface WalletTransaction { id; userId; userName; userHandle; referralCode; currentBalance
  rewardSource; campaign; transactionType; rewardType; amount; unit:'pts'|'MMK credits'
  balanceBefore; balanceAfter; status; timestamp; expiryDate?; associatedBookingId?
  associatedReferral?; redemptionNote?; timeline:{label;time;done}[] }

// 反欺诈
type FraudInvestigationStatus = 'investigating'|'under_review'|'resolved'|'dismissed'
type FraudRiskLevel = 'high'|'medium'|'low'
interface FraudCase { id; affiliateId; affiliateName; handle; type; fraudScore; riskLevel
  suspiciousActivity; evidenceSummary; investigationStatus; reviewer; detectionDate; affiliateStatus }
type FraudRuleAction = 'allow'|'flag'|'block'
interface FraudRule { id; name; description; action; enabled }

// 计划配置
type TriggerType = 'registration'|'completed_payment'|'completed_stay'
type RewardTarget = 'referrer'|'referee'|'both'
interface CommissionRule { id; name; affiliateType; rate; minBookingValue; enabled }
interface RewardRule { id; trigger; target; rewardType; rewardValue; enabled }

// 名录 / 建码表单
type PartnerType = 'influencer'|'business_affiliate'|'user_referral'
interface PartnerRecord { id; name; handle; partnerType; affiliateType; followers; bookings
  revenue; commissionRate; status; joinDate; country }
interface CodeFormState { code; affiliateId; promotionType; discountValue; startDate; endDate
  usageLimit; perUserLimit; eligibleMerchants; merchantCount; status }
```

### 推断实体（后端建模,见 data-structures.md Phase 2）
`affiliate_partner` / `affiliate_application` / `affiliate_program`(佣金规则+奖励规则+全局参数)/ `affiliate_code` / `affiliate_commission_log` / `affiliate_withdraw`(钱包流水/提现)/ `affiliate_fraud_flag`(案件)+ `affiliate_fraud_rule`(规则开关)。

## 状态机 / 流转

- **达人申请**:`pending → active`(通过)/`→ rejected`(驳回);`active ⇄ suspended`(欺诈/违规)。
- **奖励钱包**:`Pending → Credited → Redeemed`;或 `→ Expired`/`Cancelled`;人工 `Manual Credit/Deduction`。奖励冻结期(stay 完成后 7 天)后才可提现(反欺诈规则 reward_hold)。
- **欺诈案件**:`investigating → under_review → resolved/dismissed`;resolved 可联动暂停达人。
- **联盟码**:`draft → active ⇄ paused → expired`。

## 备注（后端缺口）

1. **Affiliate(B2B 达人)≠ Referral(C 端返利)**:达人是签约带货渠道(有粉丝/佣金率/联盟码/提现钱包/反欺诈),C 端返利是 `user_referral`(普通用户拉新)。Partner Directory 里 `user_referral` 类型是把 C 端返利者也纳入统一名录展示,但二者数据模型独立。
2. 计划引擎(佣金规则/奖励规则/触发条件/目标)需做成平台可配置表,驱动真实结算。
3. 奖励钱包需独立账本(pts 与 MMK credits 双单位)、冻结期、到期、人工调整审计;提现接财务打款(可复用 `finance_withdraw` 模式)。
4. 反欺诈:fraudScore/riskLevel 需真实风控引擎产出(同 IP/设备指纹/自我推荐/VPN 等规则),规则开关平台可配。
5. 联盟码:推广链接生成、用量/核销归因、按商户范围(all/selected)、佣金结算,需要打通订单归因。
6. 金额展示混用 ¥/MMK credits,落地统一站点货币 + 积分单位。
