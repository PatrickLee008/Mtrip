# 数据结构设计(Data Structures)

> 汇总新 Super Admin Portal 的实体模型,并对齐现有双库(`mtrip_system` / `mtrip_business`)表。原则:**复用为主 + 针对性新增**;金额用最小货币单位 + 站点货币字段;时间序列由后端聚合。

## 一、设计稿共享接口(`src/data/platformData.ts` 原样,作为字段权威参考)

```typescript
type MerchantCategory = 'hotel' | 'resort' | 'boutique' | 'guesthouse' | 'serviced_apartment' | 'hostel'
type MerchantStatus   = 'active' | 'suspended' | 'inactive'
type VerifStatus      = 'approved' | 'pending' | 'rejected' | 'resubmission'
type CommissionPlan   = 'standard' | 'premium' | 'vip' | 'custom'
type BookingStatus    = 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'checked_in'
type RefundStatus     = 'none' | 'requested' | 'approved' | 'rejected' | 'processed'
type SettlementStatus = 'settled' | 'pending' | 'processing' | 'overdue'

interface Merchant { id; merchantName; businessName; ownerName; category; city; country; phone; email;
  stars; rooms; status; verificationStatus; commissionPlan; commissionRate; joinDate; lastLogin;
  monthlyRevenue; monthlyBookings; isVip; businessRegNo; bankName; bankAccount }

interface VerifApplication { applicationId; merchantId; merchantName; businessName; businessRegNo;
  ownerName; ownerIdNo; phone; email; city; category; submittedDate; status; reviewer; notes;
  documents: {name; type; status: 'verified'|'pending'|'rejected'}[];
  timeline: {date; action; by}[] }

interface Booking { id; merchantId; merchantName; hotelName; guestName; guestPhone; guestEmail;
  checkIn; checkOut; nights; roomType; amount; commission; bookingStatus; refundStatus; refundAmount?;
  settlementStatus; channel; createdAt; promotionCode? }

interface Campaign { id; name; type:'flash_sale'|'loyalty'|'seasonal'|'partnership'|'referral'|'long_stay_deal';
  status:'active'|'paused'|'ended'|'scheduled'|'draft'; startDate; endDate; budget; spent; goal;
  merchantCount; totalClaims; conversions; revenue; createdBy; linkedVouchers; linkedCodes;
  owner:'platform'|'merchant'; merchantOwner? }

interface Voucher { id; name; campaignId; voucherType:'fixed'|'percentage'|'free_night'|'upgrade';
  value; valueDisplay; status; startDate; endDate; quantity; claimed; redeemed; minSpend;
  perUserLimit; totalRedemptionLimit; merchantScope:'all'|'selected'; merchantCount; createdBy; createdAt }

interface PromoCode { id; code; name; campaignId; discountType:'percentage'|'fixed'|'free_night'|'cashback';
  discountValue; discountDisplay; status; startDate; endDate; usageLimit; usageCount; perUserLimit;
  minSpend; stackable; merchantScope; merchantCount; createdBy; createdAt }

interface Affiliate { id; name; handle; type:'influencer'|'blogger'|'kol'|'ota_partner'|'corporate';
  platform; followers; status:'active'|'pending'|'suspended'|'rejected'; commissionRate; totalEarnings;
  withdrawable; totalReferrals; conversions; joinDate; lastActivity; fraudScore }

interface Promotion { /* 商户级促销 */ }         // 见 05-campaign 文档
interface WelcomeReward { /* 新客欢迎奖励 */ }    // 见 05-campaign 文档
interface AffiliateCode { /* 联盟折扣码 */ }       // 见 06-affiliate 文档
```

## 二、实体 → 现有表映射(复用)

