# M13 预订管理验收差距

2026-11-27，以超级管理后台 Enterprise v1.0.20 的 M13 正文和 AC13 为准，对照本地 dev 提交 `2cb367b`。源码覆盖后台、消费者、商户及订单和财务服务。下文的金额推算、历史隔离用例与本次执行的检查分别标明。生产部署版本、真实银行到账和端到端 QA 签核未核验。[M13 正文](<../../../obsidian/mTrip_obsidian/mTrip 超级管理后台知识库/03-功能模块/M13-预订管理.md>) · [AC13 汇总](<../../../obsidian/mTrip_obsidian/mTrip 超级管理后台知识库/04-验收标准/AC13-预订管理.md>)

## 到店支付的五种取消结果

按 M13 示例，线上预付 30,200 MMK，其中佣金 10,000、手续费 200、商户预收 20,000。以下均指入住前已确认的整笔预订或已确认未入住。PRD 要求五种情形均不再收取未付酒店尾款。正数退款由住客选择钱包或指定外部账户，原支付使用钱包与渠道混付时也适用。[M13 §6](<../../../obsidian/mTrip_obsidian/mTrip 超级管理后台知识库/03-功能模块/M13-预订管理.md#6-取消与退款规则>)

| 情形 | 用户应退 / 商户应得预收 | 当前证据与差距 |
|---|---|---|
| 用户在免费期内取消 | 30,000 / 0，平台保留手续费 200 | 钱包路径隔离测试通过。提交后用户进入取消结果页，预订和库存到到账时才关闭、释放，期间商户仍可能办理入住。[隔离用例](../../../test/pay-at-hotel-261120/integration.py#L253) · [申请后状态](../../../backend/services/order-service/app/Controller/App/OrderController.php#L586) · [到账处理](../../../backend/services/order-service/app/Service/Payment/RefundSettleService.php#L641) |
| 用户逾期取消 | 0 / 20,000，平台保留佣金及手续费 | 常规无附加服务订单仅通过了“试算为零”。直接取消仅受理待付单，已付单申请遇零即拒绝，因此住客无法以此原因完成取消、恢复库存及结算。含附加服务时，现有试算还单独保留其可退额。[用户入口](../../../backend/services/order-service/app/Controller/App/OrderController.php#L467) · [零金额判断](../../../backend/services/order-service/app/Controller/App/OrderController.php#L562) · [试算用例](../../../test/pay-at-hotel-261120/integration.py#L313) |
| 用户未入住 | 0 / 20,000，平台保留佣金及手续费 | 常规未入住留款与商户结算有隔离用例。授权豁免可将 20,000 自动退到钱包，含可退附加服务也可能触发退款。M13 未规定这些例外。后台和用户端另有状态展示问题。[未入住处理](../../../backend/services/order-service/app/Service/Booking/BookingLifecycleService.php#L445) · [退款组成](../../../backend/services/order-service/app/Service/Booking/PayAtHotelRefundBreakdown.php#L18) · [结算用例](../../../test/pay-at-hotel-261120/integration.py#L323) |
| 酒店取消 | 30,200 / 0，含手续费 | 已有等待住客选去向、全额转外部账户、凭证及仅恢复一次库存的隔离证据。真实外部到账待验。[酒店取消用例](../../../test/pay-at-hotel-261120/integration.py#L293) |
| 平台取消 | 30,200 / 0，含手续费 | 已有后台取消后整笔退到住客钱包的隔离证据。各去向与后台财务记录仍需 QA 对单签核。[平台取消用例](../../../test/pay-at-hotel-261120/integration.py#L284) |

## 尚未符合的功能

| 功能 | 当前差距与验收依据 |
|---|---|
| 1. 住客取消与履约状态 | 除上表逾期取消受阻外，免费期内提交后，用户已进入取消结果页，商户的入住判断仍读“已确认”。另有已退房订单可由商户发起退款，后台驳回统一把订单改回“已支付”。验收需同时核对住客所见状态、商户可执行动作、库存和财务处理进度。[取消页面](../../../client-app/src/screens/order/CancelBookingScreen.tsx#L123) · [入住条件](../../../backend/services/order-service/app/Service/Booking/BookingLifecycleService.php#L168) · [驳回更新](../../../backend/services/order-service/app/Controller/Admin/AdminRefundController.php#L140) |
| 2. MVP 仅整单取消和退款 | 商户 Web 可新申请部分金额，平台可核减此类申请，退款后订单继续有效。现有测试明确允许申请 10,000、核准 8,000。另有住客按政策退足 30,000、仅保留手续费时，申请记录仍按原支付额比较并标为部分退款。验收应区分退足应退额与主动部分退款。产品早期答复和 M13/M24 对开放范围有分歧。[审批](../../../backend/services/order-service/app/Controller/Admin/AdminRefundController.php#L166) · [退款类型](../../../backend/services/order-service/app/Controller/App/OrderController.php#L575) · [现行用例](../../../test/pay-at-hotel-261120/integration.py#L265) · [产品答复](../2026-11-24-ca-v109-follow-up.md#11-月-26-日补录-mario-的产品决定) |
| 3. 退款决定通知双方 | 用户提交申请时已有双端通知，后台也会校验驳回原因。最终通过、驳回分支未见向住客及商户同时发送决定，到账通知覆盖的是另一时点。验收需分别核对双方收到的批准和驳回结果。[申请通知](../../../backend/services/order-service/app/Controller/App/OrderController.php#L611) · [审核决定](../../../backend/services/order-service/app/Controller/Admin/AdminRefundController.php#L136) |
| 4. 三端展示未入住 | 商户标记 No-show 写入预订状态，旧订单状态仍可保持“已支付”。商户 App 读取预订状态，用户详情和后台列表读取旧订单状态。后台也缺少按 No-show 筛选的入口。[状态定义](../../../backend/services/order-service/app/Constants/BookingConst.php#L61) · [用户详情](../../../client-app/src/screens/order/BookingDetailScreen.tsx#L426) · [后台筛选](../../../admin-web/src/views/order/components/OrderManage.vue#L308) |
| 5. 预订历史与问题调查 | “预订历史”复用全部预订列表。后台订单详情返回当前订单、退款和核销记录，已有预订事件时间线尚未接入。详情展示联系人，未展示关联用户账号、商户标识或档案入口。调查人员难以按单还原谁在何时修改订单、取消或撤销入住。[菜单](../../../database/seed/02-menu.sql#L135) · [详情接口](../../../backend/services/order-service/app/Controller/Admin/AdminOrderController.php#L77) · [现有事件时间线](../../../backend/services/order-service/app/Controller/Merchant/BookingController.php#L174) |
| 6. 人工操作授权与终态保护 | 列表权限可以覆盖备注，已取消、已完成的单也可写。手工核销使用核销记录列表权限，改价与取消共用权限，详情权限已定义但详情按钮和接口未使用对应键。改价先读待付状态再按 ID 更新，存在付款或取消同时发生时仍改价的代码风险，尚未做并发实测。非超管若归属站点 0，列表会跳过站点过滤，详情却逐单比对站点，存在可见范围不一致。[站点校验](../../../backend/services/order-service/app/Controller/Admin/AbstractAdminController.php#L82) · [改价和备注](../../../backend/services/order-service/app/Controller/Admin/AdminOrderController.php#L148) · [手工核销](../../../backend/services/order-service/app/Controller/Admin/AdminVerifyController.php#L28) · [详情权限定义](../../../database/seed/02-menu.sql#L147) |
| 7. 不可改写的核验和修改审计 | 撤销核销会直接更新原成功核销行。改价事由写在可覆盖的备注中，通用操作日志在业务成功后写入，日志写失败仍返回业务结果。无法保证每次修改都有可按预订追溯的旧值、新值、操作人和时间。酒店入住/撤销的独立预订事件已有记录。[撤销写入](../../../backend/services/order-service/app/Controller/Admin/AdminVerifyController.php#L87) · [通用操作日志](../../../backend/shared/src/Middleware/OperationLogMiddleware.php#L41) |
| 8. 商户开通证据与未入住费率 | 新商务政策控制到店支付可用性。没有商户选择记录时，也可按后台政策默认启用未入住费并取预收比例。需明确后台代录商户同意的证据。另有明确校验差距：商户启用后仍可提交 0% 或 0.5%，M13 要求 1%–30%。[生效选择](../../../backend/shared/src/Merchant/PayAtHotelTerms.php#L64) · [商户保存](../../../backend/services/merchant-service/app/Service/PayAtHotelTermsService.php#L28) · [费率校验](../../../backend/shared/src/Merchant/CommercialTerms.php#L19) |
| 9. 每笔预订的财务明细 | 详情已有佣金、手续费、预收、酒店余额和条款版本。后台查单时仍缺预订时商户开通情况、未入住费率、适用取消截止时间、长住与券各自的出资比例，以及取消前后应收、应退、保留及应结金额的对照。当前显示原酒店余额也不足以说明取消后实际应收为零。[订单详情](../../../admin-web/src/views/order/components/OrderManage.vue#L406) · [预订条款快照](../../../backend/services/order-service/app/Service/PayAtHotelPricingService.php#L36) |
| 10. 平台出资补贴的分账报表 | 成功退房且无退款时，逐单结算加入平台补贴，分账报表的商户净应结和平台净额只调整退款。按 M13 场景 A 静态代入，酒店已收 68,000，平台应付商户 18,000，报表计算 8,000。平台净额应为 −5,920，报表计算 4,080。明细和汇总使用同一缺少补贴的公式。[逐单结算](../../../backend/shared/src/Finance/PayAtHotelReconciliation.php#L26) · [分账明细与汇总](../../../backend/services/finance-service/app/Controller/Admin/AccountEntryController.php#L32) |
| 11. 普通预付预订完成后的商户结算单 | 付款时有分账记录。在仓库业务路径中，找到的商户结算单自动生成任务仅处理指定支付方式、带商务条款快照的到店订单。普通全额线上预付订单完成后，未找到生成对应商户结算单供后台确认、打款和查看历史的路径。历史到店旧快照也在该任务范围外。[付款分录](../../../backend/services/order-service/app/Service/SettlementService.php#L79) · [结算任务条件](../../../backend/services/order-service/app/Service/PayAtHotelSettlementService.php#L19) |
| 12. 人工打款的银行流水号 | 已有人工确认、凭证和重复登记保护。逐单打款仅要求填写一个凭证字段，允许使用链接，资金流水号为系统生成。仅凭该记录无法保证能按实际银行交易号对账。[财务登记](../../../backend/services/finance-service/app/Controller/Admin/SettleController.php#L117) · [结算详情](../../../admin-web/src/views/finance/msettle/index.vue#L498) |
| 13. 商户级 VAT 与税费 | 现有税务配置按站点记录，预订计价和快照未见应用商户专属 VAT 税率、计税基数和结果。结算详情还把税额标成了第二个“退款金额”。M13 要求开发侧依据财务批准的规则配置，后台负责查看。[站点税配置](../../../database/finance/01-finance.sql#L102) · [预订计价](../../../backend/services/order-service/app/Service/PayAtHotelPricingService.php#L25) · [税额标签](../../../admin-web/src/views/finance/msettle/index.vue#L491) |

## AC13 中需要与 M14 联验的两条

- **无效促销时段标记。** 商户促销监管页可查看起止时间和状态，商户保存也有时段校验。监管页未见系统对无效区间的独立标记，平台活动保存路径亦可分别写入起止时间。需验证反向或无效区间在超管端如何识别。[监管详情](../../../admin-web/src/views/marketing/coupon/index.vue#L625) · [活动保存](../../../backend/services/marketing-service/app/Controller/Admin/CampaignController.php#L113)
- **领取保护与独立出资审批。** 有隔离用例证明受理退出期间可以新领取、批准退出后不能新增、旧权益继续有效。平台或共担活动当前可直接保存出资规则和上架状态，领取资格按活动及商户参与状态判断，未见必须先取得独立预算批准的检查。[领取保护用例](../../../backend/services/marketing-service/test/merchant-promotions.php#L194) · [活动上架](../../../backend/services/marketing-service/app/Controller/Admin/CampaignController.php#L135) · [领取资格](../../../backend/services/marketing-service/app/Service/CampaignCouponEligibility.php#L12)

## 待决策与待验收

- **产品与财务口径。** 未入住预收按原价或折后价、未入住的平台和共担补贴、入住后酒店已收款的退款与结算、商户税费的适用性/基数/舍入仍待确认。未入住时佣金和手续费归平台、已配置预收归商户已有明确规定。后台 M13 手续费按佣金计算，消费者 M8 有按房费举例的冲突。早期部分退款答复和现有 No-show 豁免也需明确在 MVP 的适用范围。[M13 待确认事项](<../../../obsidian/mTrip_obsidian/mTrip 超级管理后台知识库/03-功能模块/M13-预订管理.md#8-待业务确认事项>) · [跨端示例差异](<../../../obsidian/mTrip_obsidian/mTrip 超级管理后台知识库/09-导入记录/v1.0.19至v1.0.20差异与跨端影响.md#L33>)
- **已实现、待发布验收。** 列表和多条件筛选、审批及驳回必填备注、预订确认时冻结商务条款、实际入住触发运营结算并记时间及事件均有实现。历史隔离测试覆盖混付整笔去向、明确失败后财务接手、迟到回调防重复。首发自动退款渠道及重试次数、真实渠道到账、商户银行转账与流水核销、三端同单核对和 QA 签核仍待验证。[实际入住](../../../backend/services/order-service/app/Service/Booking/BookingLifecycleService.php#L168) · [11 月 26 日复测及 QA 编号](./2026-11-26-qa-workbook-review.md#11-月-26-日本地修复与复测)
- **测试范围。** 本次运行消费者取消流程静态检查，通过 65/65。11 月 26 日记录的 103 项是订单、退款及长住隔离用例合计。长住 40/60 出资用例验证了普通预付单的快照，仍需用 M13 场景 A 的到店预订对齐住客付款、商户实收、补贴、结算单和分账报表。五种取消情形还需按同一 Booking ID 核对三端状态、两种退款去向、酒店应收、商户应付及审计记录。[取消页检查](../../../scripts/check-cancel-flow.cjs) · [长住出资测试](../../../test/pay-at-hotel-261120/integration.py#L535)
