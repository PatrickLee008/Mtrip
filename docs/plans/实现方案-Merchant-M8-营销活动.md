# 实现方案 — Merchant M8 促销与活动管理

> 需求基准:`设计文档/mTrip_Merchant App PRD_v1.0.md` Module 8 Promotion & Campaign Management。
> 设计源:Figma file `fsK2rrl2sadcowrxspvGV8`(mTrip_Merchant)SECTION `2285:21516`「Promotion tables」。
> 更新时间:2026-09-21（第二轮:按 Figma 整页重写 + 长住 / 平台活动 / 效果分析三块新增）

## 0. 本轮范围（用户已确认的三项取舍）

1. **做全功能需求**（不只稿面）:Promotions 页照稿重写 + 长住促销 + 平台活动参与 + 效果分析。
2. **`/promotions` 按稿整体重写**（与 2026-09-21 availability 页同一做法），删除稿面没画的
   聚光灯卡 / 筛选卡 / 状态条 / antd 表格 + 弹窗。
3. **曝光埋点走真实链路**:新增按日聚合表 + C 端上报，不做估算口径。

---

## 1. 设计源拆解

SECTION `2285:21516` 是 **6 个画板，实为同一页的 2 种呈现 + 1 个抽屉**：

| 画板 | 内容 |
|---|---|
| `2285:19350` Percentage promotion tables | 卡片网格（2 张卡） |
| `2285:19445` Percentage promotion Create | 网格 + 抽屉 |
| `2285:19613` Fixed amount promotion Create | 同上，面额为 MMK |
| `2285:19781` Fixed amount promotion tables | 卡片网格 |
| `2285:19876` Coupon Codes promotion tables | **表格**（6 列 × 5 行） |
| `2285:20047` Coupon Codes promotion Create | 表格 + 抽屉 |

共用的页面壳:H1「Promotion Tables」+「Create coupons, manage discounts and coupon code.」
+「Add New Promotion」；三张统计卡（Percentage 2 / Fixed Amount 2 / Coupon Code 5）；
Tab 条（Percentage / Fixed Amount / Coupon Code）；抽屉页脚 Cancel / Publish Promotion。

**稿面之外、功能需求要求的三块**（沿用同一套令牌与组件语言新设计）:
Long Stay 促销、`/campaigns` 平台活动参与、`/promotions/analytics` 效果分析。

## 2. 数据模型

`mtrip_business` 是单库，跨表 join 无障碍。**复用已有能力**:`funding_source`/`funding_rules`
的出资分摊已由 `order-service/SettlementService` 按 平台/商户/合作方/共担 拆账；
领券/核销/订单关联走 `marketing_coupon_receive`。

### 2.1 `marketing_coupon` 补列（`database/migrations/V20260921121500__merchant-promotion-rules.sql`）

| 列 | 类型 | 用途 |
|---|---|---|
| `promotion_kind` | TINYINT DEFAULT 0 | 0未分类(存量/平台券) 1百分比 2固定金额 3优惠码 4长住 |
| `promo_code` | VARCHAR(32) | 优惠码（kind=3 必填，同站点唯一，含 `idx_site_promo_code`） |
| `description` | VARCHAR(255) | 卡面描述 |
| `staff_note` | VARCHAR(500) | Internal Staff Notes（仅员工可见，与面向客人的 `remark` 分开） |
| `min_nights` / `max_nights` | INT DEFAULT 0 | 长住最少晚数 / 适用入住时长上限 |
| `book_advance_days` | INT DEFAULT 0 | 提前预订:需提前 N 天 |

### 2.2 两个轴，不要混淆（本轮最关键的设计决定）

- `coupon_type`(**计价轴**，未改动):1满减/3无门槛 = `discount_value` 直减金额；
  **2折扣券 = `discount_value` 是 10 分制折扣率**（8.50 = 用户付 85% = 15% off），
  下游 `order-service/PricingService::resolveCoupon` 与 `SettlementService` 都按此读。
- `promotion_kind`(**展示轴**，本轮新增):只决定页面分 Tab。

稿面三个 Tab 混了「面额轴（百分比/固定金额）」和「是否需券码」两个维度，`coupon_type`
表达不了，故两轴并存，换算收口在两个纯函数:

