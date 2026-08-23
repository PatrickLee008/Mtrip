# 实现方案 — Merchant App 全模块差距检查与样式同步

> 需求基准:`设计文档/mTrip_Merchant App PRD_v1.0.md`。本文件用于承接 merchant-web 全模块推进,不替代各专项详细方案。
> 更新时间:2026-08-23

## 1. 本轮策略

- **先统一视觉底座**:优先用 `merchant-web/src/styles/index.less` 覆盖 antd 卡片、表单、按钮、表格、分页、抽屉、弹窗,尽量复用现有页面与 `PageContainer`/`StatusTag`/`AmountText`。
- **再补模块入口**:对 PRD 已明确但 merchant-web 尚空的 M2/M3/M5/M6/M8/M9/M10,先在 `database/seed/04-merchant-menu.sql` 登记菜单入口,未实现组件暂由动态路由回退到 `views/wip/index.vue`。
- **最后逐模块落接口**:新增真实接口时再同步 `mtrip.conf` 的 `map $merchant_module $merchant_upstream`;新增 SQL 文件时再同步 `deploy/docker-compose.yml` initdb 挂载。

## 2. 已落地改动

- `merchant-web/src/main.ts`:调整样式导入顺序,确保 `ant-design-vue/dist/reset.css` 先加载、项目覆盖层后加载。
- `merchant-web/src/styles/index.less`:新增原型公共覆盖层,统一白卡片 12px 圆角、`#E2E8F0` 边框、浅灰筛选区、紧凑表格表头、分页栏、按钮、输入框、Tag、Modal/Drawer。
- `merchant-web/src/components/PageContainer.vue`:内容区同步原型主留白 `24px 28px`,背景保留 `#F4F6FB` 并加轻微蓝色氛围层。
- `database/seed/04-merchant-menu.sql`:新增 M2 客房管理、M3 房量与价格、M5 收益结算、M6 通知中心/设置、M8 营销活动、M9 评价管理、M10 帮助中心菜单入口。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 与 `menuI18n.ts`:补齐新增菜单词条和 WIP 提示词条。
- **M5 已进入首轮实现**:`dashboard/index.vue` 接入 `merchant/stats/dashboard`;新增 `earnings/index.vue` + `api/{stats,earnings}.ts`;后端新增 order-service `Merchant/StatsController` 与 finance-service `Merchant/EarningsController`;网关已登记 `stats→order_service`、`earnings→finance_service`。
- **M6 已进入首轮实现**:新增 `notifications/index.vue`、`settings/index.vue`、`api/notifications.ts`;Header 铃铛接未读数并跳转通知中心;后端新增 merchant-service `Merchant/NotificationController`;新增 `merchant_notify.read_at/read_by` 幂等迁移并登记 initdb。
- **M9 已进入首轮实现**:新增 `reviews/index.vue`、`api/reviews.ts`;后端新增 goods-service `Merchant/ReviewController`(列表/统计/回复/标记复核),通过 `goods_info.merchant_id` 做商户范围裁剪;新增 `goods_review` 标记复核字段幂等迁移并登记 initdb。
- **M10 已落地轻量页面**:`support/index.vue` 先提供 FAQ/指南/邮箱支持入口,结构化工单表与流程保留为 M10 后续专项。
- **M8 已进入首轮实现**:新增 `promotions/index.vue`、`api/promotions.ts`;后端新增 marketing-service `Merchant/PromotionController`(统计/列表/详情/新建/编辑/发布/停发/删除),商家活动复用 `marketing_coupon` 并强制绑定适用商品;新增 `marketing_coupon.merchant_id/created_by_merchant_admin` 字段迁移并登记 initdb;网关已登记 `promotions→marketing_service`。
- **M2/M3 已进入首轮实现**:新增 `rooms/index.vue`、`availability/index.vue`、`api/{rooms,availability}.ts`;后端新增 goods-service `Merchant/RoomController` 与 `Merchant/AvailabilityController`;房型详情与日历限制字段已补入 `database/goods/01-goods.sql`,存量幂等迁移 `database/goods/06-merchant-room-availability-fields.sql` 已登记 initdb;网关已登记 `rooms/availability→goods_service`。

