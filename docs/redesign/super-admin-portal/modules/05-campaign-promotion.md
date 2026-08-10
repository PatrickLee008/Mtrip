# 促销与活动（Campaign & Promotion）

## 概述

平台超管的**促销运营中枢**:平台/商户活动、商户直营促销、券、促销码、新客欢迎奖励、活动分析。含长住优惠(long-stay deal)创建。对应现有 `marketing/coupon·activity·banner·points` + `cops/campaign`/`cops/longstay` 的整合升级。位于 Campaign & Promotion 组。

来源文件:`UI设计/Super Admin Portal/src/pages/CampaignPage.tsx`(~187KB)。按 `tab` 路由到 6 个子视图。

PageId 列表:
- `campaigns` — Campaigns(活动)
- `campaigns-promotions` — Promotions(商户促销)
- `campaigns-vouchers` — Vouchers(代金券)
- `campaigns-codes` — Promotion Codes(促销码)
- `campaigns-welcome` — Welcome Rewards(新客奖励)
- `campaigns-analytics` — Campaign Analytics(活动分析)

## 子页面 / Tabs

| PageId | 标题 | 副标题 |
|---|---|---|
| `campaigns` | Campaigns | 平台 + 商户活动 |
| `campaigns-promotions` | Promotions | 商户自营酒店直销促销 |
| `campaigns-vouchers` | Vouchers | 全平台代金券发放 |
| `campaigns-codes` | Promotion Codes | 促销码生成与追踪 |
| `campaigns-welcome` | Welcome Rewards | 新客/首单激励 |
| `campaigns-analytics` | Campaign Analytics | 跨渠道活动绩效 |

## 功能清单

### Campaigns（活动）
- 活动预算总览(CAMP_BUDGET_TOTAL/ALLOCATED)。
- 表格列(Campaign):name、type(flash_sale/loyalty/seasonal/partnership/referral/long_stay_deal)、status、start/end、budget/spent、merchantCount、totalClaims、conversions、revenue、owner(platform/merchant)、linkedVouchers/linkedCodes。
- 创建向导:含服务类型(SERVICE_OPTIONS)、按类型不同表单;**long_stay_deal 用 LsForm**(最短/最长晚数、折扣梯度 tiers[minNights→discount]、酒店范围 all/selected、出资方 funding platform/merchant/shared、券兼容 couponCompat stacking/only/best、展示 badge/banner、预算)。

### Promotions（商户促销）
- 表格列(Promotion):name、merchant、promotionType(percentage/fixed/package/free_night/early_bird)、discountDisplay、status、start/end、minNights、bookings、revenue。

### Vouchers（代金券）
- 表格列(Voucher):name、campaignId、voucherType(fixed/percentage/free_night/upgrade)、value、status、start/end、quantity、claimed、redeemed、minSpend、perUserLimit、totalRedemptionLimit、merchantScope(all/selected)。
- 创建表单:逐字段(类型/面额/数量/最低消费/每人限领/总核销上限/商户范围/有效期)。

### Promotion Codes（促销码）
- 表格列(PromoCode):code、name、campaignId、discountType(percentage/fixed/free_night/cashback)、discountValue、status、start/end、usageLimit/usageCount、perUserLimit、minSpend、stackable、merchantScope。
- 创建表单 + 码生成。

### Welcome Rewards（新客奖励）
- 表格列(WelcomeReward):name、rewardType(new_user/first_booking/registration)、discountType(percentage/fixed/free_night/cashback)、discountDisplay、status(active/paused/draft)、validityDays、usageLimit/usageCount、minSpend、newUsersConverted、revenue。

### Campaign Analytics（活动分析）
- 跨渠道绩效:采纳率、券发放/核销、转化、ROI、预算利用率等图表。

## 数据结构

