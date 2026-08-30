# Consumer App PRD v1.0 实现方案

> 需求基准:`设计文档/mTrip_ Consumer App PRD_v1.0.md`(**本 PRD 为唯一真需求**)
> 与旧文档关系:最初三份 docx 仅为框架期设计;现有 8 服务 / 54 表 = **可复用的供给侧底座 + 框架能力**,不是产品终态。
> 配套:差距逐项对照见 [差距分析-ConsumerApp-PRDv1.0.md](./差距分析-ConsumerApp-PRDv1.0.md)。
> 范围:本方案覆盖 **数据结构 / 后端应用 / 业务逻辑 / 管理端配置**;client-app 移动端作为 API 消费方,不在本方案展开。
> 状态:待评审 | 编写:2026-08-01

> 2026-08-30 admin-web 动态主题/公共资源补充：`views/cops/theme/index.vue` 的主题资源编辑由 JSON 文本框改为控件化编辑，弹窗 1180px、资源区一行三列；缩略图接入公共资源弹窗选择/上传。system-service 补文件树/上传/目录新增/目录删除接口和 `sys_file_dir`，`FileResourceManager` 支持图片、文档、视频、音频资源，`FileResourcePicker` 支持单选/多选及不限/仅图片/仅视频/图片+视频等类型限制；存储配置新增阿里云 OSS driver=`aliyun` 与 endpoint；接口仍提交兼容的 `assets` 对象。PHP lint、`npm run build`、compose config 通过，本地迁移和服务重建已执行。

---

## 1. 重新定基(Re-baseline)

PRD 是一款**缅甸 C 端酒店预订超级 App**。现有系统是**商户/供应商供给侧 OTA 后台**。二者关系不是"改造",而是:

```
供给侧(已建,复用)                     消费侧(本方案要建)
merchant/supplier/goods 后台   ── 供给 ──▶  C 端搜索/详情/选房/下单/预订管理
goods_daily_stock 库存日历                  钱包 / 券 / 长住 / 评价 / 收藏 / 常旅客
finance 结算/提现                           推荐返利 / 通知 / 风控申诉 / 动态主题 / 客服
```

**设计原则**
1. **复用底座**:多站点隔离、RBAC、JWT(`aud=app`)、AES 加密、统一响应、双前缀网关、Docker——不重建。
2. **供给侧微调、消费侧新建**:酒店/房型/库存/退改规则表基本可用(加双价即可);PRD 特有实体全部新建。
3. **优先扩展既有服务**,通知/客服两个新域先并入 system/user,规模化后再拆独立服务。
4. **货币 = MMK**:`DECIMAL(12,2)` 保留但业务按整数缅币展示;站点级 `currency` 已有(`sys_site_config`)。
5. **缅甸公民双价贯穿全链**:搜索/详情/下单/确认按 `isCitizen` 取价(PRD 反复强调)。

---

## 2. 目标数据模型全景

按"复用 / 改造 / 新建"三态列出(均 `mtrip_business` 库,标准列省略):

| 域 | 复用(不动) | 改造(加列) | 新建 |
|---|---|---|---|
| 商品/酒店 | `goods_info`/`hotel_room_type`/`ticket_type`/`goods_daily_stock`/`goods_refund_rule` | 房型+`base_price_citizen`;日历+`price_citizen` | `goods_review` 评价、`goods_filter_config`/`goods_sort_config` 可配置筛选排序 |
| 订单 | `order_verify_log` | `order_main`+`trip_id`/`platform_fee`/`is_citizen`/`alloc_coupon_discount`/`guests JSON`;`order_refund`+`refund_channel` | `order_trip`(M4 多酒店) |
| 用户/资产 | `user_info`(有 balance)/`user_balance_log`/`user_member_level` | `user_info`+`user_status` 扩风控态 | `user_wallet_account`(可选,先复用 balance)、`user_traveler`、`user_favorite`、`user_fraud`、`user_appeal`、`user_referral` |
| 营销 | `marketing_coupon(_receive)`/`marketing_banner`/`marketing_points_rule` | `marketing_coupon`+`funding_source`/`funding_rules` | `marketing_longstay_tier`、`marketing_campaign`(促销中心落地页) |
| 财务/结算 | `finance_flow`/`finance_merchant_settle`/`finance_withdraw` | — | `finance_account_entry` 会计分录(出资分账) |
| 通知(新域) | 复用 `sys_sms_*` | — | `notify_template`、`notify_record` |
| 客服/聊天(新域) | — | — | `chat_conversation`、`chat_message` |
| App 配置 | `sys_site_config` | — | `app_theme` 动态主题 |

