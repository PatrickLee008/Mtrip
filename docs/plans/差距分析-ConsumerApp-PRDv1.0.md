# Consumer App PRD v1.0 差距分析与改造技术方案

> 来源需求:`设计文档/mTrip_ Consumer App PRD_v1.0.md`(缅甸市场 C 端超级 App,酒店预订为核心)
> 对照对象:现有代码库(数据库 54 表 / backend 八服务 / C 端 20 余接口)
> 定位:本文件是**跨模块差距分析 + 改造方案**,不是单个 build 模块;实施拆分见文末「实施路线」。
> 编写时间:2026-08-01 | 状态:待评审(架构级三项需先签字确认再动工)

---

## 0. 总判断

现有项目是一套**中国式 OTA 电商 SaaS**(酒店+门票、商户/供应商/平台三方、优惠券/积分/核销/结算),按最初三份 docx 建成。本 PRD 是一份**产品定义层面不同**的新需求(钱包退款、Trip 多酒店、长住、常旅客、收藏、评价、聊天、推荐返利、风控申诉、动态主题、促销出资分摊、缅甸公民双价)。

| 层 | 满足度 | 结论 |
|---|---|---|
| 框架层(隔离/RBAC/JWT/加密/网关/部署) | 🟢 80% | 与产品无关的底座,PRD 任何模块通用,**不重建** |
| 数据结构 | 🟡 35% | 通用预订骨架可复用,PRD 特有实体整表缺失 |
| 后端应用(C 端接口) | 🔴 25% | 现只有 auth/user/goods/order 约 20 接口 |
| 业务逻辑 | 🔴 20% | 单商品下单闭环成立,核心业务(钱包退款/分账/长住/风控)未实现 |

**三项架构级改动(牵一发动全身,必须先设计后编码)**:
1. **退款目的地钱包化**——现走第三方退回(`order_refund.refund_trade_no`),PRD 强制"仅退 mTrip 钱包"。影响 order + finance + user 三服务的资金链。
2. **Trip 多酒店:单支付拆多笔独立预订 + 优惠券按占比分摊**——现 `order_main` 是单商品单订单。影响下单/支付/退款/结算全链。
3. **促销出资方分摊(mTrip/商户/合作方)进结算引擎**——现 `marketing_coupon` 无出资字段,结算无分账分录。影响 marketing + finance + order。

---

## 1. 逐模块差距对照(15 模块)

状态标记:🟢 满足 / 🟡 部分 / 🔴 缺失 / ⚪ 本期不做(PRD 明示 Phase2)

| PRD 模块 | 状态 | 现状锚点 | 核心差距 |
|---|---|---|---|
| 1 预订生命周期 | 🟡 | `order_main` 状态机 0~7;`OrderController::create/pay/cancel` | 单商品单订单,无 Trip |
| 1.1 多酒店 Trip | 🔴 | 无 | 无 trip 表/分组/拆单/分摊/按单结算 |
| 2.1 长住 Long-Stay | 🔴 | `marketing_*` 仅满减/折扣/秒杀 | 无按住宿天数的折扣梯度配置与计算 |
| 3 列表/筛选/排序 | 🟡 | `goods list`(关键词/分类/星级/排序) | 筛选/排序项需**后台可配置**;缺评分/免费取消/到店付等维度 |
| 4 详情/选房 | 🟡 | `goods detail` + 房型齐全 | **无评价评分**;缺 360/早餐取消策略等展示项 |
| 4.1 与酒店聊天 | 🔴 | 无 | 无会话/消息/FAQ |
| 5 入住人信息 | 🔴 | 订单仅 `contact_name/phone` 单联系人 | 无多住客名单、无常旅客带入 |
| 6 价格/促销/保险 | 🟡 | 券模板+领券记录 | **下单接口不接受 couponId**;保险 ⚪Phase2 |
| 6.1 My Coupons/促销中心 | 🟡 | 领券/用券数据模型 | 缺促销中心落地页、自动择优用券、活动浏览/领取接口 |
| 7 常旅客(护照扫描) | 🔴 | 无 | 无 traveler 表(护照/NRC/到期日)、无 OCR |
| 7 收藏酒店 | 🔴 | 无 | 无收藏表与接口 |
| 7 Lite Mode | ⚪ | — | 移动端 UI 呈现层,不在后端评估范围 |
| 8 支付/结算(出资分摊) | 🔴 | `finance_merchant_settle` 商户结算单 | 无出资分摊/佣金分账/会计分录 |
| 9 确认/管理/取消 | 🟡 | 取消+退款单+阶梯退改 | **退款走第三方非钱包**;缺商户拒单异常流 |
| 10 通知中心 | 🔴 | 仅 `sys_sms_*` | 无 Push/In-App/Email 多渠道模板与事件触发 |
| 10.1 风控与申诉 | 🔴 | `user_status` 仅正常/冻结/注销 | 无 fraud score/分级/申诉/规则引擎 |
| 11 平台费透明 | 🔴 | `order_refund.deduct_amount`(退改扣费) | 无"取消才收 convenience fee"策略与展示 |
| 12 AI 助手 | ⚪ | — | PRD 明示 Phase2 |
| 13 在线客服 | 🔴 | 无 | 无客服会话/机器人/转人工/评价 |
| 14 推荐返利 | 🔴 | 无 | 无 referral code/绑定/奖励发放 |
| 15 动态主题 | 🔴 | 无 | 无 theme 表(草稿/排期/优先级/时段) |
| 跨模块 缅甸公民双价 | 🔴 | 房型/库存单一价 | 无 citizen/foreigner 双轨定价 |