### 共享自 `platformData.ts`
```typescript
interface Campaign { id; name; type: 'flash_sale'|'loyalty'|'seasonal'|'partnership'|'referral'|'long_stay_deal'
  status: 'active'|'paused'|'ended'|'scheduled'|'draft'; startDate; endDate; budget; spent; goal
  merchantCount; totalClaims; conversions; revenue; createdBy; linkedVouchers; linkedCodes
  owner: 'platform'|'merchant'; merchantOwner? }

interface Voucher { id; name; campaignId: string|null; voucherType: 'fixed'|'percentage'|'free_night'|'upgrade'
  value; valueDisplay; status; startDate; endDate; quantity; claimed; redeemed; minSpend
  perUserLimit; totalRedemptionLimit; merchantScope: 'all'|'selected'; merchantCount; createdBy; createdAt }

interface PromoCode { id; code; name; campaignId: string|null; discountType: 'percentage'|'fixed'|'free_night'|'cashback'
  discountValue; discountDisplay; status; startDate; endDate; usageLimit; usageCount; perUserLimit
  minSpend; stackable: boolean; merchantScope; merchantCount; createdBy; createdAt }

interface Promotion { id; name; merchantId; merchantName; promotionType: 'percentage'|'fixed'|'package'|'free_night'|'early_bird'
  discountValue; discountDisplay; status; startDate; endDate; minNights; bookings; revenue; createdAt }

interface WelcomeReward { id; name; rewardType: 'new_user'|'first_booking'|'registration'
  discountType: 'percentage'|'fixed'|'free_night'|'cashback'; discountValue; discountDisplay
  status: 'active'|'paused'|'draft'; validityDays; usageLimit; usageCount; minSpend; newUsersConverted; revenue; createdAt }
```

### 页面本地（长住优惠）
```typescript
interface LsDiscountTier { id; minNights; discount }
interface LsForm { minNights; maxNights; tiers: LsDiscountTier[]; hotelScope: 'all'|'selected'
  hotelSearch; selectedHotels: string[]; funding: 'platform'|'merchant'|'shared'
  couponCompat: 'stacking'|'only'|'best'; enabled; priority; displayBadge; displayBanner; budget }
```

### 实体 → 现有映射
Campaign→`marketing_campaign`(已有,扩展 type/owner/budget/linked*);Voucher/PromoCode→新 `marketing_voucher`/`marketing_promo_code`(或扩展 `marketing_coupon.type`);Promotion→商户级促销(新表或 `marketing_activity` 扩展);WelcomeReward→新 `marketing_welcome_reward`;长住→`marketing_longstay_tier`(已有,扩展出资/券兼容/展示)。

## 状态机 / 流转

- 活动/券/码/促销:`draft → scheduled → active ⇄ paused → ended/expired`。
- 券:发放(claimed)→ 核销(redeemed),受 quantity/perUserLimit/totalRedemptionLimit 约束。
- 长住:enabled 开关 + 折扣梯度按晚数生效 + 出资方分账。

## 备注（后端缺口）

1. 设计稿把促销拆成 5 类独立实体(Campaign/Promotion/Voucher/PromoCode/WelcomeReward),现有仅 `marketing_coupon`/`marketing_activity`/`marketing_campaign`——需新增 voucher/promo_code/welcome_reward 表或扩展 coupon 的类型枚举 + 发放/核销规则(minSpend/perUserLimit/totalRedemptionLimit/stackable/merchantScope)。
2. **长住优惠**(long_stay_deal)对应 PRD 模块「长住」:折扣梯度(按晚数)、出资方(platform/merchant/shared)、券兼容策略(stacking/only/best)、展示 badge/banner——复用 `marketing_longstay_tier` 并扩展。
3. 平台 vs 商户活动(owner)需区分权限与预算归属;活动预算池(总/已分配)需财务联动。
4. Campaign Analytics 与 Dashboard 活动运营总览、Reports 活动报表口径重叠,建议同一聚合来源。
5. 金额混用 MMK/¥,落地统一站点货币。
