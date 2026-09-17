# 模块10:移动端 client-app(Expo 51 + RN + TS)

2026-09-15 dev 同步：已整合远端 `29614ea` 与本地物业改动，保留余额支付与关怀模式；物业收藏映射迁入共享 `useMyPickData`，两种模式酒店详情均使用 `propertyId`。订房页保留物业下单与钱包支付。client-app 类型检查、订单控制器 PHP 语法检查通过。

状态:已完成 | 进度:100% | 依赖:模块09 | 更新时间:2026-07-28

## 目标

按《移动端前端框架设计方案》在 `client-app/` 搭建 Expo 51 + React Native + TypeScript 一套代码多端(iOS/Android/H5)项目,
接口对标模块09 `/api/v1/app/*` 微服务,落地统一请求、鉴权、多站点、多语言、多币种、GDPR 规范。

## 技术选型(设计方案定型,不可变更)

Expo 51 / TypeScript / Zustand / React Navigation 6 / Axios / i18next + react-i18next / AsyncStorage

## 任务清单

### 工程基础
- [x] package.json / app.json / tsconfig / babel / .gitignore / .env(EXPO_PUBLIC_*)
- [x] 目录结构按设计方案第三章(api/assets/components/config/hooks/i18n/logs/navigation/screens/store/types/utils)

### 全局底层
- [x] config:env.ts(三环境)、global.ts(常量)、theme.ts(主题)
- [x] utils:storage(统一AsyncStorage)、format(金额/时间/脱敏)、validate、device(isApp/isH5/getClientType)、gdpr、debounce
- [x] logs:logger(开发全量打印/生产仅核心,携带站点/设备/用户)
- [x] api/request.ts:Axios 单例,自动携带 Authorization、X-Site-Id、X-Client-Type、X-Timestamp、X-Lang;
      统一状态码解析(0 成功/40101、40102 清登录态跳登录/站点禁用提示)、错误 Toast、日志上报
- [x] api 模块:types.ts、user.ts、site.ts、goods.ts、order.ts、pay.ts
- [x] api/marketing.ts(2026-09-07,C-M6.1):活动列表/详情、领券中心、领取、我的券、券详情、
      促销码兑换、结账择优七个接口;券字段口径由后端 `App\Service\CouponView` 统一产出,
      前端侧的「字段 → 卡片文案」唯一出口是 `screens/promotions/couponFormat.ts`

### 状态与国际化
- [x] store:useUserStore(登录态持久化)、useSiteStore(站点/货币/语言/时区)、useCommonStore
- [x] i18n:i18next 初始化,assets/i18n/zh-CN.json、en-US.json,t() 全局,站点默认语言联动

### 公共组件
- [x] common:CustomButton、CustomInput、EmptyView、LoadingView、ErrorView(StateViews 三合一)、Toast(ToastHost 全局轻提示)
- [x] business:SiteSwitchEntry、GoodsCard、OrderItemCard、PriceText(多币种)、VerifyCodeView
- [x] layout:PageLayout(安全区/滚动)、ListLayout(下拉刷新/上拉加载/空错态)

### 导航与页面
- [x] navigation:RootStack + 底部 Tab(首页/订单/我的),需登录页由页面内守卫(isLogin)跳登录
- [x] screens/home:首页(站点切换入口、搜索、酒店/门票入口、推荐/热门商品)
- [x] screens/site:站点选择页(切换联动货币/语言)
- [x] screens/goods:商品列表(排序Tab/分页)、商品详情(SKU选择/退改规则/预订守卫)
- [x] screens/order:下单确认页(日期/数量/联系人/预估价)、订单列表(状态Tab/获焦刷新)、订单详情(余额支付/核销码/取消/退款申请;Stripe/PayPal 置灰 Coming soon)
- [x] screens/user:登录页、注册页(注册即 GDPR 授权)、我的(资料/余额积分/语言切换/GDPR/退出)

### 验收
- [x] npm install 依赖安装成功(1192 packages)
- [x] tsc --noEmit 类型检查零错误
- [ ] Expo 启动冒烟(归模块08 联调)

## 完成记录

- 2026-07-28:client-app 全量落地。App.tsx 启动引导(bootstrapStores 注入请求/日志钩子 → hydrate → i18n)
  → AppNavigator(RootStack + BottomTab)。防循环依赖采用钩子注入模式(setRequestHooks / setLogContextProvider)。
- 数据形态对齐模块09:user 模块 camelCase,goods/order/site 为数据库 snake_case 原始行(types/models.ts)。
- 验收:npm install 成功;`npm run typecheck`(tsc --noEmit)零错误。Expo 冒烟联调留待模块08 网关部署后进行。
- 配套文档:docs/guides/api/移动端接口规范.md。
- 2026-08-21:酒店页(`screens/hotel/HotelsScreen.tsx`)顶部栏筛选按钮接入 `components/hotel/HotelFilterSheet.tsx`
  (Figma `Filter overlay` node `408:1824`,底部升起浮层)+ `components/hotel/PriceRangeSlider.tsx`(PanResponder 双滑块)。
  列表接口无价格/设施筛选参数,选择结果暂只留在页面状态;完整记录见 docs/plans/HANDOFF.md「★ 前端 redesign 进展」。
- 2026-08-24:酒店页搜索卡的入住/离店接入 `components/hotel/DatePickerSheet.tsx`
  (Figma `Choose Date` node `695:1428`,居中卡片浮层:双日期卡 + 总晚数 + 月份切换 + 七列日历 + 节假日说明 + 弹性日期档 + Confirm)。
  列表接口无日期参数,选中区间只回填搜索卡;完整记录见 docs/plans/HANDOFF.md「★ 2026-08-24」。
