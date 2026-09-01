# 实现方案 — Merchant App M4：酒店预订管理

> 状态：实施中。第 13 节 8 项业务决策已由产品统一接受推荐值（2026-09-01）；阶段 0～6 已全部完成（迁移回填、生命周期+10分钟过期任务、商户 API 22 项端到端、Booking Management 原型 UI 真实登录态验收、通知/住客消息/同步框架 23 项端到端、跨端回归与权限切面平台级修复）。
> 更新时间：2026-09-01。
> 需求基线：`设计文档/mTrip_Merchant App PRD_v1.0_中文版.md` 的“模块 4 —— 预订管理”、场景 3 及预订管理验收标准。
> UI 基线：[Merchant App 在线原型](https://big-plank-58319748.figma.site/)中的 Booking Management 页面、详情面板及操作弹窗。
> 说明：需求消息中的显示地址曾出现 `stir-long-36886628.figma.site`，实际可访问链接为上面的 `big-plank-58319748.figma.site`；开发前若原型地址发生变化，必须重新确认基线。

---

## 1. 实施原则与优先级

1. **PRD 是业务规则和验收标准的唯一基线**。状态、权限、库存、退款、No-show 和审计规则不得因原型演示行为而放宽。
2. **在线原型是 UI 布局、视觉和未在 PRD 明确的交互细节基线**。页面必须严格按原型实现，不允许开发人员自行更换布局、合并区块或进行主观“美化”。
3. PRD 与原型冲突时，业务行为遵循 PRD，UI 保持原型结构，并在代码和测试记录中说明差异。例如：原型演示允许较宽松地标记 No-show，但正式实现只能在入住截止时间后执行。
4. 使用项目现有 Vue 3、TypeScript、Ant Design Vue、`PageContainer`、`useTable`、`v-perm`、国际化和公共样式体系，不引入第二套 UI 组件库。
5. 所有页面只显示接口返回的真实数据。没有 PMS/Channel Manager 接入时显示 `Not Connected`，不得伪造第三方渠道、同步成功、餐食、佣金或净结算数据。
6. 本期**不接入真实支付渠道**。支付动作继续使用现有模拟支付/内部支付结果；生命周期服务只消费可信的“支付成功/失败/超时”结果，并为后续真实支付回调预留统一入口。

---

## 2. PRD 需求摘要

### 2.1 预订列表

- 集中查看商户有权管理的所有酒店预订。
- 支持按预订号、住客姓名、联系电话、渠道参考号搜索。
- 支持按日期范围、酒店、房型、预订状态、支付状态和渠道筛选。
- 支持按入住日、退房日、预订时间和状态排序。
- 列表展示住客、酒店、房型、入住离店日期、状态、支付和渠道摘要。
- 支持导出和下载。

### 2.2 预订详情

- Booking Summary、Guest Information、Payment Summary、Stay Details。
- 特殊要求、内部员工备注、预订时间线。
- PMS/Channel Manager 同步状态和手动同步。
- 内部备注仅酒店员工可见。

### 2.3 生命周期与履约

- 业务状态：Pending Payment、Confirmed、Checked-in、Checked-out、Cancelled、No-show。
- 支付状态必须与预订状态分离。
- 待支付时锁定库存；PRD 场景指定的 10 分钟内支付成功后确认，超时自动取消并释放库存。
- 支持确认、入住、退房、取消、按政策退款、凭证下载、联系住客、No-show。
- No-show 只能在入住截止时间后且预订未取消时执行，并按策略处理库存、费用、结算和同步。
- 所有状态、支付和同步活动记录操作人、时间、动作与结果。

### 2.4 通知与集成

- 新预订和预订更新产生实时通知。
- 支持 PMS/Channel Manager 同步状态、失败原因和手动重试。
- 支持第三方集成的酒店同步；未接入 PMS 的酒店仍可完全在商户后台操作。

---

## 3. 已确认范围

### 3.1 本期包含

- 酒店预订列表、筛选、排序、统计页签、导出和详情。
- 独立的预订状态与支付状态。
- 确认、入住、退房、取消、退款、No-show、房号分配。
- 10 分钟待支付超时任务及库存释放。
- 内部备注、时间线、操作审计。
- 商户端新预订和状态更新通知。
- PMS/Channel Manager 适配接口、同步日志、失败状态和手动重试框架。
- 按原型严格实现 Booking Management UI，并完成截图对比验收。
- C 端、管理后台、财务统计及非酒店订单的兼容回归。

### 3.2 本期不包含

- Stripe、Adyen、PayPal、微信、支付宝等真实支付渠道。
- 真实银行卡收单、支付渠道签约、生产密钥、渠道对账和真实原路退款。
- 在未取得服务商 API、账号和测试环境前开发具体 PMS/Channel Manager 连接器。
- 未确认改价、换房型、改日期规则前，修改已确认预订的日期、房型或价格。
- 未建立物理房间档案前，房号冲突自动校验。

### 3.3 支付边界

- 现有模拟支付成功仍可推动 `Pending Payment -> Confirmed`。
- 支付结果必须通过统一的 `PaymentResultHandler` 进入生命周期服务，页面或控制器不得直接修改状态。
- 预留支付交易号、支付时间、支付方式和回调幂等键，但不得伪造真实渠道流水。
- 退款本期沿用现有平台/钱包退款模型；只有真实支付接入后才增加渠道退款和渠道对账。

---

## 4. 现状与差距

| 层 | 已有能力 | 关键缺口 |
|---|---|---|
| 数据库 | `order_main`、`order_refund`、`order_verify_log`、库存日历和库存流水 | `order_status` 混合履约与支付；缺渠道参考号、支付截止时间、独立时间线、内部备注、房号、No-show、同步日志 |
| order-service | 创建、模拟支付、未支付取消、用户退款申请、后台退款审核、库存锁定/扣减/释放/回补 | 商户端只有列表、详情、核销；无完整酒店生命周期、自动过期任务、商户退款入口和集成任务 |
| merchant-web | 通用订单筛选、表格、详情抽屉、核销 | 页面是“订单核销”而不是原型 Booking Management；状态混合，缺详情分区和全部履约操作 |
| 权限与菜单 | `/order` 菜单及 `mch:order:verify` | 缺预订查看、导出、确认、入住、退房、取消、退款、No-show、备注、同步等权限；菜单尚未标记酒店业务 |
| 通知 | 商户通知支持 `booking` 分类和 `booking_detail` 深链 | order-service 没有向商户发送新预订和状态变更通知 |
| 集成 | 房量页面有同步占位字段 | 无真实 PMS/CM 连接器、任务、重试和同步日志 |

### 4.1 必须修复的现有风险

- 现有创建流程注释使用 15 分钟，需统一为 PRD 的 10 分钟。
- 未发现 order-service 的订单超时定时任务，不能只依赖页面轮询。
- 当前 `verify` 将“已支付”直接转为通用“已核销”，无法表达入住、退房和 No-show。
- 订单只有商户范围，门店/酒店子账号范围需要按获授权酒店商品 ID 收窄，不能默认查看整个商户全部酒店。
- 联系电话当前存在脱敏读取，预订详情需设计独立的明文查看权限及审计。

---

## 5. 目标状态模型

### 5.1 预订状态

| 状态 | 允许来源 | 允许后续动作 |
|---|---|---|
| Pending Payment | 创建预订 | 支付确认、取消、支付超时 |
| Confirmed | 支付成功或允许人工确认的外部/到店付预订 | 入住、取消、退款、No-show |
| Checked-in | Confirmed | 退房、补充房号/内部备注 |
| Checked-out | Checked-in | 查看、凭证、售后退款（按政策） |
| Cancelled | Pending Payment/Confirmed | 查看、退款跟踪、凭证 |
| No-show | 到达入住截止时间后的 Confirmed | 查看、费用处理、获授权的迟到入住例外 |

支付超时不是员工可选状态。技术上保留 `expired` 结果以兼容现有订单和审计，商户界面展示为“Cancelled / Payment expired”。

### 5.2 支付状态

- Pending
- Paid
- Partially Refunded
- Refunded
- Failed

### 5.3 派生视图

- Pending Check-in：`booking_status=Confirmed` 且尚未入住。
- In-house：`booking_status=Checked-in` 且尚未退房。
- 派生视图不能写入数据库作为新的业务状态。

### 5.4 状态变更规则

- 所有状态变更由单一生命周期服务执行。
- 使用数据库事务、行锁和幂等键防止重复入住、重复退款、重复释放库存。
- API 返回 `availableActions`，前端只负责展示，不自行复制状态判断规则。
- 每次成功或失败的关键操作写入时间线；失败记录不得暴露敏感内部异常给普通用户。

---

## 6. 数据模型计划

为降低对现有订单、财务和 C 端的影响，首期保留 `order_main.order_status` 并双写兼容字段。

### 6.1 `order_main` 建议新增字段

- `booking_status`
- `payment_status`
- `booking_channel`
- `channel_reference`
- `payment_expires_at`
- `confirmed_at`
- `checked_in_at`
- `checked_out_at`
- `no_show_at`
- `assigned_room_no`
- `meal_plan_snapshot`
- `addon_snapshot`
- `special_requests`
- `cancellation_policy_snapshot`
- `no_show_policy_snapshot`
- `pms_sync_status`
- `channel_sync_status`
- `version`（并发控制）

### 6.2 新表

- `order_booking_event`：不可覆盖的预订、支付、库存、退款和同步时间线。
- `order_internal_note`：商户员工内部备注，记录作者和编辑历史。
- `order_sync_task`：PMS/CM Outbox、重试次数、下次执行时间和幂等键。
- `order_sync_log`：每次同步请求、响应摘要、状态和错误信息。

### 6.3 索引与迁移

- 按 `site_id + merchant_id + goods_id + use_date` 建立列表常用组合索引。
- 为 `booking_status`、`payment_status`、`booking_channel` 和 `payment_expires_at` 建索引。
- 迁移必须幂等，并登记到 `deploy/docker-compose.yml` 的 initdb 列表。
- 为已有酒店订单制定确定性回填规则；不能根据模糊文案猜测渠道或同步状态。

---

## 7. 后端设计

### 7.1 核心服务

- `BookingLifecycleService`：状态矩阵、权限前置条件、时间线及兼容字段双写。
- `BookingQueryService`：商户、酒店和账号范围过滤；列表和详情聚合。
- `BookingExpiryService`：每分钟处理到期的 Pending Payment，批量、幂等、可重试。
- `BookingRefundService`：按订单政策快照试算、发起和跟踪退款。
- `BookingNotificationService`：新预订、状态、退款和同步异常通知。
- `BookingSyncService`：PMS/CM Outbox、执行日志、失败重试和 Force Sync。
- `PaymentResultHandler`：当前接模拟支付，未来真实支付回调复用同一入口。

### 7.2 商户接口建议

统一放在 `/api/v1/merchant/order/*`，返回结构必须为 `{code,message,data}`，分页为 `{list,total,page,pageSize}`。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/booking-stats` | 页签数量和待处理统计 |
| GET | `/list` | 酒店预订列表、搜索、筛选、排序 |
| GET | `/detail` | 详情、支付、入住信息、同步摘要和 `availableActions` |
| GET | `/timeline` | 预订时间线 |
| POST | `/confirm` | 允许条件下确认预订 |
| POST | `/check-in` | 入住及房号分配 |
| POST | `/check-out` | 退房 |
| POST | `/cancel` | 取消及退款试算确认 |
| POST | `/no-show` | 标记 No-show、费用和库存处理 |
| GET | `/refund/quote` | 退款政策试算 |
| POST | `/refund/apply` | 商户发起/处理退款 |
| POST | `/note` | 新增内部备注 |
| POST | `/sync` | PMS/CM 手动重试 |
| GET | `/export` | CSV/XLSX 导出 |
| GET | `/voucher` | 可打印/PDF 预订凭证 |

接口最终命名应与现有路由风格统一；不得为同一动作保留两套业务实现。

### 7.3 权限建议

- `mch:order:list`
- `mch:order:detail`
- `mch:order:export`
- `mch:order:confirm`
- `mch:order:check-in`
- `mch:order:check-out`
- `mch:order:cancel`
- `mch:order:refund`
- `mch:order:no-show`
- `mch:order:note`
- `mch:order:sync`
- `mch:order:voucher`
- `mch:order:guest-contact`

写接口的 `#[Permission]`、`database/seed/04-merchant-menu.sql` 和前端 `v-perm` 必须完全一致。预订菜单应标记为酒店业务模块，默认全局业务视图不展示酒店预订菜单。

---

## 8. 原型 UI 严格还原要求

### 8.1 页面结构

必须按原型保留以下结构和顺序：

1. 页面标题 `Booking Management`、说明文案、Download 和 Export 操作。
2. 搜索框、起止日期、All Hotels、More Filters。
3. More Filters 内的 Room Type、Booking Status、Payment Status、Channel。
4. All、Pending、Confirmed、Pending Check-in、In-house、Checked-out、Cancelled、No-show 页签及数量。
5. 表格列：Booking ID、Guest、Hotel、Room、Dates、Status、Payment、Channel、Actions。
6. 选中行后打开约 430px 的右侧详情面板，列表区域同步收窄；不得改成独立详情页或普通居中弹窗。
7. 详情区块顺序：Booking Summary、Guest Information、Payment Summary、Stay Details、Internal Notes、Booking Timeline、Sync Status、Actions。
8. No-show 等高风险动作使用原型对应的确认弹窗，明确展示影响和可选内部备注。

### 8.2 视觉执行规则

- 开发开始时由执行人对原型页面逐区截图，记录容器宽度、间距、字号、字重、颜色、边框、圆角、阴影、表格行高、详情面板宽度和按钮规格。
- 优先复用全局 Token 和现有组件；Token 无法表达时才增加页面局部样式。
- 不允许用嵌套卡片替代原型的平面分区，不允许自行改变信息密度。
- 状态 Tag 的文字、颜色、边框必须与原型一致，同时保证 Pending Payment 和 Payment Pending 不混淆。
- 原型中的 VIP、Honeymoon 等标签只在接口存在真实标签时显示。
- All Hotels 视图显示 Hotel 列；单酒店视图按原型隐藏或弱化重复酒店信息。
- 页面必须完成中文和英文文案；英文排版以原型为视觉基线。

### 8.3 UI 验收

- 至少在 1440×900 和 1366×768 两种桌面尺寸截图。
- 对页面默认态、筛选展开态、选中预订态、每种关键操作弹窗分别截图对比。
- 使用同一测试数据和相同视口进行原型/实现并排对比。
- 关键布局、区块顺序、面板宽度、表格列和操作入口必须一致；明显差异必须修复或记录经过产品确认的例外。
- 不能用未登录后跳转登录页、空数据页或静态 Mock 页面代替真实登录态视觉验收。

---

## 9. 通知、消息与同步

### 9.1 商户通知

- 新预订、支付确认、取消、退款、入住、退房、No-show、同步失败均产生商户通知。
- 复用现有 `booking` 分类和 `booking_detail` 深链，点击后进入 `/order` 并自动打开目标预订。
- 通知发送失败不回滚预订主事务，应使用 Outbox 或可重试任务。

### 9.2 住客消息

- 优先复用已有客服/会话能力，并增加预订 ID 关联和详情页深链。
- 若没有可复用能力，需实现最小可用的预订会话和消息记录，不能保留无效果的 `Message Guest` 按钮。
- 消息权限、敏感信息及操作历史必须受商户和酒店范围控制。

### 9.3 PMS/Channel Manager

- 本期实现供应商无关的适配接口、Outbox、日志、重试和真实状态展示。
- 未配置连接器时返回 `not_connected`；不得显示 `synced`。
- 取得具体服务商协议后，在适配层增加连接器，不修改预订页面和生命周期核心。

---

## 10. 分阶段任务与验收

### 阶段 0：规则确认和测试基线（0.5 天）

- [x] 确认本文第 13 节的业务决策。
- [x] 固化状态矩阵、操作权限和错误码。
- [x] 保存原型关键页面截图及 UI 测量记录。
- [x] 将 PRD 条目映射为测试用例编号。

验收：不存在开发人员需要自行猜测的核心业务规则。

**已确认决策（均为第 13 节推荐值）**：① 在线订单模拟支付成功自动 Confirmed，仅外部渠道/到店付允许人工确认；② No-show 截止默认入住日当地 23:59，支持酒店级配置；③ No-show 费用按政策快照计算，Waive Fee 需独立权限并记录原因；④ 房号首期仅存文本；⑤ 已确认预订首期不支持改日期/房型/价格，仅可补房号、特殊请求与内部备注；⑥ 住客联系方式默认脱敏，明文查看需 `mch:order:guest-contact` 并写审计；⑦ Export 输出 XLSX/CSV，Download 输出单笔凭证打印版；⑧ 外部同步仅交付适配层与 Not Connected 状态。
**状态矩阵/错误码基线**：以第 5 节为准；业务冲突统一 `40901 DATA_CONFLICT`，越权 `40302 NO_DATA_PERMISSION`，前置条件不满足返回带中文文案的 40901，时间线仅记录脱敏后的失败原因。

### 阶段 1：数据库与兼容层（1～1.5 天）

- [x] 新增预订字段、时间线、内部备注、同步任务和日志表。
- [x] 建立索引和幂等迁移。
- [x] 回填已有酒店订单并验证非酒店订单不受影响。
- [x] 建立新旧状态双写映射。

验收：旧订单可正常读取，酒店预订可完整表达 PRD 数据。
**完成记录**：`database/order/05-merchant-booking.sql`（order_main +20列+5索引、确定性回填守卫、4张新表）与 `database/merchant/36-merchant-booking-menu.sql`（菜单400改名 Booking Management + 13 按钮权限）已应用；73 条存量订单回填状态组合验证通过（`test/sql/m4-verify-stage1.sql`）。

### 阶段 2：生命周期与库存（1.5～2 天）

- [x] 实现统一状态服务和 `availableActions`。
- [x] 接入支付结果处理入口，但不接真实支付渠道。
- [x] 实现 10 分钟自动过期任务。
- [x] 实现确认、入住、退房、取消、No-show 和库存联动。
- [x] 实现时间线、并发锁和幂等。

验收：支付/超时竞争、重复操作和库存回补测试全部通过。
**完成记录**：`BookingLifecycleService`（行锁+version乐观锁+双写+时间线）、`PaymentResultHandler`、`BookingExpiryService`（crontab 每分钟）、退款/事件/通知服务已上线；过期任务实测自动取消到期预订并写入 `payment_expired` 事件与商户通知（测试 fixture 已清理）；修复：mTrip 渠道人工确认校验优先于幂等返回。

### 阶段 3：商户 API（2 天）

- [x] 列表、统计、详情、时间线、备注。
- [x] 确认、入住、退房、取消、No-show、退款。
- [x] 导出、凭证、同步重试。
- [x] 站点、商户、酒店和账号权限隔离。
- [x] 联系方式明文查看权限与审计。

验收：接口契约、权限、越权和状态前置条件测试通过。
**完成记录**：`BookingController` 16 端点已注册至 `/api/v1/merchant/order/*`（list/detail 切换为预订实现，不保留两套业务实现）；`#[Permission]` 键与 `36-merchant-booking-menu.sql` 种子完全对齐；门店账号经 `merchant_store_goods` 收窄，越权详情返 40401；22 项容器内端到端测试全部通过（`test/sql/m4-e2e-test.php`）。

### 阶段 4：原型 UI 实现（2～2.5 天）

- [x] 按第 8 节完整实现 Booking Management 页面。
- [x] 接入真实列表和详情数据，不使用原型假数据。
- [x] 按 `availableActions` 展示操作。
- [x] 完成所有确认弹窗、空态、加载态和异常态。
- [x] 完成中英文国际化。
- [x] 完成两种分辨率截图对比并修正差异。

验收：布局、交互和视觉与原型一致，截图差异经产品确认。

**完成记录**：`views/order/index.vue` 重写为 Booking Management（工具条/8页签/表格 + 430px 详情面板并排 + 8 类操作弹窗状态机）；`api/booking.ts` 新增 16 个接口函数 + CSV 二进制导出；`v-perm` 键与菜单种子一致；原型未实现的确认弹窗按 PRD §2.4 补齐；佣金/净结算按 §1.5 不展示；通知深链 `notificationTarget` 监听已就位。修复 `useTable` 分页文案硬编码中文（改走 `common.totalItems` 国际化）；清理 `en-US.ts` 重复的 `booking` 命名空间。`vue-tsc --noEmit` 与 `npm run build` 均通过。真实登录态验收（m1001 + 2FA，为账号补写测试 TOTP 密钥 `test/sql/m4-totp-setup.php`）：1440×900 与 1366×768 默认态/筛选展开态/选中态/Check-in 与 Cancel 弹窗共 8 张截图与原型逐项对比通过（截图见 `deploy/uploads/rooms/202609/`）；1366 宽度下详情面板按响应式规则转全宽堆叠。确认例外：Message Guest 入口待阶段 5 实现消息能力后补入（§9.2）。

### 阶段 5：通知、消息和同步框架（1.5～3 天）

- [x] 商户预订通知及详情深链。
- [x] 住客消息入口走通真实会话。
- [x] PMS/CM 适配接口、Outbox、日志和 Force Sync。
- [x] 未连接、同步中、成功和失败状态真实展示。

验收：通知可打开目标预订；同步失败可重试且不影响本地事务。

**完成记录**：入住/退房通知补齐（幂等不重发，深链 `/order?notificationTarget={id}` 直达）；住客消息复用客服会话：`chat_conversation.order_id` 关联列（`database/user/10-chat-booking-link.sql`）+ 菜单 `mch:order:message`（`database/merchant/37-merchant-booking-message.sql`），`guest-thread`/`guest-message` 两端点（会话自动创建/复用，商户消息 `sender_type=2`，时间线 `guest_message_sent` 留痕）；`BookingSyncService` 全量重写：`SyncConnectorInterface` 配置化注册（本期恒未连接）、Outbox 处理器（crontab 每分钟 CAS 抢占）、指数退避（2^(n-1) 分钟）、终态失败通知与 `order_sync_log` 逐次记录；前端详情面板新增 Message Guest 按钮（`availableActions` + `v-perm`）与气泡消息抽屉，会话结束禁发；23 项容器内端到端测试全部通过（`test/sql/m4-e2e-stage5.php`）。

**遗留问题（阶段 6 专项）**：`Mtrip\Shared\Aspect\PermissionAspect` 未被 Hyperf 切面收集器注册（`aspects.cache` 仅含 3 个框架切面），order-service 内 `#[Permission]` 注解实际未生效；新端点已用 `MerchantContext::hasPermission` 显式兜底，旧端点同风险待阶段 6 修复。

### 阶段 6：跨端回归与文档（1.5～2 天）

- [x] 回归 C 端订单、Trip、管理后台、退款、财务、结算和库存。
- [x] 回归非酒店订单与既有核销。
- [x] 执行 PHP 语法、服务测试、`scripts/check.ps1`。
- [x] 执行 merchant-web lint、类型检查和 production build，确保无新增警告。
- [x] Docker 环境执行真实 HTTP 和登录态浏览器流程。
- [x] 更新 `docs/plans/README.md`、`13-商家端merchant-web落地.md` 和 `HANDOFF.md`。

验收：所有自动化检查通过，真实登录态端到端流程和截图有记录。

**完成记录**：

1. **PermissionAspect 平台级修复（专项）**：根因为 `Mtrip\Shared\Aspect\PermissionAspect` 缺少 `#[Aspect]` 注解，从未被 Hyperf AspectCollector 收集（`aspects.cache` 仅含 3 个框架切面），全部服务 `#[Permission]` 注解静默失效。修复：补 `#[Aspect]` 注解 + 8 个服务全部新增 `config/autoload/aspects.php` 显式注册（不依赖扫描收集时序；merchant/system 原已有同名配置，语义等价覆盖）。重启后 8 服务 `aspects.cache` 均含该切面。对照验证：子账号无权限调旧/新端点均 40301，有权限端点正常；超管/主账号不误拦（主账号 JWT 签发全量权限集）。历史印证：HANDOFF 2026-08-28 S7 曾发现同类问题并预告“其他服务可能有同类缺项应另做专项”，本次即为该专项收口。
2. **回归**：阶段 3 E2E 22/22、阶段 5 E2E 23/23 重跑全过（含越权/幂等/非 mtrip 渠道约束）；管理端超管跨服务 HTTP 冒烟（9501/9505/9504 均 code=0）；非超管无权限写端点返 40301（9507 营销）；user-service 仅 Admin 控制器有注解，C 端不受影响，8 服务 healthz 全绿；非酒店订单行为不变（阶段 1 回填验证 + mtrip 渠道确认拒绝用例覆盖）。
3. **质量**：`scripts/check.ps1` 四项全 PASS（PHP lint 343 文件、shared 单测、admin-web build、client-app typecheck）；`merchant-web npm run build`（vue-tsc + vite）通过，仅既有大 chunk 警告，无新增。
4. **真实登录态浏览器验收**：m1001 + 2FA 登录 merchant-web，Booking Management In House 详情面板 Message Guest 按钮→消息抽屉→发送消息蓝色气泡全链路通过（截图见 `.reasonix/attachments/m4-guest-message-drawer.png` 等 3 张）。期间网关对 merchant-service 上游短暂 502（服务本体健康，重启网关恢复），已观察确认未复发。
5. **文档**：本文件、`docs/plans/README.md` 进度表、`HANDOFF.md` 已同步；新增夹具脚本 `test/sql/m4-fixture-reset3.sql`（阶段 3 稳态夹具）。
6. **2026-09-01 热修复**：存量本地 MySQL 卷未重放 initdb，导致 `order_main.booking_status` 缺列；已用 `scripts/db-apply.ps1` 补执行 `database/order/05-merchant-booking.sql`、`database/merchant/36-merchant-booking-menu.sql`、`database/merchant/37-merchant-booking-message.sql`、`database/user/10-chat-booking-link.sql` 并复查字段落库。同步补登记 `deploy/docker-compose.yml` 中遗漏的 `10-chat-booking-link.sql` 与 `37-merchant-booking-message.sql`，避免全新环境漏挂。
7. **2026-09-01 联动排查**：客户端真实房型不显示还依赖 M2 房型审核流与 marketplace；已补跑 `database/goods/07-room-review-workflow.sql`，并确认当前本地酒店/房型已是 live room，但因数据仍在 `site_id=0` 且未发布 Ranking Marketplace，C 端默认站点 1 仍会过滤。

---

## 11. 核心测试矩阵

| 场景 | 预期结果 |
|---|---|
| 创建待支付预订 | 锁定对应日期库存，状态 Pending Payment / Pending |
| 10 分钟内模拟支付成功 | 仅确认一次，locked 转 sold，通知商户 |
| 超时任务先执行 | 取消并释放库存，之后迟到支付不得直接确认 |
| 支付与超时并发 | 最终只能有一个合法结果，库存不重复扣减/释放 |
| Confirmed 入住 | 校验日期、权限和房号，状态变 Checked-in |
| 重复入住 | 幂等返回或明确冲突，不重复写业务结果 |
| Checked-in 退房 | 状态变 Checked-out，时间线完整 |
| 提前标记 No-show | 拒绝并返回明确业务错误 |
| 截止时间后 No-show | 按策略处理费用、库存、结算、通知和同步 |
| 取消/退款 | 使用下单时政策快照计算，不受后来规则修改影响 |
| 内部备注 | 仅授权员工可见，作者和时间可审计 |
| 酒店子账号访问其他酒店 | 拒绝访问且不泄露订单是否存在 |
| PMS 未连接 | 显示 Not Connected，不能 Force Sync 成功 |
| 通知跳转 | `/order?notificationTarget=<id>` 自动打开目标详情 |
| 非酒店订单 | 原有列表、支付、退款和核销行为不回归 |

---

## 12. 预计周期与最短交付路径

不含第三方服务商等待时间，完整本地预订管理闭环预计 **8～12 个工作日**。

建议按以下顺序交付，避免 UI 等待全部集成完成：

1. 状态和数据契约。
2. 生命周期、库存、自动过期。
3. 商户查询及操作 API。
4. 严格原型 UI 和截图验收。
5. 通知、消息、同步框架。
6. 跨端回归与文档收口。

第三方 PMS/Channel Manager 具体连接器和真实支付均作为后续独立里程碑，不阻塞本期本地酒店预订闭环。

---

## 13. 编码前待确认项

除“暂不接真实支付”和“严格按原型实现 UI”已经确认外，以下规则仍需产品确认。若统一接受推荐值，可回复“其余按计划推荐值执行”。

1. **人工确认**：推荐 mTrip 在线订单模拟支付成功后自动 Confirmed；仅外部渠道或到店付订单允许有权限员工人工确认。
2. **No-show 截止时间**：推荐默认使用酒店当地时间入住日 23:59，并允许酒店级配置。
3. **No-show 费用**：推荐按酒店/房型政策快照计算；Waive Fee 使用独立权限并记录原因。
4. **房号管理**：推荐首期只保存房号文本；物理房间和房号冲突校验另立模块。
5. **已确认预订修改**：推荐首期不支持改日期、房型和价格，仅支持房号、特殊要求和内部备注；待改价及库存规则明确后补充。
6. **住客联系方式**：推荐默认脱敏，使用 `mch:order:guest-contact` 查看明文并写审计日志。
7. **导出与下载**：推荐 Export 输出 XLSX/CSV，Download 输出单笔预订打印版/PDF 凭证。
8. **外部同步**：没有具体服务商资料时只交付适配层和 Not Connected 状态，不制造演示同步数据。

---

## 14. 完成定义（Definition of Done）

- [ ] PRD 模块 4、场景 3 和验收标准逐条映射并通过。
- [ ] 预订状态、支付状态、库存和退款保持一致。
- [ ] 10 分钟自动过期在真实定时任务中执行并通过并发测试。
- [ ] 商户可以完成确认、入住、退房、取消、退款和 No-show 全流程。
- [ ] 内部备注、时间线、通知和同步状态均使用真实数据。
- [ ] 页面布局、详情面板、筛选、表格、状态和操作弹窗严格对齐在线原型。
- [ ] 1440×900 与 1366×768 登录态截图对比完成。
- [ ] 权限键、后端注解和前端 `v-perm` 完全一致。
- [ ] 站点、商户、酒店和账号范围测试通过。
- [ ] merchant-web lint、类型检查和构建无新增警告。
- [ ] 后端测试、`scripts/check.ps1` 和 Docker HTTP 回归通过。
- [ ] 非酒店订单、C 端、管理后台、财务和库存无回归。
- [ ] 开发进度和最终实现同步更新项目计划与 HANDOFF 文档。
