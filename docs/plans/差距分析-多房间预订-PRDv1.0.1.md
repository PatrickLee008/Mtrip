# 差距分析:C 端多房间预订 vs Consumer App PRD v1.0.1

状态:**差异 9(My Pick 按 Trip 归并)已落地,其余 8 条仍待办** | 日期:2026-09-22
依据:`docs/reference/ConsumerApp_PRD_v1.0.1_提取文本.txt`(**英文原文**,行号即该文件行号)+ Figma `3003:8863`

多房间预订这条链路在 2026-09-21 已经从 UI 接到后端(`trip/create` + `trip/pay`),Rooms 页签的加减器与预订结果页也按 Figma 重做过。本文是收尾时对照 PRD v1.0.1 的逐条核对结果:**9 处实质差异 + 5 个需要产品拍板的问题**(其中差异 9 与问题 5 已于 2026-09-22 落地/拍板)。

差异 9(My Pick 列表按 Trip 归并)由用户在 2026-09-22 指出并给了 Figma 节点 `289:1112`,不是从 PRD 正文读出来的 —— PRD 正文只有 Trip Summary / Trip History 的原则性要求(line 115、157-163),卡片长什么样只有 Figma 有。

## 读这份文档前必须知道的两件事

1. **PRD 的权威章节是 Module 17**(line 1207:*"The latest approved Figma design and the updated requirements in this PRD should be treated as the current source of truth for development and QA."*)。所以 Module 1.1(line 93-163)那批表格**可能早于** Module 17 的决定,两者冲突时以 17 为准。
2. **购物车不是 PRD 的概念**。PRD 全文没有 cart / My Rooms / Selected Rooms / Add Another Room(唯一的 `cart` 在 line 1388,是餐饮点餐)。`RoomCartScreen` 的依据是 Figma `2659:11842` —— 按第 1 点 Figma 同为 source of truth,所以**不是做错了**;但 PRD 描述的交互只到「房型行上的加减器」,购物车页是 Figma 额外叠的一层。别把「PRD 没写」读成「实现跑偏」。

---

## 一、PRD 是怎么规定的

| 主题 | PRD 位置 | 要点 |
|---|---|---|
| 同酒店多房间 | §17 change log #21(1239) | 可同房型多间,也可不同房型 |
| **加减器初始值** | **§17.4(1275-1298)** | `Choose` → `− N +`;**唯一的硬规则**:*"The initial room quantity is always synchronized with the room count selected during Hotel Search"*;Lite / Full **都适用**(1298) |
| 多酒店 Trip | §1.1(93-163) | 多酒店 / 多住宿段("different destinations or stay periods")→ 一次 checkout → **一笔支付** → 各自独立 Booking ID 与生命周期(确认/改期/取消/退款/结算/历史) |
| Add More Stay | §17 #16(1230-1233) | 可展开/收起卡;**最大住宿段数由 Admin Portal 配置**;达上限则隐藏/禁用,移除一段后恢复 |
| Lite 禁多酒店 | §17 #17(1234)、§17.2(1255-1259) | Multi-Hotel Booking:Lite `—` / Full `✓` |
| 券资格 | §17.5(1300-1332) | 条件含 Room-Specific / Hotel-Specific / **Multi-Room(最少间数)** / **Multi-Hotel(最少酒店数)** / 最低金额 / **Early Bird(提前 N 天)** / 最少夜数 / 指定入住期 / 最高折扣封顶 |
| 券分摊 | §17.6(1334-1370) | 一单一券;**只对符合条件的房/酒店分摊**(*"Ineligible rooms/hotels must not receive any part of the coupon discount"*);定额券按合格房价占比分摊(公式 1362);明细须标出券作用在哪几间(1369) |
| 价格明细 | Long-Stay checkout(302-309) | 须显示 Original Price / Long Stay Discount / Coupon Discount / Final Payable |
| 部分失败 | §1.1(106、148-154) | 一单确认失败 → 只置该单 **Booking Failed** + 自动退款,其余保持已确认,并告知用户哪单失败 |
| 凭证 | 验收条款(1384) | 支付后 **10 秒内**出 PDF voucher,短信 + 邮件 + App 三处可取 |
| 状态轴 | §17 #1(1212) | Hotel Booking Status:`Confirming → Confirmed` / Payment Status:`Pending → Paid`(**与 line 691 矛盾,见第四节**) |
| 确认页 CTA | §17.1(1242-1250) | 确认页**不得**有 Cancel Booking;要有 View Details → My Picks / Booking Details 再改期或取消 |
| **My Pick 列表按 Trip 归并** | **Figma `289:1112`**(My Pick / Upcoming);PRD §1.1 Trip Management(157-163)、line 115 | **一个 Trip 一张卡**,明细留到详情页再展开。稿面实测四张卡:①单间 PAID ②待支付(主按钮是 **Continue Payment**)③**多房间**:房型行换成「**3 Rooms**」④**多酒店**:封面叠第二张图带「**2nd Stay**」角标 + 蓝字「**Multi Booking (2 Stay)**」。PRD 侧对应 Trip Summary / Trip Timeline(按入住日排序)/ 各酒店状态 / 各自独立管理 |