字段级草案见差距分析 §3.B;本方案对 **M0/M1 关键表**给出建表级 DDL(§5)。

---

## 3. 服务拓扑

沿用 8 服务双前缀,新增职责如下(端口不变):

| 服务 | 端口 | 本方案新增 C 端职责 |
|---|---|---|
| user-service | 9502 | 钱包、常旅客、收藏、推荐、风控申诉、C 端资料 |
| goods-service | 9503 | 搜索/筛选/详情(双价+评价聚合)、长住列表、评价读写 |
| order-service | 9504 | 下单增强(券/长住/双价/多住客)、支付、确认、取消、退款到钱包、平台费 |
| marketing-service | 9507 | 促销中心、My Coupons、领券/自动择优、长住梯度、券出资配置 |
| finance-service | 9506 | 出资分账、会计分录、结算按分摊后金额 |
| payment-service | 9508 | 正式 Stripe/PayPal 收单(替换 order mock) |
| system-service | 9501 | 动态主题、通知模板(暂挂此)、站点/App 配置 |
| **notification(建议新增或并入 system)** | — | 多渠道通知触发与记录、客服/聊天 |

> 是否新增 `notification-service` 由 M3 决定;M0/M1 先把通知触发点以事件形式埋在各服务,记录落 `notify_record`。

---

## 4. 里程碑(交付驱动)

每里程碑独立可上线,交付即跑 `scripts/check.ps1` 并同步 `docs/plans/`+README+HANDOFF。PRD 的 Acceptance Criteria(§Acceptance)即验收基线。

### M0 地基对齐(2 项硬底座,阻塞后续)
- **钱包域正式化**:确定"仅退 mTrip 钱包"的资金模型——退款/返利/取消退回统一入 `user_info.balance` + `user_balance_log`,行锁 + 前后快照;`finance_flow` 记平台托管↔钱包。
- **缅甸双价 + MMK 基座**:房型/日历加 `*_citizen` 价列;下单/详情/搜索统一 `isCitizen` 取价函数(放 goods-service 公共方法,order 下单复用)。
- **签名链路**:启用网关 `ClientSignMiddleware`(HANDOFF 08 已备),C 端联调打通。
- 验收:退款到钱包可跑通(先用现有退款确认接口改目的地);双价在详情/下单一致。

### M1 核心预订闭环(MVP 心脏)
对齐 PRD 模块 2/3/4/5/6/9/11:
- **搜索/筛选/排序**:`goods list` 增可配置筛选(价格/星级/设施/免费取消/到店付/评分)与排序项(低价/高价/距离/星级/好评),配置读 `goods_filter_config`。
- **详情/选房**:详情聚合评价评分摘要 + 房型双价 + 退改策略;`goods_review` 读接口。
- **住客信息**:下单接受 `travelers[]`(Lead Guest 默认取用户资料),可从 `user_traveler` 带入;落 `order_main.guests JSON`。
- **定价**:下单接受 `couponId` + 自动长住折扣(按住宿夜数命中 `marketing_longstay_tier` 最高档)+ 双价;价格明细 = 原价 − 长住 − 券 = 实付。
- **支付**:接 payment-service 正式渠道(或保留 mock 开关);支付成功 → 状态 Confirmed + 生成 voucher/核销码 + 触发确认通知(记录到 `notify_record`)。
- **预订管理/取消/退款**:我的预订列表/详情;取消选原因 → 按退改规则算可退 → **扣平台费(convenience fee,仅取消时收)** → 退回钱包;待支付超时自动取消并释放库存。
- 验收:PRD §Acceptance 的 Hotel Bookings 全条(search<3s、filter、details、voucher、cancellation→refund)。

### M2 促销与用户资产
对齐模块 6.1/7/14:
- 促销中心落地页(`marketing_campaign`)+ My Coupons(领取/我的/自动择优 best-match)。
- 收藏(`user_favorite`)增删查。
- 评价写入(离店后可评,触发催评通知)+ 商户回复审核(admin)。
- 推荐返利(`user_referral`:注册预填码 → 绑定 → 首单达成 → 奖励入钱包)。