| 设计口径 | 计价口径 |
|---|---|
| Percentage 15% Off | `coupon_type=2`,`discount_value=8.50` = `(100-15)/10` |
| Fixed MMK 5,000 Off | `coupon_type=1`,`discount_value=5000` |
| Coupon Code + 单位选 % | `coupon_type=2`（同上换算） |
| Coupon Code + 单位选金额 | `coupon_type=1` |
| Long Stay 10% Off | `coupon_type=2` + `min_nights` |

后端 `PromotionController::discountPair()` 负责设计口径 → 计价口径；返回行额外带
`discount_percent_off`，前端直接渲染百分比文案，**不重复做 10 分制换算**。
→ `PricingService` / `SettlementService` **零改动**。

### 2.3 `marketing_campaign` 补列（同一迁移）

`funding_source`（1平台 2商户 3合作方 4共担）、`funding_rules`（共担比例 JSON）、
`requirements`（参与资格要求）、`terms`（活动条款）、`invite_mode`（1定向邀请 2公开报名）。
平台侧 `Admin/CampaignController::save` 同步接收这五个入参（admin-web 表单留后续）。

### 2.4 两张新表

- `marketing_campaign_participant`:商户 ↔ 平台活动参与关系，`uk(campaign_id, merchant_id)`，
  `status` 0待响应/1已接受/2已拒绝/3已退出，含出资模式快照与 `invited_at`/`responded_at`。
- `marketing_promotion_impression`:**按日聚合**曝光表，`uk(coupon_id, campaign_id, stat_date, source)`，
  `impressions` 累加。不做行级流水（C 端每次列表渲染只 upsert 一次，避免行爆炸）。

## 3. 后端 API

### 3.1 `Merchant/PromotionController`（扩展，路由前缀不变）

| 路由 | 权限 | 说明 |
|---|---|---|
| `GET /summary` | — | 按 kind 计数 + 状态计数 + 曝光合计 |
| `GET /list` | — | 新增 `promotionKind` 过滤 |
| `GET /detail` | — | |
| `GET /options` | — | **新** 本商户物业 + 房型 + 只读币种，抽屉一次取齐 |
| `GET /performance` | — | **新** 效果分析 |
| `POST /add` `update` | add / edit | |
| `POST /duplicate` | `mch:promotions:duplicate` | **新**（稿面行内 copy 图标） |
| `POST /publish` `toggle-status` `delete` | status / delete | 删除时一并软删券码镜像 |

### 3.2 `Merchant/CampaignController`（新）

`GET /summary`、`GET /list`、`GET /detail`、`POST /respond`（权限 `mch:campaigns:respond`）。
可见性:活动须 `status=1` 且当前时间落在 `[start_time, end_time]`；
`invite_mode=1` 只有已建参与行的商户可见，`invite_mode=2` 全站点可见；
响应时把活动的出资模式**快照**进参与行，后续平台改活动不影响已确认的结算口径。

### 3.3 效果分析口径（全部真算，不估算）

`GET /merchant/promotions/performance?range=7d|30d|90d|all`（默认 30d）

| 指标 | 口径 |
|---|---|
| 曝光量 | `marketing_promotion_impression.impressions` 求和 |
| 领券量 | `marketing_coupon_receive` 行数 |
| 核销量 | 领券记录 `status=1` |
| 预订量 | 带券订单去重计数（`receive.order_id > 0`） |
| 转化率 | 领券量 / 曝光量（曝光 0 时返回 0，不返回 null） |
| 促销收益 | 带券订单 `finance_account_entry.order_amount` 合计 |
| 商户出资 | `finance_account_entry.merchant_pays` 合计 |
| ROI | 促销收益 / 商户出资 |

⚠ **踩坑留痕**:`finance_account_entry.coupon_id` 存的是**领券记录 ID，不是券模板 ID**
（`database/finance/02-consumer-account-entry.sql` 注释 + `SettlementService` 写入处均可证）。
按模板 ID 直接过滤永远查不到数，必须经 `marketing_coupon_receive` 换算模板维度。
逐券明细用 4 条分组查询在 PHP 侧合并，避免 N+1。

### 3.4 C 端曝光上报（新链路）

