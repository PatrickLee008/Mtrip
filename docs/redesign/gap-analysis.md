# Gap 分析:现有 admin-web ↔ 新 Super Admin Portal

> 新设计 = **IA 重组 + 视觉升级 + 补齐全新模块**,并把已有后端能力(尤其 Consumer Ops)接到新信息架构。以下为模块级差异。字段级差异见 `super-admin-portal/modules/*.md`。

## 现状:admin-web 13 菜单组(`database/seed/02-menu.sql`)

系统管理 · 系统日志 · 系统配置 · 商户管理 · 供应商管理 · C端用户管理 · 商品管理 · 订单管理 · 财务管理 · 营销活动 · 数据统计中心 · 核销管理 · 移动运营(Consumer Ops:appeal/fraud/review/longstay/theme/chat/trip/entry/filter/campaign)。

## 目标:新 Super Admin Portal 15 模块(`App.tsx` + `Sidebar.tsx`)

Dashboard · Merchant Verification · Merchant Management · Business Operations(Hotel Ops: Bookings + Inventory;Restaurant Ops 占位) · Campaign & Promotion · Affiliate & Influencer · Referral Campaigns · Platform Rules & Compliance · User & Role Management · Reports & Analytics · End User Management(+Customer 360 / Conversation Center) · Help Center Management · Content Management · Platform Configuration。

## 模块级映射与差距

| 新模块 | 子页 | 现有对应 | 后端现状 | 差距 |
|---|---|---|---|---|
| Dashboard | 单页 | dashboard + stats/dashboard | AdminStatsController | 新聚合口径(待审达人/系统告警/活动运营总览) |
| Merchant Verification | Pending/Approved/Rejected/Resubmission/Onboarding | 仅 `merchant:list:audit` 按钮 | MerchantController(含审核) | **新增** 文档表/时间线/重交态/审核人;4 状态页。✅ 2026-08-16 原型对齐整改闭环:Onboarding 入驻流水线(5 表+9 KYC 模板)/ Access Code 凭证(MTRP-XXX)/ 9 项预置驳回原因/重交版本对比/逐份核验门禁均已落地(`09-merchant-application.sql` + `OnboardingController`) |
| Merchant Management | All/Documents/Suspended/Blacklisted/Activities | merchant/list·account·group·store·stats | 已实现 | 新增 Documents/Suspended/Blacklisted/Activities + 黑名单/活动日志 |
| Business Ops · Bookings | All/Refunds/Settlements/History | order/* + finance/msettle | 已实现 | 重组;补对账抽屉/审计时间线/SLA |
| Business Ops · Inventory | Overview/Availability/Detail/Timeline/Calendar/Alerts/Reports | goods/stock | AdminStockController | 新增日历/时间线/可用量/告警 UI + 告警模型 |
| Restaurant Ops | 占位 | 无 | 无 | 未来 |
| Campaign & Promotion | Campaigns/Promotions/Vouchers/Codes/Welcome/Analytics | marketing/* + cops/campaign | 已实现 | 新增 Voucher/PromoCode/WelcomeReward/商户级 Promotion/Analytics |
| Affiliate & Influencer | Applications/Partner/Program/Reward Wallet/Fraud/Codes | 无(仅消费者 Referral) | ReferralController(仅消费者) | **全新** 达人实体/申请/计划/钱包提现/反欺诈/联盟码 |
| Referral Campaigns | 单页 | user/05-referral | 已实现 | 归入 Affiliate 组 |
| Platform Rules & Compliance | Rules/Violations/Warning/Compliance | cops/fraud(用户侧) | AdminRiskController | **新增** 平台规则/商户违规/警告/合规历史 |
| User & Role Management | Users/Roles/Permission Matrix/Sessions | system/admin·role·menu | 已实现 | 新增权限矩阵视图 + 活跃会话 |
| Reports & Analytics | Executive/Transaction/Business/Custom | stats/* | AdminStatsController | 重组 + 自定义报表 |
| End User Management | Directory/Conversation/Profile/Bookings/Activities/Transactions/Rewards/Support/Guest Conversations/Suspended/Blacklist | user/* + cops/chat·appeal | 已实现 | 重组为 Customer 360;新增对话中心/封禁黑名单/交易奖励聚合 |
| Help Center Management | FAQ/Categories/Announcements/Search Analytics | 无 | 无 | **全新** |
| Content Management | Banners/Themes | marketing/banner + cops/theme | 已实现 | 重组 + 主题编辑器(11 区/30 素材) |
| Platform Configuration | 17 配置卡 | config/* + finance/tax + verify/rule | 已实现 | 整合为配置卡 + ~11 新占位配置 |

## 处置策略(已确认)

- **遗留独立分组保留**:供应商管理、门票商品(goods/ticket)、核销设备/规则、系统日志 —— 不在新 IA,但保留为独立菜单组,不删除。
- **Consumer Ops 组吸收拆分**:chat→对话中心;appeal→EndUser 封禁/申诉;review→内容/商品;longstay/campaign→促销;theme→内容;fraud→平台规则;entry→结算;filter→平台配置;trip→(EndUser/订单)。
- **全新模块**:Affiliate & Influencer、Help Center、Customer 360 聚合、对话中心、平台规则(商户侧)、库存日历/告警、促销 Voucher/Code/Welcome。

## 关键风险

1. **Affiliate(B2B 达人)≠ Referral(C 端返利)**,数据模型独立,勿混用 `user_referral`。
2. 设计稿大量硬编码/轮询假数据(reviewer、priority、对账偏差、Today's Bookings 等),需后端真实口径替代。
3. 遗留模块与新酒店闭环并存,注意菜单排序/权限键不冲突。
4. 货币走站点配置,勿写死 MMK/¥。
