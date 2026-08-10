# 终端用户管理（End User Management / Customer 360）

## 概述

平台超管对 **C 端消费者**的统一管理:用户名录 + 「Customer 360°」单用户全景(资料/会员/钱包积分/优惠券/预订/活动/交易/奖励/客服/通知/对话)+ 平台级对话中心 + 封禁/黑名单。位于 End User Management 组。**采用「选中用户 → 解锁其 360 详情页组」的上下文模式**:在 User Directory 选中一个用户后,侧栏出现该用户上下文卡,其余详情 Tab 才可用(`onEndUserChange` 回传给 App,侧栏渲染)。

来源文件:`UI设计/Super Admin Portal/src/pages/EndUserPage.tsx`(~309KB,页面本地 mock `USERS` 等)。主组件按 `tab` 路由到 11+ 个子页面组件。

PageId 列表(侧栏顺序):
- `endusers` — User Directory(用户名录,入口)
- `conversations-center` — Conversation Center(平台对话中心)· badge 3 紫
- 「Customer 360°」详情组(需先选中用户):`endusers-profile`(User Profile)/ `endusers-bookings`(Booking History)/ `endusers-activities`(User Activities)/ `endusers-transactions`(User Transactions)/ `endusers-rewards`(Rewards & Coupons)/ `endusers-support`(User Support)/ `endusers-notifications`(通知历史)/ `endusers-conversations`(Guest Conversations)
- `endusers-suspended` — Suspended Users · badge 2 橙
- `endusers-blacklist` — Blacklist · badge 1 红

## 功能清单

### User Directory（用户名录，入口）
- KPI:总用户/活跃/暂停/黑名单 等;新建用户抽屉(firstName/lastName/email/phone/country/status/tier/sendWelcome)。
- 表格列:用户(头像+名+id)、email/phone、country、tier(MemberTier)、totalBookings、totalSpending、points、status、registeredAt、lastLogin、Actions(查看→进入 360 Profile)。
- 选中用户 → `onViewProfile` → 跳 `endusers-profile`,并把 {name,avatar,tier} 回传侧栏上下文。

### User Profile（360 资料页）
- 用户头卡 + 会员进度:tier + 距下一级差额(`TIER_THRESHOLDS`:Bronze<1M<Silver<5M<Gold<15M<Platinum,按 totalSpending)。
- 会员权益表(`TIER_BENEFITS`):Point Rate / Bonus Multiplier(1×/1.5×/2×/3×)/ Priority Support / Exclusive Vouchers / Early Access / Free Cancellation。
- 资料字段 + 编辑;账户操作:暂停/封禁/重置。

### Booking History（预订历史）
- 表格列:BKG-id、hotel、checkIn/checkOut、nights、amount、status(confirmed/completed/cancelled/pending)、refund(none/requested/approved/rejected/processed)。

### User Activities（用户行为流水）
- 分类过滤(UActCat:auth/browse/booking/payment/rewards/promotions/reviews/support/account);
- 事件(UActType 约 27 类:login/registration/hotel_search/booking_created/payment/refund/coupon_applied/reward_earned/referral/review_submitted/support_opened/device_changed…),每条含 title/timestamp/device/platform/location/bookingId/merchant/amount/details。

### User Transactions（交易账本）
- 用户资金/支付流水(UserTransactionsPage;含支付/退款/钱包/积分变动)。

### Rewards & Coupons（奖励与券）
- **积分钱包**(WalletTx:earned/redeemed/referral/campaign/manual_credit/manual_deduct/expired,points/date/source/bookingId/campaign/admin)。
- **优惠券**(RCoupon:code/name/campaign/discountType percent|fixed/discountValue/minSpend/issueDate/expiry/status available|used|expired|revoked/redemptionDate/bookingId)。
- **代金券**(RVoucher:name/campaign/value/expiry/status available|redeemed|expired|cancelled)。
- **奖励历史**(RHistoryEvent:earned/redeemed/referral/campaign/welcome/coupon_issued/voucher_issued/tier_upgrade/manual_*,title/date/points/value/bookingId/campaign/admin/note)。
- 人工发券/发积分/调整。

### User Support（客服工单）
- 工单表(SupportTicket:subject/category/status open·in-progress·resolved·closed/created/updated/assignee/priority high·normal·low/messages/description/bookingId/transactionId/internalNote)。
- 新建工单抽屉(TicketForm:subject/category(8 类)/priority/description/bookingId/transactionId/rewardRef/assignee(6 位客服)/internalNote)。
- 客服升级、内部备注、给用户发通知。

### 通知历史（endusers-notifications）
- NotifRecord:type(booking/promotion/wallet/account/rewards/support/system)、title/message、channels(push/email/sms)、deliveryStatus(delivered/pending/failed)、readStatus(read/unread/n/a)、sentAt/readAt、sentBy(System/Admin)、relatedBookingId、deepLink。
- 可主动向用户发通知(多渠道)。

### Guest Conversations & Conversation Center（对话）
- **Conversation Center**(平台级,`conversations-center`):跨商户的 guest↔merchant 会话总览。ConvRecord:guest/merchant/bizType(hotel/restaurant/airline/car_rental/attraction)/bookingId/bookingStatus/status(open/awaiting_merchant/awaiting_guest/resolved)/reported/escalated/lastMessage;ConvMessage:sender(guest/merchant)/senderName/content/sentAt。可介入、标记升级/举报、解决。
- **Guest Conversations**(单用户,`endusers-conversations`):该用户的会话列表。