---

## 2. 可复用资产(不重建)

- **框架能力**:多站点隔离(`site_id` + `AdminContext`/`UserContext`)、RBAC 注解、JWT(`aud=app` 校验)、AES-256-GCM 字段加密+脱敏、统一响应/错误码、OpenResty 双前缀网关、Docker 编排。
- **通用预订骨架**:`goods_info/hotel_room_type/goods_daily_stock`(分时库存价格日历)、`OrderStockService`(锁定/扣减/释放/回补)、订单状态机、`goods_refund_rule`(阶梯退改)、`marketing_coupon(_receive)`、积分体系、`finance_merchant_settle`+提现。
- **钱包雏形**:`user_info.balance` + `user_balance_log`(已含 `change_type=3 退款`)——PRD 钱包退款/返利入账在此扩展,不从零建。

---

## 3. 改造技术方案

> 约定沿用现有工程惯例:表全部 `mtrip_business` 库、含标准列(`site_id`/`created_at`/`updated_at`/`deleted_at`)、`utf8mb4_bin`、金额 `DECIMAL(12,2)`、软删除;C 端接口挂 `/api/v1/app/{模块}/*` + `UserAuthMiddleware`,管理端 `/api/v1/admin/{模块}/*` + `AdminAuthMiddleware`,写接口加 `#[Permission]` 且键对齐 `database/seed/02-menu.sql`;新服务用骨架复制法(见 HANDOFF 第6节),但**本方案优先扩展既有服务,尽量不新增服务**。

### 3.A 架构级三项(P0,先设计签字)

#### A1 退款钱包化

- **数据**:`order_refund` 增 `refund_channel TINYINT`(1钱包 2原路,默认1);新增 `finance_wallet_flow`(或复用 `user_balance_log`,推荐直接复用,`change_type=3 退款`)。平台费落地:`order_main` 增 `platform_fee DECIMAL(12,2)`。
- **业务**:退款审核到账那一步(现 `AdminRefundController::confirm`),从"调第三方退款"改为**入账用户钱包**——事务内 `user_info.balance += refund_amount` + 写 `user_balance_log`,并写 `finance_flow`(`biz_type=2 订单退款`,资金从平台托管→用户钱包)。
- **影响面**:`order-service`(退款确认)、`user-service`(钱包读写需暴露内部方法或经 DB 直写,注意跨库同为 `mtrip_business` 可直查)、`finance-service`(流水口径)。
- **风险**:钱包余额并发一致性——必须行锁 `SELECT ... FOR UPDATE user_info` + 前后余额快照(`before_balance/after_balance` 已有字段)。

#### A2 Trip 多酒店(单支付拆多单 + 券按占比分摊)