### PRD 明确「未提及」的(避免后人误判成缺口)

购物车 / My Rooms / Add Another Room、**每间房不同日期**(不同日期只按「酒店/住宿段」区分,line 96)、**每间房分别填入住人**(只有 Lead Guest + 按 room occupancy 加 guest,line 401)、税费 / 服务费 / 积分 / 会员折扣、**二维码核销码**(全文无 QR)、每间房单独凭证(凭证是按 booking/酒店,line 114)、按间取消(粒度是按 booking,line 110/142/145)、支付超时的**具体分钟数**(只有 "payment countdown timer",line 770)、最大间数的**具体数字**(1279-1283 那张 1/2/3/4 的表是示例;"subject to the total room requirement" 里的 total room requirement **PRD 自己没定义**)。

另外 line 97 注明:Multi-Hotel Booking *"subject to technical feasibility assessment with the Engineering Team before development"*。

---

## 二、已经对齐的(8 条)

| PRD | 现状锚点 |
|---|---|
| Choose → `− N +`、减到 0 变回 Choose(§17.4) | `components/hotel/HotelRoomCard.tsx` + 共用 `components/hotel/RoomStepper.tsx` |
| 一次结账、一笔支付、各房型各自一单(§1.1 101-105) | `api/trip.ts` → `TripController::create` / `pay` |
| 一单一券 + 按占比分摊、分摊额落库供退款结算(108、119-126、17.6 公式 1362) | `TripController::allocate()`(末位吸收余数,Σ=券额)→ `order_main.alloc_coupon_discount` |
| 只退被取消那一单、只退 mTrip 钱包(110-111、142-145) | 各预订沿用既有独立退款链路,`refund_channel=1` |
| 结果页分离 Booking / Payment 两条状态轴(§17 #1, 1212) | `screens/hotel/BookingSuccessScreen.tsx`(两行状态 + 药丸) |
| 确认页去掉 Cancel、只留 View Details → My Picks(§17.1) | 结果页只有一枚 View Booking,`navigation.reset` 到「我的预订 + 订单详情」 |
| Lite 不给多酒店(§17 #17、17.2) | `useBookingWizard({ useCart: false })`;Lite 详情页用自己的本地 `picked`,不碰 `roomCartStore` |
| 明细不编税费 / 服务费 / 积分(PRD 未提及) | `RoomCartScreen.tsx` 的 `RATES` / `EARN_POINTS` 全 0 且为 0 时整行不显示 |

---

## 三、9 处实质差异

| # | PRD 要求 | 现状锚点 | 后果 |
|---|---|---|---|
| 1 | §17.4(1275-1298):加减器初始值 = 搜索页房间数 | `store/roomCartStore.ts:105` 固定 `quantity: 1`。**更根上**:`screens/hotel/HotelsScreen.tsx:157-168` 与 `screens/hotel/HotelResultsScreen.tsx:324-330` 的 Guests & Rooms 都是写死 `{adults: 2, rooms: 1}` + `onPress={comingSoon}`;`HotelResults` / `HotelDetail` 路由(`navigation/types.ts`)只透传 checkIn/checkOut/flexDays/citizen,不带 rooms/adults/children | PRD 唯一的硬规则**无源可同步**:搜 3 间也永远从 1 间起 |
| 2 | §1.1(96):Trip = 多酒店 / 多住宿段 | 后端 `TripController::create:69` 本就支持 1-10 项跨物业、每项自带 `useDate/endDate`;卡点在 `roomCartStore.ts:95`(换物业即清空车)与 `useBookingWizard.ts:420-422`(`addSecondStay` 仅演示模式) | §1.1 的**主场景没有 UI**;我们做的是「同一家酒店多房型」 |
| 3 | §1.1(106、148-154):一单失败只退那一单,其余保持确认,置 Booking Failed | `TripController.php:234` 单个 `Db::transaction` 全成全败;`Constants/BookingConst.php` 止于 `STATUS_NO_SHOW = 6`、`order_main.order_status` 只有 0~7、`order_trip.pay_status` 只有 0/1/2 → **没有任何字段能表达「部分成功」** | 与 PRD 硬规则相反(仓库自己也记为「结构化占位」,见 `实现方案-ConsumerApp-PRDv1.0.md:155`) |
| 4 | §17.5 / §17.6(1300-1370):券按资格条件判定,**只对合格房分摊** | `PricingService.php:96-103` 只校验范围 + `min_amount` + `max_discount`,且**全有或全无**(不符合直接抛错);`TripController::allocate():418` 按**全部**预订净额平摊。`marketing_coupon.min_nights` / `max_nights` / `book_advance_days` 三个字段**商户端能配、能显示**(`Merchant/PromotionController.php:342,571,681`)但**下单时无人校验**(`PricingService` 与 `CouponView` 的 `REASON_*` 里都没有) | 不合格的房也吃到折扣;最少间数 / 最少酒店数 / 提前天数三类券做不出来 |
| 5 | 302-309:明细须显示 Original / Long Stay Discount / Coupon / Final | `useBookingWizard.ts:319-325` 的 `cartTotal` / `roomsTotal` 用 `sku.base_price × 晚数 × 间数` —— **不减长住折扣、不取 `goods_daily_stock` 日历价、不走公民价**;`ReviewBody.tsx` 真实模式只有房费 + 券两行 | 显示金额可能高于实扣;`useBookingWizard.ts:607` 的 `walletBalance < payableTotal` 会**误拦付得起的用户** |
| 6 | §5(401):按 room occupancy 填多位入住人 | `useBookingWizard.ts` 组 `tripItems` 时**一个 `travelers` 都不提交**(单单路径提交 1 个);而后端 `TripController::prepareItem` 已经在调 `normalizeGuests($item['travelers'], $quantity)` | 多房间订单的住客信息全空,后端白等 |
| 7 | 1384:支付后 10 秒内 PDF voucher,短信 + 邮件 + App | 无 PDF / 邮件 / 短信;Download Voucher、Save E-receipt 仍是 comingSoon | 唯一的凭证硬指标未达成(⚠️ 注意 PRD **没要求二维码**,所以结果页去掉 QR 不算差异) |
| 8 | — | `TripController.php:212` 文案「请在15分钟内完成支付」,实际 `BookingConst::PAYMENT_WINDOW_MINUTES = 10` 驱动 `payment_expires_at`(单单路径 `OrderController.php:213` 已是 10 分钟) | 用户按 15 分钟算,第 11 分钟单子已被扫掉 |
| 9 ✅**已修(2026-09-22)** | Figma `289:1112`:My Pick **一个 Trip 一张卡**,多房间显示「3 Rooms」、多酒店显示「Multi Booking (2 Stay)」+「2nd Stay」叠图,明细留到详情页 | `screens/mypick/useMyPickData.ts:71` 走 `fetchOrderList`(`/app/order/list`)**平铺 `order_main`**,`MyPickScreen.tsx:107-127` 一行一卡;后端 `OrderController::list:355-357` 的 select **连 `trip_id` 都不返回**,客户端无从分组。`TripController::list` 虽然在,但只回 trip 主单字段(trip_no / total_amount / pay_amount / booking_count / pay_status),**没有酒店名 / 封面 / 入离日期**,撑不起这张卡 | **一个 3 房型的 Trip 在「我的预订」会被拆成 3 张卡**,各自一个 Booking ID 与金额,与设计完全相反;PRD line 115「Trip History:用户在一个 Trip 下看到所有预订」也没落地。另外现有卡把 `quantity`(间数)塞进了 travelers 位(`MyPickScreen.tsx:123`),而稿面 travelers 与 rooms 是两个字段(「2 travellers, 1 room」) |

---

## 四、已经拍板的做法(2026-09-22,勿重复讨论)

1. **§17.4 的前置 —— 复用 Lite 的 `GuestRoomSheet`,不另做一版。**
   它本来就是用订房向导 `1675:6180` 的 `components/hotel/booking/GuestCounterRow` 拼的(见 `components/hotel/lite/GuestRoomSheet.tsx:5,22`),**不是 Lite 专属**。做法:文件从 `components/hotel/lite/` 挪到 `components/hotel/`,i18n 键 `hotels.lite.guestSheet.*` → `hotels.guestSheet.*`,3 个调用点跟着改(`HotelsLiteScreen` / `HotelBookingLiteScreen` / `booking/lite/LiteStepConfirm`)。`GuestRoomValue` / `DEFAULT_GUEST_ROOM` 两个导出保持不变。
2. **失败态落 `booking_status = 7 (Booking Failed)`,`LEGACY_ORDER_STATUS` 映射到旧 `order_status = 4 已取消`**,**不**新增 `order_status = 8`。
   理由:新增 `order_status` 要改遍 admin-web / merchant-web / client-app 的状态 switch、筛选器与文案,回归面过大;`booking_status` 这一档足够让财务与客服看出「预订失败」,钱的故事由 `payment_status` / `refund_status` 承载。**前提**:报表里「已取消 + 已退款」可接受。

---

## 五、需要产品拍板的 4 个问题(不是代码问题)

1. **PRD 自相矛盾:`Confirming` 挂哪条轴?**
   line 691:*"Payment status remains Confirming until the gateway confirms the transaction"*(**支付网关**态);line 1212(§17 #1):`Hotel Booking Status: Confirming → Confirmed`(**预订**态,而支付是 Pending/Paid)。后端两条状态机都没有「等酒店确认」,mock 支付成功即确认。
   影响:结果页与订单详情的状态药丸、以及 line 692「用户可手动刷新支付状态」要不要做轮询。`navigation/types.ts` 已留 `status?: 'confirming' | 'confirmed'` 两态待命 —— **拍板前不要做轮询**。
2. **`RoomCartScreen` 要不要留?** 来自 Figma 不来自 PRD;与复核页的 `SelectedRoomsCard` 内容重复,但「移除房型」的确认弹窗(`2659:12483`)只在它这儿,详情页底栏也链到它。建议留,但应显式决定而不是默认留着。
3. **「Add More Stay」的一个 stay 是什么?** 只指换酒店,还是也含同酒店不同日期段?决定购物车 store 是按物业分组还是按 stay 分组,以及「最多 3 段」怎么数。(按 stay 分组是安全的超集。)
4. **每间房填几位入住人?** 一间一位,还是按 `hotel_room_type.max_guests`?决定 §5 那一步的整体形态(现有 `ADDITIONAL_QUOTA = 2` 只是设计稿常量)。
5. ~~My Pick 归并卡上的状态口径~~ **✅ 2026-09-22 已拍板并落地**:取组内**最靠前的待办态**
   (优先级见 `useMyPickData.ts` 的 `STATUS_PRIORITY`),页签也按这个归并状态过滤,
   所以一个 Trip 只会出现在一个页签里(例:两单已完成 + 一单已取消 → 归「已完成」,
   因为「已完成」比「已取消」更靠前)。
   ⚠️ **金额口径仍未定**:卡面现在不显示金额(稿面也没有),等 Trip 详情页做的时候一并定
   (建议取 `order_trip.pay_amount`,而不是首单的 `pay_amount`)。

---

## 六、优先级与顺序(供下次接手)

**P0(不动表)**
- §17.4 房间数同步:补 `GuestRoomSheet`(见第四节做法)+ 路由透传 rooms/adults/children + `toggle` 收可选初始间数(**要按 `sku.base_stock` 夹一下**,否则搜 4 间遇到只剩 2 间的房型会在结算时才报「库存不足」)。
- 新增 `POST /app/order/trip/quote` 只读试算:给 `OrderStockService::lock` 加 `$dryRun`(同一套取价代码,不写库)、`PricingService::resolveCoupon` 加 `$lock=false`,返回逐项与合计的 original / longstayDiscount / couponDiscount / payAmount;复核页与购物车页据此显示 PRD 要求的四行,`payableTotal` 改吃试算值。**前端不自己算钱**,与 `useBookingWizard.ts:13` 的既有约定一致。
- 差异 8 的 10 分钟文案(一行)。
- ~~差异 9 My Pick 按 Trip 归并~~ **✅ 已于 2026-09-22 落地**(Figma `3003:8863` 下的三种卡形态):
  后端 `OrderController::list` 的 select 补 `trip_id`(列已存在,未动表);`useMyPickData` 新增
  `groupOrdersByTrip()` 把同 `trip_id` 折成一条 `MyPickBooking`,**页签按归并后的状态过滤**;
  `BookingCard` 加 Booking ID 行、多房间「N Rooms」、多酒店缩略图带(首图 + 第二段压 60% 黑幕 +
  「2nd Stay」)与「Multi Booking (N Stay)」蓝字;两个模式共用同一份归并结果。
  **状态口径按用户拍板**:取组内**最靠前的待办态**(待支付 > 退款中 > 已支付 > 已核销 > 已完成 >
  已退款 > 已取消 > 已过期),卡上状态与「View Details」进的那一单保持一致。
  仍未做(与本条同源,单独列在下面 P1/P2):**Trip 详情页**(点进去展开多房间/多酒店明细)——
  `trip/detail` 已按入住日排序返回各预订(对得上 PRD Trip Timeline),缺的只是 UI 与设计稿;
  以及待支付卡稿面的整宽「Continue Payment」—— 订单详情页目前**没有续付入口**
  (`OrderDetailScreen` 只有取消/退款/核销码),按钮做出来点了也付不了,所以先保持 View Details。

**P1(动表)**
- 部分失败:按第四节决定落 `booking_status = 7` + `order_trip.pay_status = 3 部分成功`;`pay` 拆成「先收钱 → 再逐单确认,单单 try/catch,失败者退款 + 释放库存 + 事件日志」。⚠️ 钱与确认不再原子,需要一个幂等补偿任务兜底(先核实 `PaymentResultHandler::markPaid` 真的幂等)。
- 券按资格分摊:`marketing_coupon` 补 `min_room_count` / `min_hotel_count`,顺带**启用已有的 `book_advance_days` / `min_nights` / `max_nights`**;`PricingService` 出一个按 legs 判定的方法(现有 `resolveCoupon` 降级为单 leg 包装,`OrderController` 零改动);`allocate()` 只在合格 leg 间分摊;`CouponView` 补不可用原因码。admin / merchant 的券表单要同步能配,否则「由 Admin Portal 控制」是空话。

**P2**
- 跨酒店 Add More Stay:`roomCartStore` 重构成按 stay 分组(**要等 P0 的 quote 与 P1 的券口径定了再动**,否则每项契约都要改两遍);上限走 `sys_site_config`(`config_group='app'`,C 端 `/app/site/config` 已有通道)—— ⚠️ `siteStore.hydrate()` 目前不拉 configs,冷启动 `configs` 是空的,要先补。
- 按房间数填多位入住人(差异 6 的一行版可以先做:trip 各项带上 Lead Guest,后端已经在等)。

**依赖关系**:P1 的券展示与 P2 的逐项金额都要吃 P0 的 `trip/quote`;P1 的部分失败只依赖第四节的决定,可独立开工。