- 2026-08-24:新增酒店搜索结果页 `screens/hotel/HotelResultsScreen.tsx`(Figma `Long Stay Search Results` node `1695:6325`)
  + `components/hotel/HotelResultCard.tsx` + `components/hotel/SortSheet.tsx`;酒店页 Search 由跳 GoodsList 改跳 `HotelResults`。
  chips 与排序落到 `/app/goods/list` 的真实参数(reviewScore/freeCancel/breakfast/amenities/sortBy);
  排序面板按 Figma `Sort by` node `901:1673` 做成锚定 chip 下方的卡片(六项,Nearest Distance 因未接定位走 comingSoon)。
  接口没连通/无结果时列表回落到 `screens/hotel/demoResults.ts`(照搬设计稿四张卡的原始数值与文案,带可点重试的提示条)。
  完整记录见 HANDOFF「★ 2026-08-24(搜索结果页)」。
- 2026-08-25:新增酒店详情页 Overview 页签 `screens/hotel/HotelDetailScreen.tsx`(路由 `HotelDetail`,
  Figma `Hotel Details Overview` node `94:438`)+ `components/hotel/HotelGallery.tsx` + `components/hotel/HotelDetailTabs.tsx`
  + `screens/hotel/detailDemo.ts`;搜索结果页的演示卡由 `comingSoon` 改为跳这里。
  **当前是静态页**:数值/文案全部来自设计稿,尚未接 `/goods/detail`;Rooms 等其余五个页签与 See Map / 提醒 /
  分享 / 客服 / Choose my room 一律走 comingSoon。完整记录见 HANDOFF「★ 2026-08-25(酒店详情 Overview)」。
- 2026-08-25:补齐酒店详情其余五个页签(Figma `Hotel Details` node `759:9776` 下的五张稿),
  页面改为「一个壳 + 六个页签内容组件」:`components/hotel/HotelOverviewTab`(从页面里拆出)/
  `HotelRoomsTab` + `HotelRoomCard` / `HotelAmenitiesTab` / `HotelNearbyTab` / `HotelReviewsTab` /
  `HotelPoliciesTab`,公共卡壳与标题样式收敛到 `components/hotel/detailShared.ts`。
  底部价格栏在 Rooms 页签隐藏(设计稿 222:2529 是 hidden 的,每张房型卡自带 Select)。
  仍是静态页;地图、Read All Reviews、房型 See Details/Select、面积单位切换等一律 comingSoon。
  完整记录见 HANDOFF「★ 2026-08-25(酒店详情其余五个页签)」。
- 2026-08-31:注册页 `screens/user/RegisterScreen.tsx` 按 Figma `Signup` node `505:1498` 重做,
  与登录页共用版式(主色底 + 插画 + 顶部栏 + 白色表单卡),字段改为手机号(+95)/邮箱/密码/确认密码 + 条款勾选,
  删掉设计稿没有的昵称栏(后端 nickname 为空会自动取「User+手机后四位」);Register 路由关掉 Stack 头。
  邮箱栏后端注册接口暂不接收,按选填处理并照常上送;完整记录见 HANDOFF「★ 2026-08-31(注册页)」。
- 2026-08-31:新增开屏页 `screens/splash/SplashScreen.tsx`(Figma `Splash` node `452:2190` + `2163:8057`),
  由 `App.tsx` 按 boot → language → app 三段驱动,取代原来的 `LoadingView`;
  **首次进入**(本地没存过语言)开屏后弹语言选择卡,默认选中系统语言(`utils/locale.ts` + expo-localization,取不到回落 en-US)。
  新增缅甸语 `assets/i18n/my-MM.json`(**机器翻译,待母语者复核**),`SUPPORTED_LANGS` 扩为 en-US / my-MM / zh-CN。
  完整记录见 HANDOFF「★ 2026-08-31(开屏与语言选择)」。
- 2026-08-31:优惠中心 `screens/promotions/PromotionsScreen.tsx` 按 Figma `Promotion` node `1633:3300` 重做
  (原为 EmptyView 占位),落成「一个壳 + 两个页签(优惠活动 / 我的优惠券)+ 两个弹层」,
  另加券详情页 `screens/promotions/CouponDetailScreen.tsx`(路由 `CouponDetail`)。
  新增 `components/promotion/*`(CouponCard / PromoTabs / CampaignBanner / CampaignOverview /
  PromoDialog / promoShared);**当前是静态页**,后端无活动与优惠券接口,数据走
  `screens/promotions/promoSections.ts`,领取只弹设计稿的成功提示,其余动作一律 comingSoon。
  完整记录见 HANDOFF「★ 2026-08-31(优惠中心)」。
- 2026-08-31:「更多」页 `screens/user/MineScreen.tsx` 按 Figma section `More` `1695:5951` 重做,
  并补齐 8 个子页(`screens/more/*`:Account / Travelers / EditEmail / Referral / ReferralStatus /
  HowReferralWorks / Guides / LegalTerms,均新增 Stack 路由)。新增 `components/more/*`
  (MenuLink / MorePageLayout / ReferralStatsCard / LanguageDialog / moreShared)。
  **除资料与余额外都是静态页**(后端无钱包/推荐/教程/条款接口),数据走 `screens/more/moreDemo.ts`;
  语言切换/GDPR/站点/订单这些设计稿没有、但项目已有的功能收进「更多」页新增的第三张卡。
  完整记录见 HANDOFF「★ 2026-08-31(更多与子页)」。