`POST /api/v1/app/marketing/impression`（`UserAuthMiddleware`），入参
`{items:[{couponId, campaignId, source, count}]}`，上限 50 条 × 单条 50 次防刷，
`insertOrIgnore` 占位 + `increment` 累加（并发靠唯一键兜底，不做「先查后插」）。
调用点:`PromotionsScreen`（`app_list` + `campaign_page`）、`CouponDetailScreen`（`app_detail`）。
`client-app` 的 `RequestOptions` 新增 `silent?: boolean`，让埋点在业务错与网络错时都不弹 Toast。

### 3.5 券码真的能兑换

C 端 `/app/marketing/coupon/redeem` 查的是 `marketing_promo_code`（按 code 全局查且要求
`coupon_id > 0`）。因此 kind=3 的促销在建/改/上下架/复制时会 `syncPromoCode()` 同步一份镜像行；
删除促销时一并软删，否则按码仍能兑换到已删除的券。
校验码唯一性时**必须排除本促销自己的镜像行**，否则编辑时即使没改码也会被判重复。

### 3.6 网关

`deploy/openresty/conf.d/mtrip.conf` 的 `map $merchant_module` 新增 `campaigns marketing_service`
（硬约定:新增二级模块不登记则网关 404）。已验证 `/merchant/campaigns/*` 返回 401 而非 404。

## 4. 权限与菜单（三处对齐）

| 菜单 id | 名称 | component | perm_key |
|---|---|---|---|
| 1000（沿用） | 营销活动 Promotions | `promotions/index` | `mch:promotions:list` |
| 1005（新） | 效果分析 Promotion Performance | `promotions/analytics/index` | `mch:promotions:performance` |
| 1006（新） | 平台活动 Campaigns | `campaigns/index` | `mch:campaigns:list` |

按钮:`100005 mch:promotions:duplicate`、`100601 mch:campaigns:respond`。
- 全新库:`database/seed/04-merchant-menu.sql`（含内置角色按 `account_scope` 授权）。
- 存量库:`database/migrations/V20260921120000__merchant-promotion-campaign-menu.sql`（幂等 + 重授）。
- 侧边栏:`layouts/components/SideMenu.vue` 的 `business` 分组新增 `/promotions/analytics`、`/campaigns`。

## 5. 前端

```
views/promotions/
  index.vue            # 页面壳:H1 + Add New Promotion + 统计卡 + Tab + 网格/表格 + 抽屉
  tokens.less          # 稿面令牌（本页主色 #4169ED，不是全局 --mtrip-primary）
  helpers.ts           # 纯函数:形态判定/折扣文案/状态徽标/进度/表单↔载荷
  components/{PromoIcon,StatCards,PromoGrid,PromoCard,PromoTable,PromoDrawer}.vue
views/promotions/analytics/index.vue   # 指标卡 + EChartCard 趋势 + 逐券明细表
views/campaigns/{index.vue, components/{CampaignCard,CampaignDrawer}.vue}
api/promotions.ts（重写）、api/campaigns.ts（新）
```

`views/campaigns/*` 用相对路径 `@import '@/views/promotions/tokens.less'` 复用同一套令牌
（同一份 Figma、同一视觉语言，避免复制粘贴两处色值）。

**字体依赖**：稿面同页混排三族 —— Plus Jakarta Sans（页面标题/卡片标题/数字，含 800 ExtraBold）、
Inter（表体 / 表单 Label / 徽标）、Geist（按钮文案）。HEAD 的 `merchant-web/index.html` 只加载了
Plus Jakarta Sans 400–700，本页新增 `&family=Inter:...&family=Geist:...` 并把注释改为与页面无关的
中性描述（该字体链接是 availability 页与 promotions 页**共用**的资源，谁先提交就由谁带上）。
校验脚本已加 5 条断言防止回退。

## 6. 照稿但存疑 / 未照抄（先声明）

1. **卡片操作键文案自相矛盾**:稿面 Active 卡配的按钮文案是 `Resume`（模板复用痕迹）。
   按语义实现 Active→`Pause`、Paused→`Resume`、草稿/Upcoming→`Start`，文案独立成键。
2. **三种促销呈现不一致**（Percentage/Fixed 用卡片网格，Coupon Code 用表格）:照稿保留，不统一。
3. **日期写法不一致**:稿面卡片用补零（`Oct 01 – Dec 31, 2026`），表格用不补零
   （`Oct 1 – Oct 31, 2026`）。统一取不补零，同一年省略起始年份。