### Suspended Users（暂停）
- SuspendedUser extends EndUser + suspendedAt/suspensionReason/suspensionDuration/suspendedBy;操作:Reactivate(恢复)。

### Blacklist（黑名单）
- BlacklistEntry extends EndUser + blacklistedAt/blacklistReason/blacklistedBy/evidence(证据:chargeback 号、设备指纹匹配);操作:移出黑名单/查看证据。

## 数据结构

```typescript
type UserStatus = 'active'|'suspended'|'blacklisted'|'inactive'
type MemberTier = 'Bronze'|'Silver'|'Gold'|'Platinum'
type TicketStatus = 'open'|'in-progress'|'resolved'|'closed'

interface EndUser { id; name; email; phone; country; totalBookings; totalSpending
  tier: MemberTier; registeredAt; status: UserStatus; avatar; lastLogin; referralCode; points }

interface UserBooking { id; hotel; checkIn; checkOut; amount; status; refund; nights }
interface UActEvent { id; type: UActType; title; timestamp; device?; platform?; location?
  bookingId?; merchantName?; amount?; details:{label;value}[] }
interface RCoupon { code; name; campaign; discountType:'percent'|'fixed'; discountValue; minSpend
  issueDate; expiry; status:'available'|'used'|'expired'|'revoked'; redemptionDate?; bookingId? }
interface RVoucher { id; name; campaign; value; issueDate; expiry
  status:'available'|'redeemed'|'expired'|'cancelled'; redemptionDate?; bookingId? }
interface WalletTx { id; type:'earned'|'redeemed'|'referral'|'campaign'|'manual_credit'|'manual_deduct'|'expired'
  points; date; source; bookingId?; campaign?; admin? }
interface RHistoryEvent { id; type; title; date; points?; value?; bookingId?; campaign?; admin?; note? }
interface SupportTicket { id; subject; category; status: TicketStatus; created; updated; assignee
  priority:'high'|'normal'|'low'; messages; description?; bookingId?; transactionId?; internalNote? }
interface NotifRecord { id; type; title; message; channels: ('push'|'email'|'sms')[]
  deliveryStatus:'delivered'|'pending'|'failed'; readStatus:'read'|'unread'|'n/a'
  sentAt; readAt?; sentBy:'System'|'Admin'; relatedBookingId?; deepLink? }
interface ConvMessage { id; sender:'guest'|'merchant'; senderName; content; sentAt }
interface ConvRecord { id; guestId; guestName; merchantId; merchantName; bizType; bookingId
  bookingStatus; status: ConvStatus; reported; escalated; lastMessage; lastSender; lastAt; messages: ConvMessage[] }
interface SuspendedUser extends EndUser { suspendedAt; suspensionReason; suspensionDuration; suspendedBy }
interface BlacklistEntry extends EndUser { blacklistedAt; blacklistReason; blacklistedBy; evidence }
```

### 实体 → 现有表映射(见 data-structures.md)
EndUser→`user_info`;tier→`user_member_level`;WalletTx→`user_balance_log`+`user_points_log`;RCoupon/RVoucher→`marketing_coupon(_receive)`(+ 新 voucher);UserBooking→`order_main`;UActEvent→`user_action_log`;SupportTicket→`user_feedback`/`chat_*`;NotifRecord→`notify_record`;Conv*→`chat_conversation`/`chat_message`;referralCode→`user_referral`;Suspended/Blacklist→新 `user_blacklist`(或 status 扩展)。交易账本可用 `finance_account_entry`。

## 状态机 / 流转

- 用户:`active → suspended`(自动/人工,带原因/时长/操作人)→ `Reactivate → active`;`active/suspended → blacklisted`(人工审核,带证据)→ 可移出。对应 PRD 欺诈三级:正常→警告→暂停→(申诉→恢复)/(升级→封禁)。
- 工单:`open → in-progress → resolved → closed`。
- 会话:`open ⇄ awaiting_merchant ⇄ awaiting_guest → resolved`;可 escalated/reported。
- 通知:`pending → delivered/failed`;`unread → read`。

## 备注（后端缺口）

1. **Customer 360 是聚合视图**:选中用户后跨表聚合(资料/会员/钱包/积分/优惠券/预订/交易/奖励/工单/通知/会话),需一个聚合接口 + 上下文态;后端各源表已存在(见映射),主要工作是聚合与前端上下文。
2. **对话中心**(Conversation Center)是平台级 guest↔merchant 会话治理(介入/升级/举报/解决),复用 `chat_*` 但需增 bizType/booking 关联/escalated/reported/status 机器。
3. **封禁/黑名单**需独立表 + 原因/时长/操作人/证据 + 与欺诈系统(`user_fraud`/`user_appeal`)、PRD 三级欺诈流程联动。
4. **会员等级/权益**(TIER_THRESHOLDS/BENEFITS)需 `user_member_level` 承载阈值与权益,按 totalSpending 自动升级 + 权益驱动(积分倍率/免取消等)。
5. **积分/钱包/优惠券/代金券** 需完整账本 + 人工调整审计;voucher 目前无独立表(需新增)。
6. **主动通知**(多渠道 push/email/sms + 送达/已读)需通知中心能力;deepLink 跳转目标。
7. 金额 MMK,走站点货币配置。