- 2026-08-31:新增通知页 `screens/notification/NotificationScreen.tsx`(Figma section `1770:3863`,
  System / Booking 两个页签),路由 `Notifications`;首页与「我的精选」顶部栏的铃铛由 comingSoon 改跳这里。
  同批把反复出现四次的分段页签抽成 `components/common/SegmentedTabs.tsx`(优惠中心 / 推荐明细 /
  教程与指南 / 通知共用)。**静态页**:App 侧没有消息接口,数据走 `screens/notification/notificationDemo.ts`。
  完整记录见 HANDOFF「★ 2026-08-31(通知页)」。
- 2026-09-01:新增订房流程(Figma section `Multi Booking Hotel Booking Flow` `1675:5776`)。
  向导落成**一个路由 + 内部分步**:`screens/hotel/HotelBookingScreen.tsx`(路由 `HotelBooking`)
  按 dates → guests → review →(多住宿才有)trip → payment 切换,内容各自一个组件
  (`components/hotel/booking/BookingStep{Dates,Guests,Payment}` + `ReviewBody`,trip 段内联)。
  另新增 4 个独立屏:`AddGuestScreen` / `InsuranceScreen` / `StayDetailScreen` / `BookingSuccessScreen`。
  酒店详情房型卡的 Select 与底栏「Choose my room」不再是 comingSoon:前者进向导,后者切到 Rooms 页签;
  「更多 / 常用旅客」的「Add New Guest」也接到同一张新增旅客页。
  新增 `components/hotel/booking/*`(bookingShared / bookingFormat / BookingProgress / BookingBottomBar /
  BookingSummaryBar / BookingCalendar / GuestCounterRow / AddOnCard / FormField / SelectSheet /
  WheelPickerSheet / AlertDialog / ReviewCards / ReviewBody / StaySummaryCard / PaymentMethodRow),
  `HomeIcon` 新增 19 枚设计稿图标,`assets/images/temp/hotel/booking/` 新增 15 张素材。
- 2026-09-01:修复真实酒店卡不进入酒店详情真实 Rooms 的问题。`HotelResultsScreen` 中接口返回的真实酒店改为携带 `id` 跳 `HotelDetail`;
  `HotelDetailScreen` 在有 `id` 时拉 `/api/v1/app/goods/detail`,标题、地址、图库、起价和 Rooms 页签使用接口数据,
  无 `id` 的演示卡仍保留设计稿静态数据。`HotelRoomsTab` 支持渲染真实 `skus` 房型并把 Select 接到真实 `OrderConfirm`(未登录先跳登录),
  空房型显示空态。`npm run typecheck` 通过。注意:C 端仍只展示同站点、已上架、已发布到 marketplace 的酒店;房型须 `status=1` 且 `publish_status=2`。
- 2026-09-01:订房第 1 步去掉摘要卡上的日期选择弹层(`DatePickerSheet`)——
  下面已有常驻的 `BookingCalendar`,同一件事两个入口且弹层会盖住日历;摘要卡日期区改为纯展示。
  连带在 `goNext` 的 dates 步拦住「只点了入住日、离店日还空着」的半选状态
  (新增 `hotels.booking.dates.checkOutRequired`)。`DatePickerSheet` 组件保留,酒店搜索页仍在用。
- 2026-09-01:预订成功页的二维码由设计稿静态图改为现场生成 `/app/order/pay` 返回的核销码
  (`verifyCode` 经路由参数传到 `BookingSuccessScreen`),新增依赖 `react-native-qrcode-svg`
  (peer 为已装的 `react-native-svg`);无核销码时仍回落静态图,设计稿走查不受影响。
- 2026-09-01:修复「搜索页选好日期 → 选房后日期被重置、金额与晚数对不上」。
  `HotelDetail`/`HotelBooking` 两条路由加 `checkIn`/`checkOut`,搜索结果页 → 详情页 → 向导逐级透传;
  `BookingStay` 改为持 `units`(每晚每间基数)+ `scaleStay()` 按晚数 × 间数摊开,构造与 `patchStay` 都过它,
  演示/真实两种模式统一一套算法(默认 1 晚 1 间时与设计稿原值一致)。
  另加 `normalizeDates()` 兜住「没传 / 离店不晚于入住 / 入住早于今天」三种情况。
- 2026-09-01:「我的精选」的预订卡与收藏酒店卡的真实数据也回落设计稿临时封面(此前只有酒店搜索结果页有兜底,
  后端封面是脏值/空值时这两处只剩渐变空块)。兜底规则抽成 `assets/tempImages.ts` 的 `tempCoverFor(index)`,
  `HotelResultsScreen` 原局部的 `REAL_COVER_FALLBACKS` 删除改调它,保证同一家酒店在两个页面是同一张图。
- 2026-09-01:订房向导接后端下单。房型卡 Select 带 `goodsId`/`skuId` 进 `HotelBooking` 即进入**真实模式**:
  酒店名/房型名/单价来自 `/app/goods/detail`,房费按「`base_price` × 晚数 × 间数」随日期与间数重算
  (与后端锁库存的算法一致,已实测 2 晚 × 2 间 = 600 对齐),支付步真的调
  `/app/order/create` + `/app/order/pay` 落单,成功页展示真实单号与实付。
  不带参数进入仍是**演示模式**,数值走 `screens/hotel/bookingDemo.ts`,不发任何请求。
  真实模式下不提交加购项(后端无价目表,仅页面展示)、多住宿走 comingSoon(后端一次只收一个 sku)。
  顺手修了一个后端硬伤:`order_main.guests` 列建成了 JSON 却存 AES 密文,**任何带住客名单的下单都 500**,
  已加 `database/order/06-guests-column-type-fix.sql`(JSON → TEXT,幂等)并登记进 compose initdb。
  完整记录见 HANDOFF「★ 2026-09-01(订房接后端下单)」。