| 新实体 | 现有表 | 备注 |
|---|---|---|
| Merchant | `merchant_info`(+`merchant_account`/`merchant_admin`/`merchant_group`/`merchant_store`) | status 已含审核态;缺 resubmission/blacklist |
| Booking | `order_main` / `order_refund` / `order_verify_log` | 字段基本齐 |
| 结算 | `finance_merchant_settle` / `finance_flow` / `finance_withdraw` / `finance_account_entry` | 对账/发票为派生,需补 |
| Campaign/Coupon | `marketing_campaign` / `marketing_coupon(_receive)` / `marketing_activity` / `marketing_points_rule` | 缺 voucher/promo_code/welcome 独立实体 |
| Banner/Theme | `marketing_banner` / `app_theme` | 已有 |
| 库存 | `goods_daily_stock` / `hotel_room_type` / `goods_stock_log` | 日历/告警为视图/新增 |
| End User | `user_info` / `user_member_level` / `user_balance_log` / `user_points_log` / `user_favorite` / `user_traveler` / `user_feedback` / `user_action_log` | 360 聚合源 |
| 消费者返利 | `user_referral`(+`user_info.referral_code`) | Refer & Earn |
| 用户风控/申诉 | `user_fraud` / `user_appeal` | 平台规则(用户侧) |
| 对话/客服 | `chat_conversation` / `chat_message` | 对话中心源 |
| 通知 | `notify_record` | 通知中心源 |
| 管理员/角色/菜单/会话 | `sys_admin` / `sys_role` / `sys_menu` / `sys_role_menu` / `sys_admin_login_log` | 权限矩阵/活跃会话源 |
| 平台配置 | `sys_config` / `sys_site(_config)` / `sys_storage` / `sys_pay_channel` / `sys_sms_channel` / `sys_map_config` / `sys_client` / `finance_tax_config` / `verify_rule` | 17 配置卡聚合 |

## 三、需新增的表(按阶段)

**Phase 1 — 商户验证**
- `merchant_verify_document`:`merchant_id`、`doc_type`、`name`、`file_url`、`status`(verified/pending/rejected)、`remark`、`uploaded_at`。
- `merchant_verify_timeline`:`merchant_id`、`action`、`operator_id`、`note`、`created_at`。
- `merchant_blacklist`:`merchant_id`、`reason`、`operator_id`、`created_at`(或 `merchant_info.status` 增值)。
- `merchant_activity_log`:`merchant_id`、`activity_type`、`detail`、`created_at`。
- `merchant_info.status` 增补 `6=待重新提交`(对齐 VerifStatus.resubmission)。

**Phase 2 — Affiliate 达人(B2B,独立于消费者 Referral)**
- `affiliate_partner`:name、handle、type(kol/blogger/influencer/ota_partner/corporate)、platform、followers、status、commission_rate、fraud_score、total_earnings、withdrawable、join_date、last_activity。
- `affiliate_application`:联系信息、渠道、受众、材料、status(pending/approved/rejected)、reviewer。
- `affiliate_program`:计划配置(默认费率、佣金梯度、cookie 窗口、结算规则)。
- `affiliate_code`:code、partner_id、discount_type/value、min_spend、usage_limit/count、per_user_limit、merchant_scope、status、有效期。
- `affiliate_commission_log`:partner_id、order_id、amount、status(pending/settled/void)。
- `affiliate_withdraw`:partner_id、amount、status、打款流水(复用 `finance_withdraw` 模式)。
- `affiliate_fraud_flag`:partner_id、rule、score、status、处置。

**Phase 3 — End User 360**
- `user_blacklist`:`user_id`、`reason`、`operator_id`、`created_at`(或 `user_info.status` 扩展)。
- 其余(交易/奖励/支持/对话)均为对现有表的**聚合查询**,无新实体。

**后续阶段**
- 帮助中心:`help_category`、`help_article`、`help_announcement`、`help_search_log`。
- 促销扩展:`marketing_voucher`、`marketing_promo_code`、`marketing_welcome_reward`、`marketing_promotion`(商户级),或扩展 `marketing_coupon.type`。
- 库存:`inventory_alert`(low_stock/overbooking/blackout 告警)。
- 平台规则(商户侧):`platform_rule`、`merchant_violation`、`merchant_warning`、`compliance_history`。

## 四、约束

- 双库分工:平台/系统配置类进 `mtrip_system`;业务实体(商户/订单/营销/用户/达人)进 `mtrip_business`。
- 站点隔离:所有业务表带 `site_id`;`site_id=0` 超管全平台。
- 软删除:业务表带 `deleted_at`。
- 新 SQL 遵循 `database/<域>/NN-*.sql` 命名,经 `scripts/db-apply.ps1` 增量执行,并登记进 `deploy` compose 的 initdb 挂载。