4. **稿面抽屉缺「适用物业 / 房型 / 出资模式 / 兑换上限」**，但功能需求明确要求:
   在稿面字段之后按同一 Label/Input 令牌追加；百分比/固定/长住追加「适用物业 + 适用房型
   + 出资模式（只读:Merchant funded · 100%）+ 兑换上限」，优惠码的兑换上限即稿面的 Usage Limit。
5. **优惠码促销稿面没有「促销名称 / 描述」输入框**:按稿隐藏，提交时用券码兜底 `coupon_name`。
6. **"Limit total number of uses" / "No expiry date"** 按稿实现:`total_count=0`=不限量，
   `valid_end=NULL`=不过期（复用 `valid_type`，不加列）。
7. **币种**沿用 availability 口径:整页只读（取范围内房型已配置币种），不做可切换假控件。
8. **统计卡多一张 Long Stay**（稿面只有三张），点击可切到对应 Tab —— 形状与令牌照稿。

## 7. 验收

| 项 | 结果 |
|---|---|
| `merchant-web npm run build`（vue-tsc + vite） | ✅ 零 TS 报错 |
| `cd client-app; npm run typecheck` | ✅ 零报错 |
| `node merchant-web/scripts/check-promotions-figma.mjs` | ✅ **199/199 GREEN**（真实 SSR 渲染 6 个组件 + 3 个页面壳 + 30 枚图标 path 逐字 + 令牌与字体断言） |
| 容器内 `php -l`（4 个改动 PHP + routes） | ✅ 全部通过 |
| 迁移幂等 | ✅ 09 与菜单迁移均重复执行无报错 |
| 迁移落库 | ✅ 7 个新列 + 5 个 campaign 列 + 2 张新表 + 4 条菜单行 + 授权行 |
| 网关新模块 | ✅ `/api/v1/merchant/campaigns/*` 返回 401（非 404） |
| 埋点 upsert 语义 | ✅ 同日同来源 2 次上报（3 + 2）→ 1 行，累计 5 |
| 效果分析 SQL | ✅ 演示数据下:曝光 28,356 / 领券 108 / 核销 54 / 收益 1,235,000 MMK / 商户出资 310,550 / ROI 3.98 |

`scripts/check.ps1` 本机仍跑不了（未装 PHP，第 1 步即断，与本次改动无关）；
新校验脚本**未接进** `check.ps1`，需手动 `cd merchant-web && node scripts/check-promotions-figma.mjs`。

## 8. 联调演示数据（`test/adhoc/m8-promotion-demo.sql`）

开发库没有已知密码的商户账号，为让页面可见真实数据，新增一次性 fixture:
11 条促销（覆盖四个 Tab，含稿面的 WELCOME26 / VIP5000 / SUMMER20 / LOYALTY10 / NEWYEAR 与
Early Bird / Stay 3 Nights 卡片样例）、108 行曝光、108 条领券、54 条结算流水、2 个平台活动
（定向邀请 + 公开报名各一）、5 条券码镜像。**不登记 initdb、不被 `test/apply.sh` 导入**，
可重复执行（先按 `[M8 Demo]` 记号清理再插入）。

## 9. 未做 / 后续

- ⚠ **没有登录态浏览器走查**:本环境无浏览器自动化工具，开发库也没有已知密码的商户账号，
  因此新接口未做端到端实测，只做了「容器内 lint + SSR 真实渲染断言 + 库内 SQL 旁证」三重验证。
  建议开局后人工对一次图（`/promotions` 四个 Tab、`/campaigns`、`/promotions/analytics`）。
- admin-web 的**平台活动「出资模式 / 参与资格 / 条款 / 参与方式」表单未做**（后端已接收这五个入参），
  平台运营目前只能通过接口或改库配置。
- 商户自建促销**固定商户全额出资**；「平台出资 / 共担」目前只来自平台活动。
  若要让商户自建促销也能申请共担，需要一条平台审批链（数据字段已具备）。
- 长住促销目前只落到「券 + 最少晚数」，尚未与房量价格页的 `minStay` 联动校验。
- 曝光只接了「促销中心列表 / 券详情 / 活动横幅」，首页静态促销卡未接。