- 2026-09-03:注册链路补齐设计稿 Onboarding(Figma section `752:9380`)的后两步 ——
  新增短信验证码页 `screens/user/VerifyOtpScreen.tsx`(`566:3741` / `566:3902`,路由 `VerifyOtp`)
  与推荐码页 `screens/user/ReferralCodeScreen.tsx`(`1077:1734`,路由 `ReferralCode`)。
  **短信通道未接**:验证码页预填演示码 `123456`,只校验位数、填什么都通过,重发仅重置倒计时;
  **推荐码则真的上送**(`apiRegister` 补 `referralCode`,Skip 即不带码)。
  后端注册接口一次性收单,故 `RegisterScreen` 改为只校验不落库,`SignupDraft` 透传到推荐码页统一提交。
  同批把四张稿共用的外壳(主色底 + 插画 + 顶部栏 + logo/标语)抽成 `components/user/AuthShell.tsx`,
  Login / Register 一并改用。完整记录见 HANDOFF「★ 2026-09-03(短信验证码页 + 推荐码页)」。
- 2026-09-03:「我的精选」的收藏酒店改为**只显示真实收藏** —— `MyPickScreen` 由 `useEffect` 改 `useFocusEffect`
  (常驻 Tab 切回来要重拉,否则酒店页收藏完看不到);登录后收藏为空显示空态而不是设计稿示例卡
  (示例卡只留给未登录);`StayCard` 新增可选 `favorite` / `onToggleFavorite`,收藏列表里心形实心可点,
  点了调 `/user/favorite/remove`;收藏的酒店点卡改跳 `HotelDetail`(原先一律跳 `GoodsDetail`)。
  完整记录见 HANDOFF「★ 2026-09-03(我的精选 / 收藏酒店)」。
- 2026-09-03:「更多」页去掉原生导航头(居中「More」),只保留设计稿 `1690:4642` 的 mTrip 字标栏 ——
  `MoreTab` 补 `headerShown: false`(它此前是唯一没设的 Tab,bottom-tabs 默认 `true` 才多出那条);
  `MineScreen` 的 `SafeAreaView edges={['top']}` 必须保留,原生头一关状态栏就得页面自己让开。
  完整记录见 HANDOFF「★ 2026-09-03(「更多」页去掉原生顶栏)」。
- 2026-09-03:H5 端摘掉浏览器给 `<input>` 的**聚焦框与自动填充黄底** ——
  新增 `utils/webStyles.ts` 的 `applyWebGlobalStyles()`,由 `App.tsx` 启动时调一次(原生端空转)。
  全项目 20 个 `TextInput` 散在 14 个文件里,故走一处全局补丁而非逐个改 style。
  完整记录见 HANDOFF「★ 2026-09-03(H5 输入框聚焦黄框)」。
- 2026-09-03:修复首页搜索框的 Explore 按钮在部分机型 / H5 上被顶出圆角白底 ——
  `components/home/SearchSection.tsx` 的 `input` 漏了 `minWidth: 0`(全项目 5 处 flex 输入框只有它漏),
  web 端 `<input>` 的 `min-width: auto` 压不下去导致整行溢出;另给按钮补 `flexShrink: 1` 与
  文字 `numberOfLines={1}` 作为窄屏兜底。完整记录见 HANDOFF「★ 2026-09-03(搜索框按钮溢出)」。
- 2026-09-07(C-M6.1,9月计划第1周):**优惠中心由静态页改为真实数据**。
  新增 `api/marketing.ts` 与 `screens/promotions/couponFormat.ts`(券字段 → 卡片文案的唯一出口,
  领券中心 / 我的券 / 券详情三处共用,免得同一张券在不同页面显示成不同金额或状态);
  `PromotionsScreen` 接活动 + 领券中心 + 我的券三份数据并承担领取 / 兑换 / 刷新,
  `CouponsTab` 补「有效 / 已用 / 失效」三分类与真实促销码兑换,
  `CouponDetailScreen` 按路由参数(`receiveId` 我的券 / `couponId` 券模板)拉真实详情、
  条款改由券数据生成,`CouponCard` 改吃卡片模型不再认后端字段。
  **登录后不再出现静态券**(为空给空态文案),设计稿示例券只留给未登录 —— 与「我的精选」同一口径。
  促销码失败按后端五个独立错误码分别给文案(`api/types.ts` 的 `API_CODE.PROMO_*`)。
  完整记录见 HANDOFF「★ 2026-09-07(C-M6/C-M6.1 优惠中心真实化)」。
- 2026-09-07(C-M6,9月计划第2周):**订房 Step 3 结账选券**(Figma `228:5118`)。
  进入复核步自动应用最优券,点价格明细里的券行打开 `components/hotel/booking/CouponPickerSheet.tsx`
  更换 / 不使用 / 恢复最优券;改日期或间数后房费变了会重新试算。
  `ReviewCards.PriceRow` 扩了 `discount` / `note` / `actionLabel` + `onPress` 四个可选字段
  (折扣行样式取自设计稿里那条隐藏的 `869:2503`「Member Discount」);
  `ReviewBody` 的 `coupon` 入参是可选的 —— 不传就不显示券行,Stay 明细页与演示模式行为不变。
  每张券的抵扣额一律来自后端 `/marketing/coupon/match-list`,**前端不自己算**
  (必须与下单时 `PricingService::resolveCoupon` 同一公式,否则显示的优惠与实付对不上);
  下单提交的是领券记录 id 而不是金额。券的文案复用优惠中心的 `couponFormat`。
  完整记录见 HANDOFF「★ 2026-09-07(订房 Step 3 结账选券)」。