## 3. 全模块差距清单

| PRD Module | 当前入口 | 页面现状 | 后端/网关缺口 | 下一步 |
|---|---|---|---|---|
| M2 Hotel & Room Management | `/rooms` | **首轮已实现**:酒店筛选、房型表格、全页新建/编辑表单、设施/媒体/价格/库存/政策区块,视觉对齐 RoomsScreen | 平台审核流暂只记录 `publish_status`;门店级精确隔离需后续 `goods_info.store_id` | 联调后接平台审核消费 |
| M3 Availability, Inventory & Pricing | `/availability` | **首轮已实现**:工具栏、同步状态、图例、日历网格、单日抽屉、批量更新、规则/告警面板 | PMS/CM 同步与动态定价规则仍为占位;真实规则表待专项 | 后续接第三方同步与价规 |
| M5 Business Dashboard, Earnings & Settlement | `/dashboard` + `/earnings` | **首轮已实现**:真实 KPI/趋势/物业表现/今日运营 + 收益结算列表/详情/申诉/CSV 导出;Active Promotions 已接 M8 | 入住率/ADR 仍依赖 M2/M3;结算自动生成/发票留财务专项 | M3 后回填精细指标 |
| M6 Notifications & Settings | `/notifications`、`/settings` | **首轮已实现**:通知列表/筛选/已读/Header 未读数;设置页资料/通知偏好/改密/语言地区 | 通知偏好服务端持久化、2FA/可信设备管理仍待后端专项 | 后续接通知渠道服务 |
| M8 Promotion & Campaign Management | `/promotions` | **首轮已实现**:统计卡/筛选/列表/新建编辑/发布停发/删除,按原型 PromotionsScreen 卡片化口径实现 | 平台审核流、活动效果分析、房型/日期粒度限制待后续 | 后续接平台审核与 M2/M3 细粒度促销 |
| M9 Reviews & Ratings Management | `/reviews` | **首轮已实现**:评价统计/列表/筛选/商家回复/标记平台复核 | 平台侧复核队列尚未消费商户标记字段 | 后续联动 admin 审核队列 |
| M10 Merchant Support & Help Center | `/support` | **轻量已实现**:FAQ/指南/邮箱支持入口 | 缺支持工单表、会话记录、工单通知 | 后续做 M10 support ticket 专项 |

## 4. 约束核对

- 统一响应结构:新增 M5/M6/M9 后端接口均走 `Result::success` / `Result::page`。
- Permission 对齐:新增写接口 `mch:earnings:dispute`、`mch:notifications:read`、`mch:promotions:add/edit/status/delete`、`mch:reviews:reply`、`mch:reviews:flag`、`mch:rooms:add/edit/delete/status`、`mch:availability:edit/bulk-update/sync` 已同步 `database/seed/04-merchant-menu.sql`,前端按钮用同键 `v-perm`。
- 站点/商户隔离:M5/M6 使用 `MerchantContext::scopeMerchantIds()`;M8 通过 `marketing_coupon.merchant_id` + `goods_info.merchant_id` 校验裁剪;M9/M2/M3 通过 `goods_info.merchant_id` join 裁剪。
- 网关登记:`mtrip.conf` 已登记 `stats→order_service`、`earnings→finance_service`、`notifications→merchant_service`、`promotions→marketing_service`、`reviews/rooms/availability→goods_service`。
- SQL initdb:新增 `database/merchant/22-merchant-web-notify-read.sql`、`database/goods/05-merchant-review-flag.sql`、`database/goods/06-merchant-room-availability-fields.sql`、`database/marketing/07-merchant-promotion-owner.sql` 已登记 `deploy/docker-compose.yml` initdb。

## 5. 验收

- `D:\BtSoft\php\81\php.exe -l` 检查新增/修改后端控制器与路由通过。
- `cd merchant-web && npm run build` 通过(EXIT=0),仅保留 Vite 原有 chunk 体积警告。