- **数据**:新增 `order_trip`(Trip 主单:`trip_no`/`user_id`/`total_amount`/`coupon_id`/`coupon_discount`/`pay_amount`/`pay_status`/`pay_trade_no`);`order_main` 增 `trip_id BIGINT`(0=独立单)、`alloc_coupon_discount DECIMAL(12,2)`(分摊到本子单的券额)。
- **业务**:
  1. Checkout 一次创建 1 个 `order_trip` + N 个 `order_main`(`order_status` 初始为"待支付/待确认"),各子单先锁库存。
  2. 一次支付成功 → 遍历子单逐个确认;**某子单确认失败**:仅该单置"预订失败"并触发钱包退款,其余不受影响(PRD 模块1.1 硬规则)。
  3. **券分摊**:`alloc_i = round(coupon_discount * order_i.total / trip.total, 2)`,末单兜底吸收四舍五入余数,保证 Σalloc = coupon_discount。分摊额落 `order_main.alloc_coupon_discount`,退款/结算按分摊后金额计算。
- **影响面**:`order-service`(下单/支付/退款)全链;`finance-service`(结算单位 = Booking ID 不变,但金额取分摊后)。
- **风险**:PRD 原文标注"需与工程团队做技术可行性评估"——建议 Trip 排到 P2,先交付单酒店对齐。

#### A3 促销出资分摊 + 会计分录

- **数据**:`marketing_coupon` 增 `funding_source TINYINT`(1平台 2商户 3合作方 4共担)+ `funding_rules JSON`(共担比例);新增 `finance_account_entry`(会计分录:`booking_no`/`account`(平台托管/商户应付/平台收入/合作方应付/营销费用)/`debit`/`credit`/`funding_source`)。
- **业务**:订单支付成功进结算时,按 `funding_source` 生成多条分录(PRD 模块8 五个 Settlement Scenario 即测试用例);商户结算额 = 订单额 − 佣金 − 商户出资促销。
- **影响面**:`marketing-service`(券配置加字段)、`finance-service`(结算引擎新增分录生成)、`order-service`(下单快照出资来源到订单)。

### 3.B 数据缺口新建表(P1/P2)

按归属服务组织(均 `mtrip_business` 库,列省略标准列):

**user-service 域**
- `user_traveler` 常旅客:`user_id`/`nationality`/`first_name`/`last_name`/`id_type`(1NRC 2护照 3其他)/`id_no`(加密)/`id_expire_date`/`is_default`。证件号 AES 加密、列表脱敏。
- `user_favorite` 收藏:`user_id`/`goods_id`,唯一键 `(user_id, goods_id)`。
- `user_fraud` 风控:`user_id`/`fraud_score`/`level`(0正常1警告2限制3封禁)/`trigger_reason`/`last_eval_at`。
- `user_appeal` 申诉:`user_id`/`content`/`attachments JSON`(≤20MB)/`status`(0待审1通过2驳回3升级封禁)/`handler_id`/`handle_remark`。
- `user_referral` 推荐:`user_id`/`referral_code`(唯一)/`inviter_user_id`/`bind_time`/`reward_status`(0待达成1已发放)/`reward_amount`/`reward_order_id`。

**goods-service 域**
- `goods_review` 评价:`goods_id`/`user_id`/`order_id`/`rating`(1-5)/`content`/`images JSON`/`reply_content`(商户回复)/`status`(0待审1显示2隐藏)。触发:离店后可评(对齐模块10 催评)。
- 房型双价:`hotel_room_type` 增 `base_price_citizen`;`goods_daily_stock` 增 `price_citizen`。下单按 `isCitizen` 取价。
- 筛选/排序配置:`goods_filter_config`(`filter_key`/`filter_name`/`options JSON`/`sort`/`status`)+ `goods_sort_config`,对齐 PRD 模块3"后台可配置"。

**marketing-service 域**
- `marketing_longstay_tier` 长住梯度:`min_nights`/`discount_rate`/`status`;`marketing_campaign` 促销活动(落地页):`title`/`landing_url`/`banner`/`period`/`coupon_ids JSON`/`status`。