- [x] **短信验证接入 SMSPoh Verify API V3**(2026-09-08):注册 / 验证码登录 / 忘记密码三个场景接真实短信,
  验证码页不再是预填 `123456` 的走过场。链路 `sms/send` → `sms/verify` 换一次性 `verifyToken`
  (Redis 10 分钟,绑定「站点 + 场景 + 手机号」)→ `register` / `login-by-sms` / `reset-password` 兑换;
  **验证码本身后端不持有**(SMSPoh 只回 `requestId`,码由服务商校验)。
  新增两页 `ForgotPasswordScreen` / `ResetPasswordScreen` 与登录页的「忘记密码」「验证码登录」两个入口
  —— **这四处设计稿都没画**,版式复用 AuthShell + 验证码页那张带描边的白卡。
  **首次发码放在上一屏**(注册页 / 忘记密码页 / 登录页入口),验证码页只填码与重发:
  本页挂载再发一次会连发两条,且「号码已注册 / 未注册」必须在还能改号码的那一屏就报出来。
  格子数按后端 `pinLength` 渲染,不写死 6(后台配 4 位时写死会让 Continue 永远点不亮)。
  站点未配渠道(50021)时注册流程直接跳过验证码页,与后端「渠道启用才强制」对齐。
  完整记录见 HANDOFF「★ 2026-09-08(App 短信验证接入 SMSPoh Verify API V3)」。

- [x] **开屏关怀模式选择页**(2026-09-14,Figma Splash `2485:7324`):引导流程补第三屏,
  变成「纯开屏 → 语言选择 → 模式选择 → 主流程」。两张卡各带一个 CTA(点哪张就按哪种模式进入,
  不是「先选中再 Continue」),选择存本地(`commonStore.liteMode` / `modeChosen`,键 `mtrip:app-mode`);
  语言与模式各记各的状态,老用户只补问模式这一屏。「更多」页原先那个 `useState` + comingSoon 的
  Lite Mode 开关已接到同一份状态 —— 页面脚注承诺的「随时在设置里改」这才成立。
  开屏外壳(波浪 + logo)抽成 `components/splash/SplashBackdrop.tsx` 供两屏共用。
  完整记录见 HANDOFF「★ 2026-09-14(开屏新增关怀模式选择页)」。

- [x] **关怀模式三屏**(2026-09-14,Figma section Home Lite `2540:21120`):`liteMode` 开始真的换页面。
  首页 / 我的精选 / 更多三屏各出 Lite 版,**在 Tab 这一层分叉**(`MainTabs` 按 `liteMode` 选组件
  与 `LiteTabBar`),不在页面内写分支;优惠中心没有 Lite 稿,沿用完整模式那一页。
  「我的精选」的取数抽成 `useMyPickData` 由两种模式共用 —— 同一账号在两种模式下看到的
  订单与收藏必须是同一份。Lite 首页的四个业务线就是 `QUICK_ACTIONS` 那四个,落地规则一字不差共用;
  插画另存 `assets/images/lite/*.png`(现有 `home/*.png` 是整块蓝色方块图标,叠在蓝卡上会出错),
  Figma 原始分辨率 4.6MB 已按 3× 渲染尺寸压到 602KB。
  Lite More 按用户选定**补了设计稿没有的「语言 + 退出登录」卡**(缺了这两项会把关怀模式用户卡死),
  站点与 GDPR 按设计稿去掉。新增 `Outfit_700Bold`;i18n 三份各补 6 键(共 878)。
  **未实现**:设计稿的「Multi Booking (2 Stay)」多住宿卡(后端一单只对一个 sku,完整模式同样没做)。
  完整记录见 HANDOFF「★ 2026-09-14(关怀模式落地首页 / 我的精选 / 更多三屏)」。

- [x] **支付只留余额**(2026-09-15):订房向导支付步与订单详情的可用渠道收敛到 **mTrip 钱包余额**一种。
  MMQR / KBZPay / Wave Pay / 到店付 / 银行卡 / 手机银行 / Stripe / PayPal 一律**置灰 + Coming soon 角标**,
  点按只弹提示、不会被选中,也不再发任何支付请求(`PaymentMethodRow` 新增 `disabled` / `badge` 两个 prop)。
  余额支付是**真扣款**:`payOrder` 默认 `PAY_METHOD.BALANCE=3`,后端在同一事务里扣
  `user_info.balance` 并落 `user_balance_log` + `finance_flow`(见模块09 完成记录)。
  支付页的钱包卡与余额那行改读 `/app/user/me` 的真实 `balance`(演示模式仍回落 `bookingDemo` 数值),
  **进支付步 / 打开待支付订单详情会先刷新一次资料** —— 本地缓存的旧余额会把够钱的用户误判成余额不足。
  余额不足在客户端就拦住(不去创建那张十分钟后才过期的待支付订单),后端 `debit()` 是第二道闸。
  支付成功后刷新资料,钱包卡与「我的」页不会停在扣款前的数。
  两处 `payOrder` 合并为一份(`api/pay.ts`,`api/order.ts` 只做转出);i18n 三份各补 4 键(共 882)。

