# 改造实施计划(Migration Plan)

> admin-web 内改造(保留 Vue3+**Ant Design Vue 4.x** + 动态路由/RBAC/i18n)。遗留模块保留为独立分组。首批优先级:IA 重组+令牌 → 商户验证 → Affiliate → End User 360。双语 + 站点货币可配。
>
> 权威计划见会话审批的 plan 文件;本文件为仓库内可维护副本,随进度更新。

## 贯穿约束

- **RBAC 三处对齐**:后端 `#[Permission('模块:菜单:按钮')]` ↔ `database/seed/02-menu.sql` 的 `perm_key` ↔ 前端 `v-perm`,改任一处三处同改。
- **页面目录 = 菜单 component 字段**(`admin-web/src/router/dynamic.ts` 按此解析;未实现回退 `views/wip`)。
- **工程范本** = `backend/services/system-service`;业务服务用 `Db::table` 直查;新服务按"骨架复制法"整目录复制改差异。
- **站点隔离** `site_id`;软删除 `deleted_at`;金额最小货币单位 + 站点货币。
- 交付前 `scripts/check.ps1` 全绿;DB 增量 `scripts/db-apply.ps1` 并登记 deploy initdb。

## Phase 0 — IA 重组 + 设计令牌(骨架先行)

- `database/seed/02-menu.sql`:重排为 15 大模块(一级目录 + 二级页面 + 三级按钮 perm_key);遗留组保留;Consumer Ops 迁移到新归属。`db-apply` 应用。
- `admin-web`:落 `styles/tokens.css` + 覆盖 Element 主题(深色侧栏/品牌色/字体);新增 `components/StatCard.vue`;补 `StatusTag` 四色枚举;补 `locales` 菜单词条。
- 验收:15 组导航出现、视觉符合令牌、旧功能不回归、check 绿。

## Phase 1 — 商户验证工作流

- DB:`merchant_verify_document` / `merchant_verify_timeline` / `merchant_blacklist` / `merchant_activity_log`;`merchant_info.status` 补 resubmission。
- 后端(merchant-service):验证工单查询(pending/approved/rejected/resubmission)、文档核验、通过/驳回/要求重交(写时间线+审核人)、拉黑/暂停。
- 前端:`merchant/verify` 四状态页 + 文档抽屉 + 审核时间线 + 审核弹窗;`merchant/documents|suspended|blacklisted|activities`。
- 验收:提交→审核→驳回/重交→通过 全链路落库,时间线可见。

## Phase 2 — Affiliate 带货达人(全新)

- DB:`affiliate_*` 七表。
- 后端:marketing-service(或新 affiliate 目录)实现 达人 CRUD/申请审核/计划配置/联盟码/佣金流水/钱包提现/反欺诈。
- 前端:Affiliate 组 6 页 + Referral 页(接 ReferralController)。
- 验收:申请 pending→active/rejected、码用量、提现流程、佣金入账。

## Phase 3 — End User 客户 360 + 对话中心

- DB:`user_blacklist`(或状态扩展);其余聚合。
- 后端:AdminUserController 补 360 聚合(profile+钱包+积分+优惠券+预订+交易+奖励+设备偏好)、封禁/黑名单、活跃会话;对话中心聚合 `chat_*` + 未读计数;接 `user_appeal`/`notify_record`。
- 前端:User Directory + Customer 360 详情页(选中用户加载 8 详情 Tab)+ Conversation Center + Suspended/Blacklist。
- 验收:选中用户进 360、各 Tab 数据正确、封禁/申诉/回信闭环。

## Phase 4+ — 后续排期

库存日历/可用量/告警 → 促销 Voucher/Code/Welcome/Analytics → Help Center(全新)→ Content/主题编辑器 → Reports 重组+自定义报表 → Platform Config 17 卡整合 → Business Ops 结算对账/审计时间线 → Platform Rules & Compliance 商户侧。

## 进度