### M3 运营与风控
对齐模块 8/10/10.1/13/15:
- 通知中心多渠道(`notify_template` + 事件矩阵:确认/取消/催评)+ C 端通知列表/已读。
- 结算出资分账(`funding_source` → `finance_account_entry`,PRD 五个 Settlement Scenario 为用例)。
- 风控与申诉(`user_fraud` 规则引擎 + `user_appeal` 队列 + 分级 Warning/Suspend/Ban)。
- 动态主题(`app_theme`,C 端 `theme/active`,priority + 时段 + 失效回退)。
- 在线客服/酒店聊天(`chat_*`,机器人 FAQ + 转人工 + 会话评分)。

### M4 Trip 多酒店 / Phase2 — 进行中
- [x] **M4 Trip 多酒店**(check.ps1 四步全绿,架构级 A2):新表 `order_trip`(compose 96;`order_main.trip_id/alloc_coupon_discount` M0 已预留);抽出 `order-service PricingService`(长住/券校验/住客归一化,`OrderController` 已重构复用,消除重复)。`TripController`:
  - `create`:1-10 个酒店项,逐项锁库存(双价)+ 长住,得各项净额;整单券按净额**占比分摊**(末项吸收余数,Σ=券额)落各 `alloc_coupon_discount`;建 `order_trip` + N 个 `order_main`(trip_id 关联,状态待支付)。
  - `pay`:**单笔支付**确认整单下所有预订(逐个 verifyCode/扣库存/`recordBooking` 结算分录),整单券消耗一次,确认通知一次。
  - `detail`(主单+各预订按入住日)/`list`。
  - 各预订沿用既有独立取消/退款/结算生命周期(退款按 `pay_amount`=分摊后净额,天然正确)。
- 已知边界:本期仅酒店;预订失败补偿为结构化占位(mock 支付不触发);Trip 支付未接推荐返利(单单路径仍支持),留待与正式支付一并补。