- [x] **关怀模式设为默认模式**(2026-09-15):引导缩回「纯开屏 → 语言 → 主流程」,
  `commonStore.liteMode` 初值 `false` → `true`,新装用户与从未选过模式的老用户直接进关怀版三屏。
  **模式选择页原样保留**:`App.tsx` 新增 `ASK_MODE_ON_LAUNCH = false`,`'mode'` 段 phase、
  `ChooseModeScreen` 渲染分支与 `onPickMode` 回调全部留着,翻回 `true` 即恢复三段引导。
  `hydrate()` 未改 —— 本地存过 `mtrip:app-mode` 的照旧读回,**显式选择优先于默认值**。
  改模式的唯一入口是「更多」页的 Lite Mode 开关(`MineScreen` / `MoreLiteScreen` 各一个,同一份状态)。

- [x] ~~**【临时】注册验证码走纯前端固定码页**(2026-09-15)~~ —— **已于 2026-09-16 整体撤销**,见下一条。新增 `screens/user/FixedOtpScreen.tsx`
  (路由 `FixedOtp`),**只认 `123456`、纯前端校验、不发任何网络请求**;
  注册流程 `Register → FixedOtp → ReferralCode`,**后端一行没改**。
  可行的前提:后台没有启用中的短信渠道 → `SmsVerifyService::enabled()` 为 false →
  `register` 不强制 `verifyToken`(已实测 `sms/send`、`sms/verify` 均回 50021,
  不带 token 的 `register` 成功)。
  真页 `VerifyOtpScreen` **原样保留、一行未动**;新页刻意不复用它的组件(混在一起会让
  「哪段是临时的」难分辨,删除时容易误伤),版式照搬但去掉倒计时与 Resend(本页没发过码)。
  **接通真实 OTP 时的删除清单**:`FixedOtpScreen.tsx` + `RegisterScreen` 的 `USE_FIXED_OTP`
  与那段 if + `navigation/index.tsx` 的 import 与 `Stack.Screen` + `types.ts` 的 `FixedOtp`
  路由项,四处都带同一句「临时 · 接通真实 OTP 时删掉」注释,删完原链路自动恢复。
  提示文案复用 `user.otp.fixedHint`(三语);
  **先前那版后端万能码 `MTRIP_SMS_BYPASS_CODE` 已整体回滚**(它是真的认证绕过,
  且与渠道解耦 —— 删光短信渠道也关不掉)。

- [x] **恢复注册的真实短信 OTP 链路**(2026-09-16,SMSPoh 已可测试、后台已配渠道):
      按上一条留的删除清单**四处全删**,并删掉 `screens/user/FixedOtpScreen.tsx`;
      注册恢复为 `Register →(sms/send)→ VerifyOtp →(sms/verify 换 verifyToken)→ ReferralCode`。
      `VerifyOtpScreen` 一直原样留着没动过,所以删完即自动接回,**没有新写任何代码**。
      **这次不是清理而是必修**:后台新配的渠道
      (`sys_sms_channel` id=4,`provider_code=smspoh`、`status=1`、`site_id=0` 全局、未删除)
      已使 `SmsVerifyService::enabled()` 对所有站点返回 true,
      而 `AuthController::register` 是「渠道启用即强制」——
      固定码页永远拿不到 `verifyToken`,留着的话每次注册都会被 `40111` 打回。
      **验证**:① 把 `api_key`/`api_secret` 密文取出、在 user-service 容器内用它自己的
      `MTRIP_AES_KEY` 解密成功(41 / 32 字符,`sign_name=SMSPohTest` 非空)——
      这四项正是 `channel()` 判 null 的全部条件,故 `50021 短信服务未配置` 不可能再出现;
      ② 经网关不带 `verifyToken` 调 `register` 返回 `40111 请先完成手机号短信验证`,
      且 `user_info` 行数 6→6 **无副作用**,反证渠道确实已生效;③ typecheck 零报错。
      **未做**:真实收发短信的端到端(需要一个能收码的真实缅甸号码,由用户自测)。

- [x] **注册页邮箱换姓名 + 右上角按钮改版**(2026-09-15,Figma Onboarding `2540:13083`):
  注册表单第二栏由邮箱改为**姓名且必填**(原邮箱是选填),图标用设计稿同款
  `fluent:rename-a-20-filled`(`HomeIcon.renameA`),占位符 `user.namePlaceholder`
  = "Enter your name"(三语,i18n 883→885);`SignupDraft.email?` → `realName: string`,
  `apiRegister` 入参同步替换,提交后落 `user_info.real_name`(见模块09)。
  `user.emailPlaceholder` / `user.invalidEmail` 两键保留,后续「完善资料」页还要用。
  右上角登录/注册入口(Login `2540:13084` 的 `2540:13182`、Signup `2540:13284` 同款)
  由纯白文字链改成**黑 25% 底、圆角 20、px12 py8 药丸**,文字 Inter SemiBold 20/24 白色;
  改在共用的 `AuthShell`,**登录/注册/验证码/推荐码/忘记密码五屏同时生效**。
  **左侧返回键(改版稿把图标 20 放大到 32)与其余样式按要求未动**;
  改版稿的「完善资料」两屏(`2540:13764` / `2540:13908`)整体未做。