| 阶段 | 状态 | 备注 |
|---|---|---|
| 文档:综述 4 篇 | 已完成 | design-system / data-structures / gap-analysis / migration-plan |
| 文档:15 模块全集 | 已完成 | modules 01-13(含 04a 预订、04b 库存、06 Affiliate、06b Referral),逐列/逐字段/数据结构/状态机/后端缺口 |
| Phase 0 · 设计令牌 | 已完成 | `config/theme.ts`(brand #1664FF + 语义色)、`styles/index.less`(新增 `--sap-*` 令牌)、`BasicLayout`/`SideMenu` 深色导航 navy #0A1628 + 品牌色、新增 `components/StatCard.vue`。**待 shell 恢复跑 `vue-tsc` 验证** |
| Phase 0 · 菜单 IA 重组 | 已定稿·待应用验证 | `database/seed/02-menu.sql` 已重排为 18 顶级节点(13 新模块 + 5 遗留组)、231 行、「先清后建」;`dynamic.ts` 加路由去重守卫。只读校验通过(无重复 ID/route_path)。**待 shell 恢复:`db-apply` + `restart` + 起服务可视化核对导航/权限**。超管 bypass 权限,不影响现有授权 |

> 注:admin-web 实际 UI 库为 **Ant Design Vue 4.x**(非 Element Plus,已更正相关文档)。
| Phase 1 验证 · DB | 已写·待应用 | `database/merchant/07-verify-workflow.sql`(4 表:doc/timeline/blacklist/activity_log;status 扩展 6=待重新提交),已登记进 compose initdb(28-*) |
| Phase 1 验证 · 后端 | 已写·待验证 | merchant-service `VerifyController`(list/detail/approve/reject/resubmit/doc-review/documents/blacklist/unblacklist/activities)+ 路由 + `MerchantController::update` 支持 6→0 重提;写 timeline+activity;复用 `MerchantService::approve/reject`。**待 `php -l` + `db-apply` + `restart merchant-service` 验证** |
| Phase 1 验证 · 前端 | 已写·待验证 | `views/merchant/verify/index.vue`(4 状态 tab 由路由驱动 + 详情抽屉[文档表+时间线] + 通过/驳回/重交/文档核验弹窗)、`documents/index.vue`(文档库)、`activities/index.vue`(活动审计);API 加 verify 系列;沿用 useTable/StatusTag/v-perm 模式。**待 `vue-tsc` 验证**。遗留:`suspended`/`blacklisted` 暂复用 `merchant/list`,需专门列表(status=4 + merchant_blacklist join)后续补 |
| Phase 2 Affiliate · DB | 已写·待应用 | `database/marketing/05-affiliate.sql`(7 表:partner/application/program/code/commission_log/withdraw/fraud_flag),已登记 compose initdb `99-*` |
| Phase 2 Affiliate · 网关+后端 | 已写·待验证 | 网关 map 加 `affiliate → marketing_service`;marketing-service `AffiliateController`(applications/partners/program/codes/wallet[佣金流水+提现+调整]/fraud,16 方法)+ 路由 `/api/v1/admin/affiliate/*`。**待 `php -l` + `db-apply` + `restart marketing-service gateway`** |
| Phase 2 Affiliate · 前端 | 已写·待验证 | `api/affiliate.ts` 全量;**7 页全建**:`applications`(通过/驳回)、`partners`(暂停/恢复)、`program`(佣金/奖励规则增改+启停)、`codes`(增删改)、`wallet`(提现打款+佣金流水+人工调整)、`fraud`(案件处置+联动暂停)、`referral`(C 端返利记录)。**待 `vue-tsc` 验证** |
| Phase 2 Referral · 后端 | 已写·待验证 | user-service 加 `AdminReferralController`(user_referral 列表)+ 路由 `/api/v1/admin/user/referral-list`(perm `affiliate:referral:list`) |
| Phase 3 EndUser · DB | 已写·待应用 | `database/user/09-enduser-blacklist.sql`(`user_blacklist` 表;`user_status` 扩展 4=拉黑),已登记 compose initdb `99b-*` |
| Phase 3 EndUser · 后端 | 已写·待验证 | AdminUserController 加 `customer360`(聚合资料+会员+钱包/积分/预订/优惠券/交易/推荐数,`safeRows` 容错跨表)+ `blacklist`/`unblacklist`;路由 `/admin/user/customer360|blacklist|unblacklist`。冻结/解冻复用已有 `toggle-status` |
| Phase 3 EndUser · 前端 | 已写·待验证 | `api/enduser.ts`;`user/profile`(Customer 360:搜 ID→头卡+统计+6 Tab+暂停/拉黑/恢复)、`user/suspended`(userStatus=2+恢复)、`user/blacklist`(userStatus=4+移出),均含跳 360 链接。对话中心复用已有 `cops/chat`。**待 `vue-tsc` 验证** |
| 库存(模块04b)· 前端 | 已写·待验证 | **后端零改动**(复用 goods-service AdminStockController 的 overview/low-warning/calendar/logs)。`api/inventory.ts` + 3 页:`inventory/overview`(聚合库存)、`inventory/alerts`(低库存告警)、`inventory/calendar`(单 SKU 分日网格) |
| 帮助中心(模块12)· 全栈 | 已写·待验证 | **全新**:DB `system/08-helpcenter.sql`(4 表,initdb `99c-*`)+ 网关 map `help→system_service` + system-service `HelpController`(文章/分类/公告 CRUD + 搜索分析)+ 路由 `/admin/help/*`;前端 `api/help.ts` + 4 页(articles/categories/announcements/analytics)。**待 `db-apply`+`restart system-service gateway`+`vue-tsc`** |
| 平台规则与合规(模块08)· 全栈 | 已写·待验证 | **全新**:DB `merchant/08-compliance.sql`(4 表:platform_rule/merchant_violation/merchant_warning/compliance_history,initdb `99d-*`)+ 网关 map `compliance→merchant_service` + merchant-service `PlatformRuleController`(规则 CRUD+发布/违规处置/警告签发撤销/合规历史)+ 路由 `/admin/compliance/*`;前端 `api/compliance.ts` + 4 页。**待 `db-apply`+`restart merchant-service gateway`+`vue-tsc`** |
| 促销独立实体(模块05)· 全栈 | 已写·待验证 | **全新**:DB `marketing/06-promotion-extras.sql`(3 表:marketing_voucher/promo_code/welcome_reward,initdb `99e-*`)+ marketing-service `PromotionController`(代金券/促销码/新客奖励 CRUD)+ 路由 `/admin/marketing/{voucher,promo-code,welcome}/*`;前端 `api/promotion.ts` + 3 页(vouchers/codes/welcome)。**待 `db-apply`+`restart marketing-service`+`vue-tsc`** |
| Reports 自定义报表(模块10)· 全栈 | 已写·待验证 | order-service `AdminStatsController::custom`(reportType bookings/revenue + 日期 + 商户 过滤订单明细)+ 路由 `/admin/order/stats/custom`;前端 `api/reports.ts` + `stats/custom`(构建器+客户端 CSV 导出)、`stats/business`(6 类报表入口卡)。Executive/Transaction/Merchant/Goods/Site 复用现有 stats 页 |
| Platform Config 特性开关(模块11)· 全栈 | 已写·待验证 | **全新**:DB `system/09-feature-flag.sql`(`sys_feature_flag` + 9 开关种子,initdb `99f-*`)+ system-service `FeatureController`(list/save)+ 路由 `/admin/config/features/*`;前端 `api/feature.ts` + `config/features`(开关列表)。其余 16 配置卡复用现有 config/* 页 |
| 零头处理 · 业务完整性 | 已写·待验证 | `02-menu.sql` 把 13 个 WIP 组件**重指向现有页**(inventory availability/detail/reports/timeline→calendar/overview/alerts;user bookings/transactions/rewards/conversations→order-all/finance-flow/coupon/chat;marketing promotions/analytics→campaign/stats;system/sessions→system-admin)。**新建 2 页**:`merchant/suspended`(status=4)、`merchant/blacklisted`(黑名单)+ 后端 `VerifyController::blacklistList` + 路由 + `apiMerchantBlacklistList`。至此所有 Super Admin Portal 菜单项均落到可用页,无 WIP 占位。遗留 legacy 项(user/level·finance/tax·verify device/rule·supplier/report,改造前即 WIP)未在本次范围 |
