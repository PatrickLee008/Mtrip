# Consumer App PRD v1.0 实现方案

> 需求基准:`设计文档/mTrip_ Consumer App PRD_v1.0.md`(**本 PRD 为唯一真需求**)
> 与旧文档关系:最初三份 docx 仅为框架期设计;现有 8 服务 / 54 表 = **可复用的供给侧底座 + 框架能力**,不是产品终态。
> 配套:差距逐项对照见 [差距分析-ConsumerApp-PRDv1.0.md](./差距分析-ConsumerApp-PRDv1.0.md)。
> 范围:本方案覆盖 **数据结构 / 后端应用 / 业务逻辑 / 管理端配置**;client-app 移动端作为 API 消费方,不在本方案展开。
> 状态:待评审 | 编写:2026-08-01

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

### M4 Phase2 / 高风险
- **Trip 多酒店**(单支付拆多单 + 券按占比分摊 + 按单结算/退款)——PRD 标注需可行性评估,独立设计。
- AI 助手、旅行保险(PRD 明示 Phase2)。

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
- [ ] M1-c:取消退款平台费(convenience fee,仅用户主动取消时从退款额扣)。

> M1-a 已知边界:①券在支付时消耗、无待支付订单过期任务(order_status=7 未落地,库存锁与券预留同受影响,列为后续专项);②住客 `guests` 暂明文存于本人订单(仅本人 detail 可见),PII 加密留待专项;③长住梯度按站点配置,未做 site_id=0 全局兜底。