- [x] **关怀模式酒店搜索三屏**(2026-09-15,Figma section `Hotel Search Lite` `2312:6435`):
  新增 `screens/hotel/HotelsLiteScreen.tsx`(路由 `HotelsLite`,设计稿 Search 14/15/16/18 四态合一)、
  `screens/hotel/HotelResultsLiteScreen.tsx`(路由 `HotelResultsLite`,Search Results `2312:6745`)、
  `components/hotel/lite/LiteHotelCard.tsx` 与 `components/hotel/lite/GuestRoomSheet.tsx`
  (`2516:14575`,三行加减复用订房向导的 `GuestCounterRow`)。
  **筛选浮层复用完整模式 `HotelFilterSheet`**(Lite 稿 `2485:7101` 与 408:1824 逐段同构);
  日期复用 `DatePickerSheet`;结果页取数、收藏、上拉加载与完整版同一套。
  入口:`LITE_SERVICES.hotels.route` 由 `Hotels` 改 `HotelsLite`(完整模式不受影响)。
  新增 `HomeIcon.mic`(字形取自设计稿导出 SVG)与本地键 `mtrip:hotel-recent`(最近搜索,最多 3 条)。
  **未照抄**:设计稿「输入中」的联想列表(没有地点库,不编造联想词);
  Nearby / Search on Map / 语音 / how do I book 走 comingSoon;
  房间与入住人只回显不进请求(日期同理)。
  i18n 三份各补 26 键(共 912)。

- [x] **关怀模式酒店详情七屏**(2026-09-15,Figma section `Hotel Details Lite` `2352:5591`):
  新增 6 个路由 —— `HotelDetailLite`(主详情,`2492:10399` 单选 + `2707:13098` 多选**一页两态**:
  房卡 Choose ⇄ 加减器,多选时底部出 Total Price + 购物车 + Continue 合计栏)、
  `RoomDetailLite`(`2352:6030`)、`HotelInfoLite`(`2352:8182`)、`HotelPolicyLite`(`2352:8890`)、
  `HotelReviewsLite`(`2352:6648`)、`PropertyPreviewLite`(`2352:7051`);
  新增 `components/hotel/lite/LiteRoomCard.tsx` 与四个内容页共用的 `liteShared.ts`。
  **内容与完整模式同源**:设施 / 周边 / 评价 / 政策复用 `screens/hotel/detailDemo.ts` 与
  `hotels.detail.*` 文案(完整版页签用的就是这份),不另造 Lite 数据;
  **退改规则接真实 `refundRules`**(rule_type 1 免费 / 2 阶梯 / 3 不可退,无规则=免费取消,
  与 order-service `computeRefund` 兜底一致)。
  入口:Lite 结果页卡片由 `HotelDetail` 改跳 `HotelDetailLite`(完整模式不受影响)。
  新增图标 `eyeCircle` / `cart` / `documentList`(字形取自设计稿导出 SVG;
  `imageCopy` 项目里本来就有 —— 第一版加重了,typecheck 报 TS1117 才发现,已去重复用原有那枚)。
  **未做**:多选只算合计、**不多间下单**(后端一单一个 sku,Continue 带第一个选中房型进订房向导);
  房型详情不画「Tax & Service Fees (15%)」(结账实付里没有这笔)与 Loyalty 模块;
  设施不分 ESSENTIALS/RECREATION/DINING 三组(`facilities` 无分类字段);
  评分 / 评论 / 周边景点仍是设计稿数值(无评价接口);360°、地图、区域页签 comingSoon。

- [x] **关怀模式订房流程**(2026-09-15,Figma section `Booking Flow` `759:9777`):关怀模式的下单链路补齐,
      从搜索 → 详情 → 订房 → 成功页全程同一套字号(此前 Lite 详情的 Choose 会掉回完整版向导)。
      **设计侧没有出订房流程的 Lite 稿** —— 用户指定的这个 section 与完整模式已实现的
      `Multi Booking Hotel Booking Flow` `1675:5776` 逐屏同构(逐帧比对 `224:4808` ≡ `1675:6292`),
      故按仓库已确立的关怀模式换算规则从该稿**推导**:版式不变、每个元素放大一档,
      换算表写在 `components/hotel/booking/lite/liteBookingShared.ts` 头部。
      **业务逻辑抽成共享 Hook**:新增 `screens/hotel/useBookingWizard.ts`,承载原
      `HotelBookingScreen` 的全部状态 / 副作用 / 下单支付(真实与演示两种模式、只开通钱包余额渠道、
      加购与多住宿不提交、优惠券服务端试算);完整版页面只改取值来源,**JSX 与像素零变化**
      (与「我的精选」`useMyPickData` 同一做法)。
      新增 2 个路由 —— `HotelBookingLite`(4 步同一路由内切换)、`BookingSuccessLite`;
      新增 `components/hotel/booking/lite/` 下 `liteBookingShared.ts` + 四个步骤组件。
      入口:`HotelDetailLite` / `RoomDetailLite` 由 `HotelBooking` 改跳 `HotelBookingLite`(完整模式不受影响)。
      **复用不重写**:日历给 `BookingCalendar` 加了个 `lite` 尺寸开关(排布与选区数学两种模式同一份,不复制);
      选券弹窗 `CouponPickerSheet`、支付结果 `AlertDialog`、常旅客 `Travelers`、新增旅客 `AddGuest`、
      保险 `Insurance` 全部复用完整模式那几个;**文案复用 `hotels.booking.*`,i18n 零新增键**(仍 971)。
      **未做 / 刻意砍掉**:多住宿(`trip` 步 + Add More Stay)—— 后端一次 `create` 只收一个 sku,
      完整模式真实下单下本就 `comingSoon`,关怀版不给死路(Hook 传 `enableMultiStay:false`);
      支付页银行卡 / 手机银行两行不做展开(展开后是写死的示例卡,渠道还没开通);
      支付汇总卡不放 View Details(跳的是完整版版式的 `StayDetail`,字号会突然变小);
      成功页去掉「探索当地玩乐」引流卡(comingSoon 死链)。
      加购、税费、渠道置灰的口径与完整模式逐条一致,不另立规矩。
      **顺带修掉 3 处既有类型错**(都在上一批未提交的 Lite 文件里):`HotelDetailLite` /
      `RoomDetailLite` 传给向导的 `goodsId/skuId` 应为 `propertyId/roomTypeId`;
      `HotelResultsLite` 的收藏映射 `f.goods_id` 应为 `f.property_id`(`FavoriteItem` 早已改名)。