### Admin 管理端(后端+菜单先行,Vue 页面后续专项)
- [x] **Admin 后端 + 菜单种子**(check.ps1 四步全绿):新增 C 端运营/风控后台接口(#[Permission] 键与菜单种子 perm_key 对齐),新建一级菜单 **移动运营(1300)** 8 页面(component 无 Vue → 回退 wip):
  - 风控申诉(user-service `AdminRiskController`):`/admin/user/appeal/list|handle`、`/admin/user/fraud/list`——处理动作 1通过解冻/2驳回维持/3升级封禁。
  - 客服工作台(user-service `AdminChatController`):`/admin/chat/list|messages|reply|close`(坐席 sender_type=2)。
  - 评价审核(goods-service `AdminReviewController`):`/admin/goods/review/list|audit|reply`。
  - 长住梯度(marketing-service `LongstayController`):`/admin/marketing/longstay/list|save|delete`。
  - 券出资(marketing-service `CouponController`):add/update 增收 `fundingSource`/`fundingRules`。
  - 动态主题(system-service `ThemeController` admin):`/admin/config/theme/list|save|delete`。
  - Trip 管理(order-service `AdminTripController`):`/admin/order/trip/list|detail`。
  - 结算分账报表(finance-service `AccountEntryController`,只读):`/admin/finance/entry/list|summary`。
- [x] **admin-web Vue 页面**(cops/* 8 页,check.ps1 四步全绿):`api/cops.ts` 统一接口模块 + `views/cops/{appeal,fraud,review,longstay,theme,chat,trip,entry}/index.vue`;沿用 `useTable`/`PageContainer`/`v-perm`/`SiteTreeSelect` 房式,`#bodyCell` 用具名脚本助手(`isAmt`/`fmt`)规避 union 类型;router `import.meta.glob('../views/**/*.vue')` 自动收录,菜单 component 命中真实页面(不再回退 wip)。标签用中文直出(未接 i18n 词条,后续可补)。

### Phase2 / 收尾
- AI 助手、旅行保险(PRD 明示不在首发)。

## 收口:PRD 覆盖矩阵(2026-08-02,全程 check.ps1 四步全绿)

| PRD 模块 | 状态 | 落地位置 |
|---|---|---|
| 1 预订生命周期 / 9 确认取消退款 / 11 平台费透明 | ✅ | M0/M1(order 下单-支付-取消-退款钱包-便民费) |
| 1.1 多酒店 Trip(A2) | ✅ | M4(TripController 单支付拆多单+券占比分摊) |
| 2.1 长住 Long-Stay | ✅ | M1(取价)+ admin 梯度配置 |
| 3 列表/筛选/排序 | ✅ | C 端价格/星级/设施/含早/免费取消/评分筛选 + 低价/高价/星级/好评/距离排序;`/app/goods/filters` 可配置项 + admin 筛选排序配置(goods_filter_config/goods_sort_config) |
| 4 详情/选房 + 双价 + 评价 | ✅ | M0 双价 / M1-b 评价 + admin 审核 |
| 4.1 与酒店聊天 / 13 客服 | ✅ | M3-e + admin 客服工作台 |
| 5 住客信息 / 7 常旅客·收藏 | ✅ | M1 多住客 / M1-b 常旅客 / M2-a 收藏 |
| 6.1 促销中心 / My Coupons / 自动择优 | ✅ | M2-b(领券中心/My Coupons/best-match)+ 促销活动 `marketing_campaign`(C 端 `/app/marketing/campaigns`+detail,含关联可领券;admin CRUD + cops/campaign 页) |
| 8 结算出资分账(A3) | ✅ | M3-d + admin 分账报表 |
| 10 通知中心 | 🟡 | M3-a 站内信 + 事件触发;**Push/SMS/Email 多渠道分发**待接第三方 |
| 10.1 风控与申诉 | ✅ | M3-c + admin 申诉处理/风控看板 |
| 14 推荐返利 | ✅ | M2-c |
| 15 动态主题 | ✅ | M3-b + admin 主题 CRUD |
| 缅甸公民双价 | ✅ | M0 贯穿搜索/详情/下单 |
| 退款钱包化(A1) | ✅ | M0(三项架构级 A1/A2/A3 全部落地) |
| 12 AI 助手 / 6 旅行保险 | ⏸ | PRD 明示 Phase2,不在首发 |

## 遗留清单(非首发关键路径,按需再排)

1. ~~Module 3 后台可配置筛选/排序项~~ ✅ **已完成**(2026-08-02):`goods_filter_config`/`goods_sort_config`(seed 默认项,compose 97)+ `GoodsController` list 加 价格区间/设施(JSON_CONTAINS)/含早/免费取消/评分下限 筛选 + price_asc/desc·star·rating·distance 排序 + `GET /app/goods/filters` 可配置项;admin `AdminFilterController`(filter/sort CRUD,键受白名单约束)+ 菜单 1309 筛选排序配置 + admin-web `cops/filter` 双 Tab 页。待 check.ps1。
2. **通知多渠道分发**:Push(FCM/APNs)/SMS/Email + 模板本地化——需第三方选型与授权。
3. **正式支付渠道**:Stripe/PayPal 收单替换 mock——需授权;当前 payment-service 为渠道抽象。
4. **Trip 预订失败补偿**:结构化占位待正式支付一并补。~~Trip 支付接推荐返利~~ ✅ 已完成(2026-08-02):抽出 `ReferralService`(OrderController 已重构复用),`TripController::pay` 首单达成发放。
5. **cops/* 页面 i18n 词条**(现中文直出)。~~住客 guests PII 加密~~ ✅ 已完成(2026-08-02):create/Trip 下单整块 AES 加密存 `order_main.guests`,order detail 解密 + 手机/邮箱脱敏。~~admin 促销中心落地页编辑器~~ ✅(marketing_campaign)。
6. **Phase2**:AI 助手、旅行保险。

---

## 5. M0/M1 建表级 DDL(可直接执行)

> 放 `database/` 对应服务目录并入 `docker-compose` 编号挂载;新增列用 `ALTER TABLE`。

```sql
USE `mtrip_business`;
SET NAMES utf8mb4;

-- [M0] 房型双价 + 日历双价
ALTER TABLE `hotel_room_type`
  ADD COLUMN `base_price_citizen` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '缅甸公民门市价' AFTER `base_price`;
ALTER TABLE `goods_daily_stock`
  ADD COLUMN `price_citizen` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '当日公民价' AFTER `price`;

-- [M1] 订单增强(双价/平台费/多住客/券分摊/Trip 预留)
ALTER TABLE `order_main`
  ADD COLUMN `trip_id`               BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Trip主单ID,0=独立单' AFTER `user_id`,
  ADD COLUMN `is_citizen`            TINYINT      NOT NULL DEFAULT 0 COMMENT '是否公民价:0否1是' AFTER `order_type`,
  ADD COLUMN `longstay_discount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '长住优惠额' AFTER `discount_amount`,
  ADD COLUMN `alloc_coupon_discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Trip券分摊到本单额' AFTER `coupon_discount`,
  ADD COLUMN `platform_fee`          DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台费(取消时扣)' AFTER `pay_amount`,
  ADD COLUMN `guests`                JSON         NULL COMMENT '住客名单[{firstName,lastName,phone,email}]' AFTER `contact_phone`;

-- [M0] 退款目的地(钱包/原路)
ALTER TABLE `order_refund`
  ADD COLUMN `refund_channel` TINYINT NOT NULL DEFAULT 1 COMMENT '退款渠道:1mTrip钱包 2原路' AFTER `refund_amount`;

-- [M1] 长住折扣梯度(可配置)
CREATE TABLE IF NOT EXISTS `marketing_longstay_tier` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `min_nights`    INT          NOT NULL DEFAULT 7 COMMENT '最低住宿夜数',
  `discount_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '折扣率%(30=减30%)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_site_nights` (`site_id`, `min_nights`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='长住折扣梯度表';

-- [M1] 常旅客(证件加密)
CREATE TABLE IF NOT EXISTS `user_traveler` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`        BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `nationality`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '国籍',
  `first_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '名',
  `last_name`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '姓',
  `id_type`        TINYINT      NOT NULL DEFAULT 2 COMMENT '证件:1NRC 2护照 3其他',
  `id_no`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '证件号(AES加密)',
  `id_expire_date` DATE         NULL DEFAULT NULL COMMENT '证件到期日',
  `is_default`     TINYINT      NOT NULL DEFAULT 0 COMMENT '默认:0否1是',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`     DATETIME     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`site_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='常旅客表';

-- [M1] 酒店评价
CREATE TABLE IF NOT EXISTS `goods_review` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`      BIGINT UNSIGNED NOT NULL COMMENT '酒店商品ID',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `order_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联订单ID',
  `rating`        TINYINT      NOT NULL DEFAULT 5 COMMENT '评分1-5',
  `content`       VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '评价内容',
  `images`        JSON         NULL COMMENT '图片',
  `reply_content` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '商户回复',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:0待审 1显示 2隐藏',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_goods_status` (`site_id`, `goods_id`, `status`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='酒店评价表';

-- [M2] 收藏(M1 可选前置)
CREATE TABLE IF NOT EXISTS `user_favorite` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `goods_id`   BIGINT UNSIGNED NOT NULL COMMENT '酒店商品ID',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_goods` (`user_id`, `goods_id`),
  KEY `idx_site_id` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户收藏酒店表';
```

---

## 6. 核心业务:下单→支付→退款(M1 关键改造)

**下单 `POST /api/v1/app/order/create`(改造 `OrderController::create`)**
1. 新入参:`couponId?`、`isCitizen`、`travelers[]`、(酒店)`checkIn/checkOut`。
2. 取价:按 `isCitizen` 从 `goods_daily_stock.price[_citizen]` 逐日汇总 → `original`。
3. 长住:`nights = checkOut−checkIn`,命中 `marketing_longstay_tier` 最高档 → `longstay_discount`。
4. 券:校验 `marketing_coupon_receive`(归属/未用/在有效期/门槛)→ `coupon_discount`(封顶 max_discount)。
5. `pay_amount = original − longstay_discount − coupon_discount`;写 `order_main`(含 `is_citizen/guests/各优惠额`),券置"锁定",库存 `lock`。
6. **平台费不在下单收**(PRD 模块11),`platform_fee=0`。

**支付成功回调(payment-service → order)**
- 状态 → Confirmed;`stock deduct`;券置"已用";生成 voucher/核销码;埋点 `booking_confirmed` → `notify_record`(Push/InApp/SMS/Email)。

**取消退款 `POST /api/v1/app/order/cancel`+退款确认**
1. 按 `goods_refund_rule` 阶梯算 `refundable`;
2. **扣平台费**:`platform_fee`(仅用户主动取消时,按策略);`refund = refundable − platform_fee − 酒店取消费`;
3. `refund_channel=1`:事务内 `user_info.balance += refund`(行锁+快照写 `user_balance_log change_type=3`)+ `finance_flow`(平台托管→钱包);
4. 状态 → Cancelled/Refunded;释放库存;埋点 `booking_cancelled` 通知。

**幂等/并发**:支付回调按 `pay_trade_no` 幂等;钱包与库存均行锁事务;退款单 `uk_refund_no` 防重。

---

## 7. 管理端(admin-web)配套

每个 C 端能力对应后台配置/审核页(路由 `/api/v1/admin/*` + `#[Permission]` + 菜单种子 perm_key 对齐 + 页面目录与菜单 `component` 一致):
- 长住梯度配置、券出资来源配置、促销中心/落地页管理;
- 评价审核与回复、筛选/排序项配置;
- 通知模板(多语言+变量)、风控阈值与申诉队列、动态主题(草稿/排期/预览);
- 客服工作台(会话/转人工)。

多语言按现有 vue-i18n 约定(en-US 全量源 + 菜单三字段),缅语作为新增语言包接入(前端加包 + SUPPORTED_LOCALES,后端零改)。

---

## 8. 里程碑与风险小结

| 里程碑 | 交付 | 阻塞/风险 |
|---|---|---|
| M0 | 钱包资金模型、双价基座、签名链路 | **资金模型需财务口径签字** |
| M1 | 核心预订闭环(MVP 心脏) | payment 正式渠道选型与授权;退改/平台费策略确认 |
| M2 | 促销中心/收藏/评价/推荐 | 促销落地页是内嵌 Web,需前端方案 |
| M3 | 通知/分账/风控/主题/客服 | 是否拆 notification-service;Push/Email 第三方 |
| M4 | Trip 多酒店/AI/保险 | Trip 需可行性评估;Phase2 |

**外部依赖(需另行授权)**:Stripe/PayPal 正式收单、护照 OCR、Push(FCM/APNs)、Email、短信渠道。

---

## 9. 建议起步

推荐从 **M0 + M1 打通"单酒店预订闭环"** 开始(PRD MVP 的心脏,直接对齐 Acceptance Criteria 的 Hotel Bookings 全条)。M0 中 **钱包资金模型**需先与财务口径确认后再落 DDL。

> 下一步可选:①先出 **M0 落地级方案**(迁移 SQL + 钱包读写公共方法 + 退款确认改造 + 回归用例);或 ②直接从 **M1 下单增强**切入(双价+券+长住+多住客),按上方 §5/§6 编码。请指定起点。

---

## 10. 实施进展(dev 分支)

### M0 地基 — 进行中
- [x] 双价列迁移:`database/goods/02-consumer-dualprice.sql`(`hotel_room_type.base_price_citizen`、`goods_daily_stock.price_citizen`)。
- [x] 订单增强迁移:`database/order/03-consumer-booking.sql`(`order_main` +trip_id/is_citizen/longstay_discount/alloc_coupon_discount/platform_fee/guests;`order_refund` +refund_channel)。
- [x] compose 挂载:`deploy/docker-compose.yml` 新增 80/81 增量迁移(基础表后、种子前)。
- [x] **退款钱包化**:`order-service` `AdminRefundController::confirm` 改造——`refund_channel=1` 事务内入 `user_info.balance`(行锁+前后快照写 `user_balance_log change_type=3`),`=2` 保留原路(需第三方流水号);`finance_flow` 补 user_id、钱包退款 pay_channel=0。
- [x] 验收:`scripts/check.ps1` 四步全绿(2026-08-01:php -l 234 文件 0 错误 / shared 47 用例 723 断言全过 / admin-web build 零 TS 报错 / client-app typecheck 通过)。
- [ ] 缅甸双价取价函数(goods-service 公共方法,详情/下单复用)—— 待 M1 一并落。
- [ ] 网关 `ClientSignMiddleware` 启用 —— 部署期开关(shared 已有实现 + 7 条单测跑绿,底座就绪)。

> 说明:docker init 仅首次建库执行迁移,既有运行库需手动 source 增量 SQL(ADD COLUMN 非幂等,已在文件头注明)。

### M1 核心预订闭环 — 进行中
- [x] **M1-a 下单增强**(`order-service`,check.ps1 四步全绿):
  - 双价取价:`OrderStockService::lock` 加 `isCitizen` 参数,`price_citizen>0` 取公民价否则回退 `price`;补建日历行同时写 `price_citizen`。
  - 长住优惠:`OrderController::longstayDiscount` 命中站点 `marketing_longstay_tier` 最高档,按原总价打折(仅酒店)。
  - 优惠券:`OrderController::resolveCoupon` 校验归属/状态/有效期/适用范围/门槛并算抵扣(满减/无门槛直减、折扣券按折扣率+封顶);下单只预留不消耗,`pay()` 成功时置领券记录已用 + 模板 used_count+1。
  - 多住客:`travelers[]` 归一化落 `order_main.guests(JSON)`;下单返回 `priceDetail{original,longstayDiscount,couponDiscount,payAmount}`。
  - 新表:`marketing_longstay_tier`、`user_traveler`(compose 82/83 挂载)。
- [x] **M1-b 常旅客 + 公民价展示 + 评价**(`user-service`/`goods-service`,check.ps1 四步全绿):
  - 常旅客 CRUD:`TravelerController`(list/add/update/delete),证件号 AES 加密存储、`MaskHelper::idCard` 脱敏,is_default 互斥;OCR 在客户端/第三方,后端只收解析后字段。
  - 公民价展示:`goods calendar` 输出 `priceCitizen`(回退 price);`detail`/`list` 输出 `minPriceCitizen`(房型 base_price_citizen>0 取最低,门票/无价回退外国人价);详情房型 SKU 直带 `base_price_citizen`。
  - 评价:新表 `goods_review`(compose 84 挂载);`detail` 附 `reviewSummary{count,avgRating}`;`GET /app/goods/reviews` 公开分页(join 昵称/头像);`POST /app/goods/review/add`(UserAuthMiddleware,仅本人 order_status∈{2,3} 酒店订单、每单限一次)。
- [x] **M1-c 退款透明 + 平台便民费**(`order-service`,check.ps1 四步全绿):
  - `GET /app/order/refund/quote`:取消页透明展示 `{payAmount, refundable, cancellationFee, platformFee, refundAmount, refundChannel=mTrip钱包}`。
  - `computeRefund`:按 `goods_refund_rule`(SKU 级优先商品级;1免费取消/2阶梯/3不可退)算可退额,`stepRefundable` 按距入住剩余小时命中最优档;再扣平台便民费。
  - 平台费:`platformFeeRate` 读 `sys_site_config.platform_fee_rate`(system 连接,百分比,未配=0),仅对可退额收(结账不收,符合 PRD 模块11)。
  - `applyRefund` 改为按净额建退款单(refund_channel=1 钱包、refund_type 全/部分自动判定),并把 platform_fee 落 order_main;不可退(净额≤0)明确拒绝。

**M1 核心预订闭环 = 已完成**(M1-a/b/c 全绿)。

### M2 促销与用户资产 — 进行中
- [x] **M2-a 收藏(Saved Hotels)**(`user-service`,check.ps1 四步全绿):新表 `user_favorite`(compose 85);`FavoriteController` list(join goods 输出图/名/位置/星级)/add(幂等 insertOrIgnore)/remove(按 goodsId)。
- [x] **M2-b 促销中心/My Coupons**(`marketing-service`,check.ps1 四步全绿):新增 C 端基类 `AppAbstractController` + `MarketingController`:`promotion/banners`(复用 marketing_banner 专题位)、`coupon/available`(领券中心,附本人已领数/可领判定,批量查避免 N+1)、`coupon/claim`(校验进行中/领满/个人限领,生成券码写领券记录 + received_count+1)、`coupon/my?type=available|used|expired`、`coupon/best-match`(自动择优,与 order 端 resolveCoupon 同规则算最高抵扣)。
- [x] **M2-c 推荐返利**(`user-service`+`order-service`,check.ps1 四步全绿):
  - 数据:`user_info.referral_code`(唯一,惰性生成)+ 新表 `user_referral`(绑定/奖励,invitee 唯一,compose 86)。
  - 注册绑定:`UserAuthService.register` 收 `referralCode`——生成本人推荐码(MT+userId36进制+随机),按码绑定推荐人(无效码拦截注册,PRD 模块14);`AuthController` 透传。
  - 我的推荐:`ReferralController` my(推荐码/邀请数/累计奖励)、invitees(邀请列表+奖励状态)。
  - 奖励发放:新增 `order-service WalletService`(统一钱包入账,退款确认已重构复用);`OrderController::pay` 在被推荐人**首个已支付酒店订单**达成时,按 `sys_site_config.referral_reward_inviter/invitee` 给推荐人+新人钱包入账并置 `reward_status=1`(0→1 保证仅首单发放)。

**M2 促销与用户资产 = 已完成**(a/b/c 全绿)。

### M3 运营与风控 — 进行中
- [x] **M3-a 通知中心**(check.ps1 四步全绿):新表 `notify_record`(compose 87);`order-service NotifyService`——`pay` 成功写 `booking_confirmed`、`applyRefund` 写 `booking_cancelled`(均事件后置 try 包裹,不阻断主流程);`user-service NotifyController` `/app/notify/list|unread-count|read`(单条/全部已读)。多渠道(Push/SMS/Email)与模板本地化留待接第三方。
- [x] **M3-b 动态主题**(check.ps1 四步全绿):新表 `mtrip_system.app_theme`(compose 88)+ 内置默认主题;`system-service` `SysTheme` 模型 + `ThemeController::active` 公开接口 `GET /api/v1/app/theme/active`(status=1+时段+优先级择一,无命中回退 is_default)。admin 主题 CRUD 与 admin-web 编辑器归后续 admin 专项。
- [x] **M3-c 风控与申诉**(check.ps1 四步全绿):新表 `user_fraud`/`user_appeal`(compose 89);`order-service FraudService.evaluateCancellation`——退款申请后按 `sys_site_config.fraud_cancel_threshold/window_days`(未配=不启用)统计近 N 天退款次数,超阈值升 level=2 并冻结账号(user_status=2,登录侧已拦截);`user-service AppealController` `/app/appeal/status|submit`(受限才可申诉、每次仅一条待审)。admin 风控看板/申诉队列处理归后续 admin 专项。
- [x] **M3-d 结算出资分账**(check.ps1 四步全绿,架构级 A3):`marketing_coupon` +`funding_source`/`funding_rules`(compose 93);新表 `finance_account_entry`(按订单结算分录,compose 94);`order-service SettlementService.recordBooking`——支付事务内按券出资方拆 mtrip/merchant/partner_pays,算 `merchant_settlement=order−commission−merchant_pays`、`platform_revenue=commission−mtrip_pays`(佣金率取 `sys_site_config.commission_rate` 未配=0),幂等(uk_order),并回填 order_main 佣金/商户实收。对齐 PRD 模块8 Campaign Expense Record。admin 结算报表取数归后续 admin 专项。
- [x] **M3-e 在线客服/酒店聊天**(check.ps1 四步全绿):新表 `chat_conversation`/`chat_message`(compose 95);`user-service ChatController` `/app/chat/faqs|conversations|start|messages|send|finish|rate`——type1 酒店咨询(target=酒店)/type2 客服(机器人即时应答,转人工/酒店回复由坐席端后续接入),会话复用进行中同目标、结束后可评分。坐席端/酒店回复写入归后续 merchant/admin 专项。

> M1-c 已知边界:①非全额退时管理端 `deduct_amount` 在审核环节按 apply-refund 重算(=0),便民费/取消费拆分展示留待管理端退款页专项;②已支付「不可退」订单的「取消但不退款」路径未覆盖(现直接拒绝退款申请),留待专项;③平台费率取站点配置,未做订单级豁免(如商户/系统原因取消不收,PRD 模块11 表)——按 PRD 仅用户主动取消收,商户/超时/系统取消场景在 M3 结算/异常流补齐。

> M1-a 已知边界:①券在支付时消耗、无待支付订单过期任务(order_status=7 未落地,库存锁与券预留同受影响,列为后续专项);②住客 `guests` 暂明文存于本人订单(仅本人 detail 可见),PII 加密留待专项;③长住梯度按站点配置,未做 site_id=0 全局兜底。
