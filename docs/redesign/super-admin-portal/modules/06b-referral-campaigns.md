# 推荐返利活动（Referral Campaigns / Refer & Earn）

## 概述

平台超管配置 **C 端用户「推荐赚取」(Refer & Earn)活动**:一个用户邀请好友注册/首单/完成入住,达成条件后奖励入推荐人钱包。对应 Consumer App PRD 模块 14。位于 Affiliate 组下的 `affiliates-referral`(单独页面,与 B2B Affiliate 分离)。核心是一个**多步活动创建向导**(Wizard)+ 活动列表 + 复杂的奖励规则与反欺诈参数(可继承全局默认、按活动覆盖)。

来源文件:`UI设计/Super Admin Portal/src/pages/ReferralCampaignsPage.tsx`(~81KB,纯页面本地 mock `INIT_CAMPAIGNS`)。

PageId:`affiliates-referral`(侧栏 badge 3)。

## 子页面 / Tabs

单页面,非多 Tab。结构:活动列表(卡片/表格,PER_PAGE=8)+ 创建/编辑向导(WIZARD_STEPS 多步)。

## 功能清单

### 活动列表
- 每活动:名称、描述、类型(CampaignType)、起止、状态、优先级(priority)、参与人数(participants)、已发奖励(totalRewardsDistributed)、奖励池/预算。
- 行操作:查看/编辑/复制/启用(Play)/暂停(Pause)/结束(StopCircle)/删除。

### 创建/编辑向导（WizardForm，多步 WIZARD_STEPS）
- **基础信息**:name、description、type(Invite Friends/Referral Rewards/First Booking Bonus/Seasonal Referral Campaign)、bannerUrl、起止日期+时间、status。
- **奖励设置**:totalRewardPool、rewardBudget、estimatedParticipants、estimatedReferralBookings;**奖励规则(RewardRule[])**:每条含 ruleType(Invite Count/Successful Registration/First Booking/Completed Stay/Booking Amount)、threshold(阈值)、rewardType(Travel Credits/Reward Points/Voucher/Coupon)、rewardValue、maxClaims、description。
- **资格条件**:minBookingAmount、minStayRequirement、bookingCompletionRequired、referralLinkExpiry、maxInvitationsPerUser、maxRewardsPerUser、eligibleHotelCategories(Budget/Standard/Deluxe/5-Star/Boutique/Resort)、eligibleCountries。
- **反欺诈参数**(可继承全局默认 `GLOBAL_REFERRAL_DEFAULTS`,按活动 overrides 覆盖):referralAttributionWindow(归因窗口)、rewardHoldPeriod(奖励冻结期)、maxDeviceRegistrations、maxIpRegistrations、duplicateDeviceDetection、selfReferralDetection、multipleAccountDetection、fakeBookingDetection。
- 每个可覆盖项有「继承全局 / 本活动覆盖」开关(`Overrides`)。

## 数据结构

```typescript
type CampaignType = 'Invite Friends'|'Referral Rewards'|'First Booking Bonus'|'Seasonal Referral Campaign'
type CampaignStatus = 'active'|'scheduled'|'draft'|'paused'|'ended'
type RuleType = 'Invite Count'|'Successful Registration'|'First Booking'|'Completed Stay'|'Booking Amount'
type RewardType = 'Travel Credits'|'Reward Points'|'Voucher'|'Coupon'

interface RewardRule { id; ruleType: RuleType; threshold; rewardType: RewardType; rewardValue; maxClaims; description }

// 全局默认(镜像 AffiliateProgramPage 设置)
const GLOBAL_REFERRAL_DEFAULTS = { minBookingAmount:200, referralAttributionWindow:14, referralLinkExpiry:30,
  bookingCompletionRequired:true, rewardHoldPeriod:7, maxInvitationsPerUser:10, maxRewardsPerUser:5,
  maxDeviceRegistrations:3, maxIpRegistrations:5, duplicateDeviceDetection:true, selfReferralDetection:true, fakeBookingDetection:true }
type Overrides = Record<keyof typeof GLOBAL_REFERRAL_DEFAULTS, boolean>

interface ReferralCampaign {
  id; name; description; type; startDate; endDate; status; createdBy; priority
  participants; totalRewardsDistributed; totalRewardPool; rewardBudget
  estimatedParticipants; estimatedReferralBookings; rewardRules: RewardRule[]
  minBookingAmount; minStayRequirement; bookingCompletionRequired; referralLinkExpiry
  maxInvitationsPerUser; maxRewardsPerUser; eligibleHotelCategories: string[]; eligibleCountries: string[]
  referralAttributionWindow; rewardHoldPeriod; maxDeviceRegistrations; maxIpRegistrations
  duplicateDeviceDetection; selfReferralDetection; multipleAccountDetection; fakeBookingDetection
  overrides: Overrides
}
```

### 推断实体（后端建模）
- `referral_campaign`(活动主体 + 资格/反欺诈参数 + overrides JSON)。
- `referral_reward_rule`(活动下的奖励规则,一活动多条)。
- 复用现有 `user_referral`(绑定与奖励发放)、`user_info.referral_code`;奖励入 `user_balance_log`/`user_points_log`。

## 状态机 / 流转

- 活动:`draft → scheduled → active ⇄ paused → ended`。
- 单次推荐(user_referral):`绑定(bind) → 待达成 → 达成条件(注册/首单/完成入住)→ 冻结期(rewardHoldPeriod)→ 奖励发放`;或失效。

## 备注（后端缺口）

1. **Referral(C 端返利)≠ Affiliate(B2B 达人)**:本模块管理普通用户拉新活动,数据落 `user_referral` + 新的 `referral_campaign`/`referral_reward_rule`;与 06 Affiliate 的达人钱包/联盟码是两套体系。
2. 奖励规则引擎(触发类型 × 阈值 × 奖励类型 × maxClaims)需后端可配置并驱动真实发放。
3. 反欺诈参数需与全局默认联动 + 按活动覆盖(overrides);归因窗口/冻结期/设备IP限制需真实风控执行。
4. 资格条件(最低金额/最短入住/酒店品类/国家)需接订单校验。
5. 全局默认 `GLOBAL_REFERRAL_DEFAULTS` 与 AffiliateProgramPage 的全局设置是同源,建议后端统一一处配置。
6. 金额单位 MMK,落地走站点货币配置。