- [x] **酒店页用户指引(Coach Mark 七步)**(2026-09-16,Figma section `Hotel Search Coach mark UI` `2150:4865`):
      新增 `components/hotel/guide/HotelGuideOverlay.tsx`(遮罩 / 箭头 / 文案 / 底部控件)与
      `guideSteps.tsx`(七步插图)。七步讲完整条订房链路:目的地 → 日期 → 住客 → 选酒店 →
      选房 → 填资料 → 付款。
      **三处入口**(用户指定「筛选旁边的问号」):完整版搜索页 `HotelsScreen` 与结果页
      `HotelResultsScreen` 顶栏筛选旁各加一枚 `questionCircle` 圆按钮;关怀版 `HotelsLiteScreen`
      顶栏那枚「how do I book ?」药片由 `comingSoon` 死链接到同一浮层并传 `lite`(字号放大一档)。
      **不自动弹**,只有点问号才出;左上角 Skip Tutorial 为快速关闭。
      设计稿实测(取自 Coach Mark 2 `2154:7076` 的 design context):遮罩纯黑 .95、文案块宽 320、
      标题 Inter Bold 24 白 / 说明 Inter 400 16 `#D9E1FB`、底栏 Previous + 7 点 + Next
      (1px `#D9E1FB` 描边圆角 32);曲线箭头是设计稿导出 SVG 的单路径,**逐字符照搬未重绘**,
      旋转 -53.55°。
      **示例卡复用现成组件与设计稿同源演示数据**:步 4 `HotelResultCard` + `DEMO_RESULTS[0]`
      (就是稿上那家 Heritage Bagan)、步 5 `HotelRoomCard` + `DETAIL_ROOMS[0]`(Standard Room /
      4 Left / 1 Queen / 32 sqft / MMK 195,000 与稿逐字段吻合)、步 6 `FormInput`、
      步 7 `PaymentMethodRow` + `TEMP_PAY_ICONS`;关怀模式下步 4/5 换 `LiteHotelCard` / `LiteRoomCard`。
      i18n 三份各补 18 键(`hotels.guide.*`);连同下面那条修复共 990。
      **冒烟时抓到一个既有 bug 并修了**:`hotels.detail.rooms.breakfast` 三份里根本不存在,
      而 `lite/LiteRoomCard.tsx:109` 一直在 `t()` 它 —— 关怀模式房型卡上凡 `breakfast===1`
      的房型都会把原始键名画出来(与本次引导无关,是第 5 步复用该卡后暴露的)。
      已补:en `Breakfast` / zh `含早餐` / my `မနက်စာ`。
      **已知偏差**:4~7 步高亮的元素属于结果页 / 详情页 / 订房页 / 支付页,那几页当下并未挂载,
      做不成真实挖洞高亮 —— 设计稿本身也是「遮罩 + 元素副本画在遮罩上」,故七步统一成
      「遮罩之上画该步示例卡」;遮罩 95% 黑,底层几乎不可见,差别只在透出的那层页面不同。
      示例卡是演示数据,**不反映用户当前搜索结果**。步 6 只画三栏(稿上四栏 + 提示 + Save Info
      整卡近 450 高,叠上文案后小屏放不下,砍掉与姓名说明重复的手机号栏)。
      **缅文文案是照着现有 `my-MM.json` 同类措辞拼的,不是母语者产出,需人工过一遍。**
      **验证**:typecheck 零报错;i18n 三份 990 键零差异;**Web 冒烟已做**
      (`expo start --web` + headless Chrome 402×874,两种模式各 35 条断言全绿,
      逐屏看过截图,完整版顶栏三枚按钮实测 x=20/298/346,问号确在筛选旁)。
      冒烟时后端没起,金额显示为 EUR(`siteStore.currency` 初值,全局如此),接上网关即为 MMK。
- 2026-09-17:订房向导缺省入离日期与搜索页口径统一。`components/hotel/booking/bookingFormat.ts`
  的 `normalizeDates()` 兜底由「明天起 1 晚」(`dayAfter(1)/dayAfter(2)`)改为「**今天起 2 晚**」
  (`dayAfter(0)/dayAfter(2)`),与 `DatePickerSheet.defaultDateRange(2)` 及完整版/关怀版搜索页默认
  一致;`useBookingWizard.ts` 与 `navigation/types.ts` 的「缺省时向导用明天起 1 晚」注释同步。
  **动因**:「我的精选 → 酒店详情 → 订房向导」这条链路只传 `propertyId`
  (`MyPickScreen.tsx:191` / `MyPickLiteScreen.tsx:174`),向导因此静默把住宿订成明天/后天,
  而商户在客房管理里看的是"今天"的库存(按日期存),于是"下了单但今日可售没变"被当成 bug 报回来;
  详情见 `docs/plans/20-客房管理Figma与PRD整改计划.md` 第 12 节与本文件对应的 HANDOFF 顶部条目。
  **未动**门票下单页 `screens/order/OrderConfirmScreen.tsx` 的同款默认值(门票业务另论)。
  **验证**:`npm run typecheck` 零报错;`normalizeDates` 用 Node 直跑 TS 源文件跑 6 组断言
  (缺省 / 空串 / 离店不晚于入住 / 过去日期 / 正常区间原样透传)全绿。未做真机走查。