**comms 新域(建议新增 notification-service,或先并入 system-service)**
- `notify_template`:`event_key`(booking_confirmed/booking_cancelled/review_request…)/`channel`(1push2inapp3sms4email)/`locale`/`title`/`content`(支持 `{hotelName}` 等变量)。
- `notify_record`:`user_id`/`event_key`/`channel`/`biz_id`/`status`/`sent_at`。
- `chat_conversation` / `chat_message`:`type`(1酒店咨询2客服)/`user_id`/`target_id`(酒店或客服)/`status`;消息 `conversation_id`/`sender_type`/`content`/`msg_type`。客服支持机器人 FAQ + 转人工 + 会话评分。

**system-service 域(App 配置)**
- `app_theme` 动态主题:`theme_name`/`assets JSON`(splash/logo/home/nav…)/`status`(草稿/排期/生效/失效)/`start_time`/`end_time`/`priority`。C 端 `/api/v1/app/theme/active` 取当前生效主题,多主题按 priority,失效回退默认。

### 3.C C 端接口缺口(新增 `/api/v1/app/*`)

| 模块 | 新增接口(示意) | 归属服务 |
|---|---|---|
| 常旅客 | `traveler/list\|add\|update\|delete`、`traveler/passport-ocr` | user |
| 收藏 | `favorite/list\|add\|remove` | user |
| 钱包 | `wallet/balance\|logs`(复用 balanceLogs) | user |
| 推荐 | `referral/my\|bind\|rewards` | user |
| 风控申诉 | `appeal/submit\|status` | user |
| 评价 | `review/list\|add`(酒店详情读、离店后写) | goods |
| 长住 | `goods/longstay-list`(带梯度折扣计算) | goods |
| 促销 | `marketing/campaign-list`、`marketing/coupon/claim\|my\|best-match` | marketing |
| 通知 | `notify/list\|read` | notification |
| 聊天/客服 | `chat/conversations\|messages\|send\|finish\|rate` | comms |
| 主题 | `theme/active` | system |
| 下单增强 | `order/create` 增 `couponId`/`travelers[]`/`isCitizen`/`longStay`/`tripId` 入参 | order |

管理端对应补齐:评价审核、券出资配置、长住梯度配置、通知模板、风控看板/申诉队列、主题管理、客服工作台——均 `/api/v1/admin/*` + `#[Permission]` + 菜单种子 perm_key 对齐 + admin-web 页面(目录须与菜单 `component` 一致)。

---

## 4. 实施路线(建议)

> 每阶段交付后跑 `scripts/check.ps1`,并同步 `docs/plans/` 对应文件、README 进度表、HANDOFF。

- **P0 架构决策(先设计签字,再编码)**:A1 退款钱包化、A2 Trip 拆单分摊、A3 出资分账。产出各自的详细设计小节 + 迁移脚本评审。
- **P1 单酒店闭环对齐 PRD(高性价比,不含 Trip)**:
  1. A1 退款钱包化;
  2. 下单增强(couponId + 长住折扣 + 多住客 + 缅甸双价);
  3. 常旅客 / 收藏 / 评价;
  4. My Coupons / 促销中心接口;
  5. 平台费透明(取消才收 convenience fee)。
- **P2 增长与运营**:Trip 多酒店(A2)、通知中心多渠道、推荐返利、风控与申诉、动态主题、在线客服/酒店聊天、A3 出资分账落结算。
- **P3(PRD 明示 Phase2)**:AI 助手、旅行保险。

---

## 5. 建议与待确认

1. **需求边界**:本 PRD 与最初三份 docx 是**不同产品定义**,请先确认本次真正要交付的模块范围(尤其 A1/A2/A3 三项架构级)。
2. **新服务 vs 扩展**:通知、客服两个新域,建议先并入既有服务(system/user)以降复杂度,量大后再拆独立服务。
3. **外部依赖**:护照 OCR、Push、Email、Stripe/PayPal 正式收单均为第三方,需另行授权与选型。

> 下一步可选:针对 P0 任一项(推荐先 **A1 退款钱包化**,风险可控且解锁 PRD 多处"仅退钱包")产出**含迁移 SQL + 改动文件清单 + 回归用例**的落地级方案。
