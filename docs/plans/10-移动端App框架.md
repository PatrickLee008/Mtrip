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

- [x] **全局「强制短信验证」开关**(2026-09-17 下午,`sys_config` 的 `security` / `register_sms_required`):
      把下面那条**站点级**方案**搬到了全局配置**,`sys_site.sms_verify_required` 列已删除
      (迁移 `V20260917040000`,账本 19→20)。
      **搬家原因**:注册请求的站点来自**客户端可控的 `X-Site-Id`**(`requireSiteId()` 只校验 `>0`),
      站点级开关挡不住「挑一个最宽松的站点」;且这本质是平台级安全策略,不是站点差异化配置。
      **实现**:`siteForcesSms(int)` → `registerSmsRequired(): bool`(读 `sys_config`,不再吃 siteId);
      `registerRequiresSms($siteId)` = `registerSmsRequired() || enabled($siteId)`,siteId 只用于判渠道归属。
      站点页与 4 个 `config.site.sms*` i18n 键**全部撤销**;client-app 逻辑零改动(50021/50022 契约未变)。
      **开关位置**:后台「系统配置 → 全局参数」(`/config/global`)→ **安全配置** 分组。
      `value_type=3` 由该页既有逻辑自动渲染成 `a-switch`,**没为它写专门控件**。
      **切换要确认、要留痕**:开/关**双向** `Modal.confirm`(关闭走 danger,文案讲清后果);
      留痕复用既有 `OperationLogMiddleware` —— 该页只提交变更项,故日志 `content` 里只有这一个键,
      附管理员 / IP / 时间。**局限:只有新值没有旧值**。
      **验证**:真值表 13 项全过,其中关键一格是「开关=1 时 `X-Site-Id` 取 1/2/7/999/12345(含不存在的站点号)
      调 `register` 全部被 `40111` 拦下」,证明「挑弱站点」已堵死;shared 单测 99/975 全绿;
      后台走查开/关确认、取消不保存、落库、还原全过;两端构建零报错。
      唯一未实测:「开关=1 + 渠道启用 → `sms/send` 正常」——会真发短信(花钱且打扰用户),
      该格本次未触碰且当天早些时候已验证。

- [x] ~~**站点级「强制短信验证」开关**(2026-09-17 上午,`sys_site.sms_verify_required`)~~ · **已被上一条取代**
      (该列已删除,后台站点管理也没有那个开关了;动机与 50021/50022 设计仍有效):
      把「注册是否要求短信验证」与「渠道是否可用」**解耦**。
      **动机**:原实现是 `AuthController::register` 读 `SmsVerifyService::enabled()`,即「渠道启用即强制」——
      渠道一旦停用 / 软删 / 凭证失效,`enabled()` 变 false,注册就**静默降级成免验证码注册**,且无任何告警。
      9/17 实测复现:渠道 `status` 置 2 后,不带 `verifyToken` 的 `register` 直接 `code=0` 建号(`user_info` 6→7)。
      **实现**:迁移 `V20260917032003`(账本 18→19)给 `sys_site` 加 `sms_verify_required TINYINT NOT NULL DEFAULT 1`;
      `SmsVerifyService` 新增 `siteForcesSms()` 与 `registerRequiresSms()`(= 站点强制 OR 渠道可用),
      `register` 改读后者;`requireChannel()` 在无渠道时按站点开关抛不同码。
      **`enabled()` 语义未动**(仍是「渠道能否解析」),既有语义与单测不受影响。
      **新增错误码 `50022 SMS_REQUIRED_UNAVAILABLE`**,与既有 50021 的区别是**调用方能不能降级**:
      50021 = 不强制且无渠道 → App 照旧跳过验证码页;50022 = 站点强制但渠道不可用 → App **不能跳过**
      (跳过去也会在推荐码页被 40111 打回),停在注册页由 request 层 Toast 后端文案。
      App 侧只改两处:`API_CODE` 加 50022、`RegisterScreen` 的 catch 仍只对 50021 降级(**i18n 零新增**)。
      后台:站点管理列表加一列标签、编辑弹窗加一个开关(`config.site.smsVerifyRequired` 等 4 键 × 2 份 i18n);
      布尔↔0/1 用带 setter 的 `computed` 转换 —— 写在模板里的箭头函数参数会是隐式 any,本仓库模板禁类型标注,
      `vue-tsc` 会报 TS7006。
      **⚠️ 存量 7 个站点与新建站点一律默认 `1`(强制)**,这是用户的明确决定。
      代价:**SMSPoh 一旦挂掉或凭证失效,所有站点的注册会立即全部不可用**(而不是降级放行)。
      要放开的站点在后台站点管理逐个把开关翻成 0。
      **验证**:真值表三格逐格实测(见 HANDOFF);shared 单测 97/968 → **99/975** 全绿(新增 2 用例 7 断言);
      5 个改动 PHP 文件容器内 `php -l` 通过;`admin-web build` 与 `client-app typecheck` 零报错;
      测试后渠道状态、站点开关、测试账号全部还原(站点 7×1 / 渠道 status=1 / 用户 6)。
      **未做**:真实收发短信的端到端仍待用户用真号自测(与上一条同)。

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

- [x] **关怀模式酒店详情页改版**(2026-09-18,Figma section `Hotel Details Lite` **新稿** `2540:16881`
      / 首帧 `2540:16882`):设计出了新版,`HotelDetailLiteScreen` 首屏整个换掉 ——
      旧稿的「文字顶栏(返回 + Hotel Details + Hotel Policy)+ 标题卡 + 左 90×90 缩略图小房卡」
      改成「整宽图库 Hero(返回与星级压在图上)→ 标题卡(名 / 评分 / 地址)→ Choose a Room 房卡列表
      → Read Policies 描边按钮」。**此帧的 Mobile Bottom Bar 在稿里是 `hidden`,故本页没有底部价格栏。**
      **多选态整个删掉**(用户确认):`mode` 状态、「+ Choose Multiple」链接、房卡加减器、
      底部 Total Price + 购物车 + Continue 合计栏全部移除 —— 后端一单只收一个 sku,
      原先的 Continue 也只是带**第一个**选中房型进向导,是假功能(见上一条 2026-09-15 的「未做」)。
      `LiteRoomCard` 按新稿 `2540:17042` 重写成**整宽 192 封面在上**的大卡,结构与完整模式
      `HotelRoomCard`(222:1598)同型(封面定高 + overflow hidden、角标绝对定位、正文自带不透明底色、
      渐变 id 跟卡片走),字号取 Lite 档(房型名 24、参数 14、Select 20、心 32);
      封面图源改走 `resolveMediaUri` 过滤脏值,圆点按**实际张数**渲染(只有一张就不画),
      导出资产 Line 3 实测描边 `#D9E1FB`,与完整版房卡一致。
      **复用不新写**:Hero 直接用现成的 `components/hotel/HotelGallery`(渐变 / 圆点条 / 张数胶囊
      与新稿逐项吻合),只给它加了一个可选 `counterTextSize`(完整版 12 / 关怀版 16),调用点零改动;
      状态栏黑条 + 悬浮顶栏 + 客服悬浮球照搬完整版 `HotelDetailScreen`;
      图标全部命中 `HomeIcon` 已有字形(`arrowLeft` / `star` / `locationOutline` / `heart` /
      `imageCopy` / `people` / `bedSize` / `breakfast` / `chatFilled`),**本次零新增图标与图片资产**;
      房卡兜底图沿用 `TEMP_ROOM_COVERS`(370×192,正好是新稿封面框尺寸)。
      **评分口径**:稿上是十分制(9.3),后端 `goods.rating` 是五分制,按用户确认 **×2 换算**显示,
      EXCELLENT 门槛仍按五分制原值判(≥4.5,复用 `hotels.results.excellent`);
      接口不下发评分时整行只留右边的「See All Detail >」。
      **未做**:房卡的划线原价与「5% off for 7Nights」(`GoodsSku` 只有 `base_price`,
      没有原价/促销字段,组件留了可选 props 等后端下发);房卡收藏心走 comingSoon
      (`addFavorite` 是**物业级**收藏,没有房型级接口,与完整版 `HotelRoomsTab` 同一处理);
      Bestseller 角标接口无此标记,按「排序最前两张」等价处理(稿上前两张卡有、第三张没有)。
      路由与入口一行未动(`HotelResultsLite` → `HotelDetailLite` 不变),
      「See All Detail」→ `HotelInfoLite`、「Read Policies」→ `HotelPolicyLite`、
      「See Details」→ `RoomDetailLite`、「Select」→ `HotelBookingLite`(日期照旧透传)。
      i18n 三份各 +4 键(`seeAllDetail` / `seeDetails` / `select` / `readPolicies`)、
      −8 个失去调用点的键(`detailTitle` / `hotelPolicy` / `viewHotelDetail` / `chooseMultiRoom` /
      `switchMulti` / `switchSingle` / `seeRoom` / `lite.continue`),三份 `hotels.lite` 均 32 键零差异。
      **验证**:`npm run typecheck` 零报错;三份 i18n JSON 解析通过且键集一致;
      已删键全仓零残留引用。`scripts/check.ps1` 因**本机未装 php** 停在第 1 步后端 lint
      (与本次改动无关,未动任何 PHP);**未做真机 / Web 冒烟,需人工对图验收。**

- [x] **关怀模式订房流程改版:4 步 → 2 步**(2026-09-18,Figma section `2540:19101`):
      2026-09-15 那一版是**推导**的(设计侧当时没出 Lite 稿,从完整版 `1675:5776` 按换算规则
      放大一档),做成 `dates → guests → review → payment` 四步。这次设计出了真稿,整条流程重做:

      | 新稿 | 落点 |
      |---|---|
      | `2540:19394` Lite Booking step 1 | `components/hotel/booking/lite/LiteStepConfirm.tsx`(新增) |
      | `2540:19621` Lite Booking step 2 | `components/hotel/booking/lite/LiteStepPay.tsx`(新增) |
      | `2540:19863` Booking Confirmed! / `2540:19741` Booking Confirming | `BookingSuccessLiteScreen` 重写,一屏两态 |
      | `2540:20959` Account Login Required | 复用 `AlertDialog`,新增 `tone: 'plain'` |

      删除 `LiteStepDates` / `LiteStepGuests` / `LiteStepReview` / `LiteStepPayment` 四个旧组件
      (只有 `HotelBookingLiteScreen` 在用,无其它引用)。
      **`liteBookingShared.ts` 的换算表整表作废**,改成新稿实测 —— 实测字号**比推导值小**
      (区块标题 20/32 而非 32/40、卡内标题 16/24 而非 24/32、输入框高 56 文字 16 而非 64/24)。
      壳去掉了顶栏与「Step N of 4」进度条(新稿两屏都没有),标题改成 Main 里的第一行文字;
      吸底栏由「预计总价 + 一枚大按钮」换成**两枚等宽按钮**(Cancel / Continue → 与 ← Back / Pay Now →),
      总价改由 step 2 的价格明细卡承担。
      **数据层仍与完整模式共用 `useBookingWizard`**,只加了三个可选口子:
      `steps`(序列覆盖,Lite 传 `['guests','payment']` —— **刻意复用原 step key**,
      于是「姓名/手机必填」「渠道必选 / 未登录 / 余额不足 / 下单」两段校验原样生效)、
      `confirmLogin`(未登录先弹确认浮层,完整模式默认 false 保持原行为)、
      返回值多了 `refundRules` / `loginPrompt`。
      **顺带修掉一处护栏失效**:`goNext` 里「离店日期为空」的拦截原本限定 `step === 'dates'`,
      Lite 没有这一步就会整个失效、带着空 `endDate` 去下单被后端打回,改成**无条件前置判断**
      (完整模式第一步就是 dates,后续步骤 `checkOut` 必非空,对它无实际影响)。
      `paid` 补 `orderId`、成功页参数补 `orderId` / `status`,供「View Booking」跳 `OrderDetail`。
      **已确认的取舍**:① 新稿把日期/人数画成只读摘要,按用户选定**接上了现成弹层**
      (日期行开 `DatePickerSheet`、「N Room」药丸与住客行开 `GuestRoomSheet`)——
      否则进了订房页发现日期错了只能退两层;② 支付主位卡放 **mTrip 钱包余额**(后端唯一真渠道),
      MMQR / KBZPay / Wave Pay / 酒店前台收进「See Other Payment」展开后置灰 + Coming soon ——
      照稿把 MMQR 摆主位的话默认那张卡根本付不了款;③「View More」是**就地展开**加购卡列表
      (含保险那张,点它仍跳 `Insurance`),不是跳新页,否则加购与保险两条既有链路会断。
      **Add New Guest `2540:19102` / Insurance `2540:19225` 本次未动** —— 逐屏比对过,
      与已实现的 `1675:5777` / `1675:5900` 是同一版式,现有差异全是上次用户确认的后端字段裁剪。
      **未做 / 已知缺口**:成功页的 `confirming` 态**目前产生不了**(后端 `ORDER_STATUS` 没有
      「等酒店确认」这一档,`order/pay` 成功即已支付),两态都实现好放着,等后端支持时
      只需让 `goSuccess` 传 `status: 'confirming'`;新稿没有 Special Requests 输入框,
      `request` 状态保留但页面不再提供入口(真实下单的 `remark` 因此恒为空);
      新稿成功页没有核销二维码,核销码仍在订单详情页(`VerifyCodeView`),「View Booking」跳那里;
      演示模式(未登录 / 无 propertyId)不画券卡 —— 券接口要登录态,不伪造。
      i18n 三份各新增 `hotels.booking.lite.*` 一整块(含 `success` 子块),
      复数沿用仓库既有的嵌套 `one/many` 写法(本项目 `compatibilityJSON: 'v3'`,同 `nightsLabel`);
      旧步骤的词条**全部保留** —— 完整模式的 `BookingStepDates/Guests/Review` 仍在用,逐键 grep 确认过。
      **验证**:`npm run typecheck` 零报错;三份 i18n **1021 键零 missing / 零 extra**;
      四个已删组件全仓零残留引用。`scripts/check.ps1` 因本机未装 php 仍停在第 1 步后端 lint。
      ⚠️ **未做真机 / Web 冒烟**;**完整模式订房流程需要回归**(动了共用的 `useBookingWizard`);
      缅文文案照现有 `my-MM.json` 同类措辞拼,需母语者复核。

- [x] **关怀模式详情族三处补齐**(2026-09-18 晚,同一批):

      **① 订房日期弹窗加遮罩**。`DatePickerSheet` 原本**故意不带遮罩**(代码里写着
      「设计稿没有遮罩(背后大图保持原亮度)」——那是给搜索页定的,背后是整屏 hero 大图)。
      它有 4 个调用方,订房向导那处背后是白卡页面,不压遮罩浮层像浮空的。
      做成**opt-in 的 `backdrop` prop(默认 false)**,只在 `HotelBookingLiteScreen` 打开,
      `HotelsScreen` / `HotelsLiteScreen` / `HotelResultsScreen` 三处一行没动。
      遮罩用 `Animated.View` 绑同一个 `anim` 跟浮层一起淡入淡出、`pointerEvents="none"`
      让点击穿透到原来的关闭层;颜色 `rgba(0,0,0,0.25)`,与同屏的 `GuestRoomSheet` /
      `AlertDialog` 同一口径(`HotelFilterSheet` 的 0.4 是整屏上拉面板,没跟)。

      **② AI Summary 补到关怀版两处**(`2540:7491` 信息页尾 / `2540:18286` 评价页)。
      此前只有完整模式 `HotelReviewsTab` 有这一块,关怀版**评分与维度条都画了、偏偏漏了它**。
      抽成 `components/hotel/lite/LiteAiSummary.tsx`,`HotelInfoLiteScreen`(接在
      Read All Reviews 之后)与 `HotelReviewsLiteScreen`(接在维度条之后)共用。
      文案**共用完整模式那五个键** `hotels.detail.reviews.{aiSummary,topPositive,
      positiveQuote,improvement,improvementQuote}`,**不另造 Lite 词条**,否则两种模式
      会给出不同的总结;版式按既定换算规则放大一档。**这块是写死的设计稿文案**,
      后端没有评价接口更没有 AI 总结接口(完整模式同此状态)。

      **③ 详情族底栏**(`2540:18477`:白底 + 上边框 rgba(196,197,215,.3) + px20 pt17 pb16;
      左 Start at 12/16 + 金额 20/24 主色 + `-15% TODAY` 10/15 #BA1A1A;
      右主色按钮**圆角 24** px32 py16)。抽成 `components/hotel/lite/LiteDetailBottomBar.tsx`。
      **逐帧核过设计稿,不是"统一加"**:信息页 / 政策页 / 评价页**有**(本次加);
      房型详情早有自己的 Book This Room 底栏,不动;**主详情页没有**
      (`2540:16882` 那帧 Mobile Bottom Bar 是 `hidden=true`,且房卡各自带 Select,
      再挂一条 Choose room 是重复入口);**实景预览没有**(`2540:18495` 稿里无此节点)。
      「Choose room」→ `navigate('HotelDetailLite', {id})`,栈里已有该页就弹回去选房。
      评价页原本不取数(评价内容全静态),为底栏那行起价加了**一次轻量 `fetchHotelDetail`**,
      拿不到只是不画金额那行、不挡页面。`-15% TODAY` 取 `DETAIL_DEMO.discountPercent`,
      **后端没有"今日折扣"字段**,与完整模式 `HotelDetailScreen` 同一口径;
      组件做成可选 `discountPercent`,不想显示不传。
      i18n 三份各 +1 键 `hotels.lite.chooseRoomCta`(`hotels.detail.chooseRoom` 是
      "Choose my room",与稿上的 "Choose room" 不同,没硬套)。

- [x] **关怀模式详情页补回多房间选择**(2026-09-18 晚,Figma `2642:10749` / 底栏 `2863:7627`):
      **版式基底仍是新稿 `2540:16882`**(Hero 图库 / 评分行 / 整宽封面房卡 / Read Policies 全留着)——
      用户给的 `2492:10399` 与 `2642:10749` 其实都是**旧版式**(文字顶栏 + 90×90 小图房卡),
      已与用户确认:**只搬多房间能力,不回退版式**。
      交互按用户选定的"两者都要":房卡右下角 **Select 点一下即加入(置 1 间)、就地换成
      −/数量/+ 加减器**(加减器规格取自旧稿 `2707:13670`,按新卡圆角 16 调整);
      减到 0 自动移出选择、按钮变回 Select。
      选中任一房型后页面底部出现合计栏:左「Total Price」12/16 + 金额 Inter 600 **16**/24 主色
      + `-15% TODAY` 10/15 #BA1A1A;右购物车(1px 主色描边圆角 12、p12、cart 32,
      角标 left31/top-8/w24/r99、Inter 700 12/24 白)+ Continue(主色圆角 12 px32 py16)。
      客服悬浮球在有底栏时上移一个栏高,免得压住 Continue。
      `LiteRoomCard` 新增可选 `quantity` / `onChangeQuantity`,**不传就退回纯单选**
      (`guideSteps` 的演示卡不受影响)。i18n 三份补回 `hotels.lite.continue`(上一轮删多选时删掉的)。
      ⚠️ **合计只是展示**(用户确认):后端 `order/create` **一单只收一个 sku**,
      Continue 仍带**第一个**选中的房型进订房向导。代码注释与本条都写明了,
      **别当成"没接完"去补** —— 真正的一单多房型要等后端支持。
      **验证**:**质量基线四步全跑完** —— backend `php -l` 390 文件 0 错误、
      shared 单测 99 用例 975 断言全绿(前两步借微服务镜像里的 PHP 8.1.27 跑,
      本机 PATH 没有 php;命令见 README「质量基线」一节)、admin-web build 通过、
      client-app typecheck 零报错;三份 i18n **1023 键零 missing / 零 extra**。
      ⚠️ 仍未做真机 / Web 冒烟,需人工对图;缅文需母语者复核。

- [x] **关怀模式酒店详情页改回 `2642:10749`**(2026-09-18 夜):

      🔴 **设计文件里有两套并存的 Lite 详情稿,已确定以 `2642:10749` 为准**:

      | 稿 | 版式 | 状态 |
      |---|---|---|
      | `2642:10749`(含底栏)/ `2492:10399`(无底栏) | 文字顶栏 + 标题卡 + **左 90×90 缩略图横排房卡** + Choose | ✅ 当前基准 |
      | `2540:16882` | Hero 图库 + 评分行 + **整宽 192 封面大房卡** + Select + Read Policies | ❌ 已作废 |

      白天那条「关怀模式酒店详情页改版」按 `2540:16882` 做的 Hero 版**已被推翻** ——
      当时已提示这两个节点是旧版式、用户先选了「保留新版」,实际跑起来看过后判定
      「和设计稿差别太大」,要求改回。**别再照 `2540:16882` 改回去。**

      `HotelDetailLiteScreen` 与 `LiteRoomCard` 按 `2642:10881` 重写:
      房卡回到左列(90×90 圆角 8 缩略图 + 20 eye-circle「See Room」Inter 600/12)、
      右列(房型名 Outfit 600/20/24 + Bestseller 药丸主色 10% 底、参数行 **定宽 100** wrap
      Inter 500/14/20)、1px #D9E1FB 分隔线、底行(可选划线原价+促销 Inter 600/12;
      主价 Inter 600/20/24 + `/ night`;右 Choose 主色**圆角 12** px16 py8 Inter 600/20)。
      **`HotelGallery` 完全回退**到改动前 —— 为 Hero 加的 `counterTextSize` 已无调用方,
      相对 HEAD 的 diff 归零;`guideSteps` 跟着去掉 `onToggleFavorite`(新版式没有收藏心)。

      **多房间保留**(上一轮刚补的没丢):Choose 点一下即加入(置 1 间)、就地换成加减器,
      减到 0 变回 Choose;选中后底部出 `2863:7627` 合计栏。
      ⚠️ **合计只是展示**,后端 `order/create` 一单只收一个 sku,Continue 带第一个选中的房型。

      **参数行的 Wifi**:设计稿第二张卡有这一项,但接口 `sku.facilities` 是自由文本数组,
      按 `/wifi/i` 命中才画,不硬编码成固定四项。

      **i18n**:补回 `hotels.lite.{detailTitle,hotelPolicy,viewHotelDetail,seeRoom}`
      (白天改 Hero 版时删掉的),删掉随 Hero 版作废的
      `hotels.lite.{seeAllDetail,seeDetails,select,readPolicies}`;三份仍 **1023 键零差异**。

      **验证**:`npm run typecheck` 零报错;i18n 三份零差异;四个已删键全仓零引用;
      `HotelGallery` diff 归零。⚠️ **未做真机 / Web 冒烟** ——
      这一页版式刚被判定「差太多」,**建议先跑起来对图再继续**。

- [x] **关怀模式房型详情页按 `2352:6030` 重做**(2026-09-18 夜):用户判定与设计稿差距大,
      逐节点比对后改掉五处(**都是实现与稿不符,不是设计变更** —— 该页本来就是按这个节点做的):

      0. **(第二轮返工)大图必须在滚动流里**:第一轮为了让 3D/360 点得到,把大图做成绝对定位
         垫在 ScrollView 底下、覆盖控件浮在最上层 —— 结果**滚动时那两枚按钮不跟着图走、
         一直悬在内容上方**,用户指出「不应该是悬浮组件」。已改成大图是 ScrollView 的
         第一个子元素、覆盖控件绝对定位在**大图内部**(一起滚也点得到),
         只有返回键仍压在图上。既然内容不再压图(见第 2 条),大图本就没有绝对定位的必要。
         同轮按 `get_design_context` 校正字体:房型名 Inter 600/24/**40** ls **-0.32** `#0B1C30`、
         「PRICE PER NIGHT」**大写** ls.6、金额 Inter **700**/20、参数行 **16**/20、
         脚注 Inter 600/**16/16** ls.6(卡壳 r32 p24 / r20 p25 原本就对)。
      1. **大图底部覆盖层补上**(`2352:6033`,原先整层没做):圆点条(黑 20% px12 py8 r999 w60,
         点 8)、张数胶囊(黑 25% r40 px12 py4,imageCopy 20 + Inter 400/16/20 白)、
         「See 3D View」/「See 360 View」两枚胶囊(同底,20 图标 + Inter 400/16/20 白)。
         **必须放在 ScrollView 之后**才点得到 —— 大图是绝对定位垫在最底层的,夹在中间会被滚动区盖住。
         圆点与张数按**实际可用图片数**渲染(经 `resolveMediaUri` 过滤),只有一张就不画;
         3D / 360 没有素材与接口,与实景预览页同一处理走 comingSoon。
      2. **大图高度 260 → 300**,且内容不再压图 —— 稿里 `2352:6031` 高 300、内容区
         `2352:6048` 起点 y=354 正好接在图后面,原实现让首卡上移 120 压住了图。
      3. **Room Amenities 分组**:接口给了 `sku.facilities` 就按真实值平铺一组(**没有分类字段,不猜**),
         没给才回落到稿里的 ESSENTIALS / RECREATION / DINING 三组 —— 直接复用
         `DETAIL_AMENITY_GROUPS`(与 `HotelInfoLiteScreen` 同一份,两页不会给出不同的设施)。
      4. **删掉吸底栏**:稿里 `2352:6164 Mobile Bottom Bar` 是 **`hidden="true"`**,
         CTA 由价格卡内的「Book This Room」承担;滚动区底部留白 120 → 32。
      5. **顶栏去掉标题**:稿里 `2352:9560 Heading 1` 是 `hidden`,只留返回键压在图上。

      i18n:补 `hotels.lite.room.{see3d,see360}`,删掉随吸底栏失去调用点的
      `hotels.lite.room.{startAt,reserveNow}`;三份仍 **1023 键零差异**。

      **仍未做(有据可查,不是漏)**:价格卡的「Tax & Service Fees (15%)」——
      后端 `PricingService` 算的实付里没有这笔税费,**而且稿子自己的数也对不上**
      (Price per Night 212,750 + Tax 27,75,Total 却仍是 212,750),说明那一行在稿里是占位。
      照画会让本页 Total 与结账页实收金额不一致,故仍不做;后端真出税费字段时再补。
      「Loyalty Status Module」同样是稿里 `hidden`(`2352:6146`),不做。

      **验证**:`npm run typecheck` 零报错;本页 15 个静态 i18n 键 + 2 个模板前缀**全部解析通过**
      (typecheck 查不出缺键,单独跑脚本验的);三份 i18n 1023 键零差异。
      ⚠️ 未做真机 / Web 冒烟,需人工对图。

- [x] **关怀模式实景预览页按 `2352:7051` 重做**(2026-09-18 深夜):用户判定与稿面差距大,
      逐节点比对后**严格照帧**重写 `PropertyPreviewLiteScreen`。设计数据首次经 **Figma MCP**
      (`get_figma_data`)取回,落档 `.figma-cache/2352-7051.txt`(整帧渲染图 `2352-7051.png`)。五处改动:

      1. **页签从文字药丸改成缩略图卡**(`2352:7056`):横滑 gap 12,四张卡
         Video/360 · Facilities · Rooms · Dining;图高 **83.5** 圆角 8,标签 Inter 500/14/20
         `#475569`,卡内 gap 8,且**标签居中在缩略图正下方**(稿里标签容器是 column + alignItems center)。
         不再有「选中态」—— 稿里四个页签是 Link,没有 active 样式。
      2. **360 区去掉白卡外壳**(`2352:7077` / `2352:7080`):标题 Inter 700/20/28 →
         **268.5** 高圆角 20 大图,整图叠 `rgba(0,0,0,.1)`,居中 64 毛玻璃圆(内 `view360` 40)
         下方 8px 白字 **"360°"**(Inter 700/18/28 + 阴影)。稿里**没有**原来那条说明文字,
         已删掉(`hotels.lite.preview.video360Hint` 键保留但失去调用点)。
      3. **设施区改成双分组**(`2352:7092`):"Facilities" → 小标 **"Kids areas"** 16/600 `#8B8C91`
         → **223.75** 英雄图 → 小标 **"Pools & Gyms"** → **两列网格**(格底 `#F3F4F6` 圆角 8、
         图高 **171** 圆角 20,列间距 16)。两个分组小标是稿面静态文案 ——
         后端 `GoodsDetail.facilities` 只是扁平 key 列表,**没有分组字段,不猜**。
      4. **顶栏照稿写 "Back"**(`2352:7107` / `2352:7111`):`#FEFEFE` 底 + Effect/DS,
         Inter 600/24 **`#204DDA`** —— ⚠️ **不是** `colors.primary` `#4169ED`,
         同一张稿上两者并存,新令牌 `colors.previewBack` 单独承载。
      5. **页底是纯白 `#FFFFFF`**(`fill_658ab2fa`),三段都没有白卡 —— 与同族另外三屏
         (`liteShared` 的 `#EBF0FF` 页底 + 白卡)**观感不同**,这是照帧的结果不是漏改,
         本页因此不再引用 `liteShared.card`。

      **3 处稿面无法直译,已取最接近值近似并在代码注释里逐条标注**(拿到设计侧明确值后替换):
      ① 缩略图**宽度**稿里没落值(tab 帧是 hug、内层图帧是 fill,自相矛盾)→ 取 **120**
      (高度 83.5 是稿面值);② 顶栏箭头 SVG 的 fill 为空(`fill_97d170e1: []`)→ 与 "Back" 同色 `#204DDA`;
      ③ `backdrop-filter: blur(2px)` 与 "360°" 的两层 text-shadow RN 都不支持 →
      blur 用 40% 白底 + 1px 60% 白描边近似,阴影取主导层 `0/4 blur3`(与 theme 里「多层取主导层」同口径)。

      **自查里抓到的两个渲染缺陷,一并修掉**(都不是设计变更):
      ① **阴影层与裁剪层拆开** —— iOS 上 `overflow:'hidden'` 会把同一视图的 `shadow` 一起裁掉,
      原先 `panoBox`/`facilityHeroBox` 把两者写在同一个样式块里,等于没有阴影;
      已拆成 `panoShadow`+`panoBox` / `facilityHeroShadow`+`facilityHeroBox`
      (同族 `LiteHotelCard.card` 是同样的写法,本页不跟,未去动那个文件);
      ② 设施格子的**可见圆角取图自己的 20** —— 格底 `#F3F4F6` 圆角 8 只是图未铺满时的占位底,
      原先给它加了 `overflow:'hidden'`,会把图裁成 8,与稿面 `2352:7104` 的 20 不符,已去掉裁剪。

      i18n:新增 `preview.{overview,back}`、`preview.tabs.{video360,facilities}`、
      `preview.facilityGroups.{kids,pools}`,并把 `preview.video360` 的值由 "360° & Video"
      改成稿面 **"Video/360"**(该键只有本页在用);`preview.title` **未动**(`HotelInfoLiteScreen` 还在用)。
      三份**同结构**:`hotels.lite.preview` 各 14 键,整份文件相对 en-US **零缺失**。
      ⚠️ **缅文 7 条是保守译法,需母语者复核**:`overview` / `back` / `video360` /
      `tabs.video360` / `tabs.facilities` / `facilityGroups.kids` / `facilityGroups.pools`。

      **新增设计契约校验脚本** `scripts/check-property-preview-lite.cjs`(81 项断言):
      三语 `hotels.lite.preview` 结构一致 + 10 个词条三语非空 + en-US 稿面文案逐字一致 +
      theme 4 个新令牌与 4 个色值 + 22 个结构标记(含 4 个稿面尺寸)+ 4 条 RN 渲染语义断言
      (标签居中 / 格底不裁剪 / 带阴影的块不得同时裁剪 / 360° 间距)。
      **红→绿**:落实现前 `RED 26/72`(词条与结构全缺)→ 实现后 `RED 77/81`(自查新增的 4 条命中)
      → 修完 `GREEN 81/81`。过程中还修了脚本自身一个 bug(样式块解析用正则配对,
      把单行块 `tab: { gap: 8 }` 与多行块错配,已改成花括号配对扫描)。
      ⚠️ 该脚本**未接进 `scripts/check.ps1`**(改仓库门禁不属本次范围),需手动执行。

      **验证**:`npm run typecheck` 零报错;`scripts/check-property-preview-lite.cjs` **81/81 GREEN**。
      ⚠️ **`scripts/check.ps1` 本机跑不了**:第 1 步 `php -l` 因**本机未装 php** 立即中断
      (390 个文件全报 `CommandNotFoundException: php`),与本改动无关,本次未动任何 PHP。
      ⚠️ **未做真机 / Web 冒烟**,需人工对图。

- [x] **关怀模式房型详情页第三次逐节点复核**(2026-09-18 深夜,Figma `2352:6030`):用户再次指定同一节点,
      逐节点比对后**发现 11 处数值/结构不符** —— 该页 09-18 夜已改过两轮,这是第三轮,
      **其中两处是本文件早写明的规格却没落到实现上**(设施卡 gap 24、早餐/价格卡 padding 24)。
      设计数据经 Figma MCP 取回,落档 `.figma-cache/2352-6030.txt`(整帧渲染图 `2352-6030.png`)。

      | # | 稿面 | 现值 → 改为 |
      |---|---|---|
      | ① | 顶栏填充 `2352:9557` = 主色渐变遮罩(0deg 透明 → `rgba(65,105,237,.5)`),带高 80 | 完全没有 → 补上 |
      | ② | 返回胶囊底 `rgba(0,0,0,.25)`(+blur4+opacity.8) | `.4` → `.25`(blur/整体透明度 RN 不还原) |
      | ③ | 返回箭头 32 | 20 → 32 |
      | ④ | 大图 ↔ 内容 gap 10(`2352:6031`) | 无 → 补 |
      | ⑤ | 覆盖层首行 `alignItems: flex-end` | center → flex-end |
      | ⑥ | 设施卡 gap 24(`2352:6071`) | 与信息卡共用 16 → 本页覆盖 24(信息卡仍需 16,不动共用样式) |
      | ⑦ | 分组小标行高 16(`style_db23f563`) | 20 → 16 |
      | ⑧ | 属性行图标宽 20(`layout_24ff1e97`) | 16 → 20 |
      | ⑨ | 早餐卡 padding 24(`2352:6111`) | 25 → 24 |
      | ⑩ | 价格卡 padding 24 + 合计行 `padding 12px 0 0` | 25 / 13 → 24 / 12 |
      | ⑪ | 价格卡阴影 `0/4 blur6 -4 + 0/10 blur15 -3`;CTA 阴影 `0/2 blur4 -2 + 0/4 blur6 -1` | 误用 `shadows.subtle` / 无 → `shadows.raised` / `shadows.media`(令牌注释与稿面**逐字一致**,不是近似) |

      **税费展示位(用户选定)**:稿面 `2352:6131` 的「Tax & Service Fees (15%)」本轮**画出**,
      值取占位常量 `TAX_AMOUNT = 0`,并在代码里注明「**后端无税费字段**、待后端出字段后替换」——
      后端 `PricingService` 的实付里没有这笔税费,且**稿面自身的数就对不上**(212,750 + 27,75,Total 仍 212,750),
      照抄会让本页 Total 与结账页实收不一致。新词条 `hotels.lite.room.taxAndFees` 三语齐备
      (`hotels.lite.room` 三份各 **13 键同结构**)。

      **顺带抽取**:顶栏遮罩与 `LiteHotelCard` 封面上下两条渐变是**同一规格**(主色 50% ↔ 透明),
      已抽成 `components/common/EdgeGradient.tsx` 两处共用(实现逐字搬运;原文件 `colors`/`shadows`
      仍被其他样式使用,无遗留 import)。**没有动 `LiteHotelCard` 的任何视觉值。**

      **未照抄且已说明理由的两处**:覆盖层两行稿里写死宽 370(可用宽 = 402 − 2×12 = 378,左右并不等距),
      判为稿面手工尺寸,按容器撑满;圆点数量不照稿的固定 3 枚(稿面 3 枚与旁边胶囊 "2/12" 自相矛盾),
      按实际图片数渲染 —— **用户选定保持现状**。另有 1 处 2px 级差异已知未跟:稿面第三枚(面积)图标是
      17.76×17.76 且带 1px 下内边距(三枚里只有它这样),判为导出缩放产物,三枚统一 20。

      **新增校验脚本** `scripts/check-room-detail-lite.cjs`(35 项:11 处稿面值逐条 + 税费占位 +
      EdgeGradient 抽取 + 三语结构):**红→绿 8/34 → 34/35 → 35/35**。中间那次 34/35 是**断言过度约束**
      —— 把遮罩高度写死成字面量 `80`,而实现用的是具名常量 `SCRIM_HEIGHT = 80`;已改成校验
      「高度解析为 80」这一事实(常量存在且值必须为 80,否则照样红)。⚠️ 脚本同样**未接进 `scripts/check.ps1`**。

      **验证**:`npm run typecheck` 零报错;`check-room-detail-lite.cjs` **35/35 GREEN**;
      `check-property-preview-lite.cjs` 仍 **81/81**(确认抽取没连带破坏)。
      ⚠️ `scripts/check.ps1` 本机仍不可跑(未装 php,第 1 步即断);⚠️ **仍未做真机 / Web 冒烟**,需人工对图;
      ⚠️ 缅文新增 1 条待母语复核(连同实景预览页 7 条,共 **8 条**待复核)。

- [x] **完整模式酒店详情「住客评价」整页**(2026-09-21 晚,Figma `Hotel Details Reviews Page` `1133:2998`):
      需求是「按 Figma 做正常模式(非关怀)下 hotel detail 的 reviews 页面」。该节点正是 2026-08-25
      那条里点名「不属于页签、本次未实现」的二级页,而 `HotelReviewsTab` 的「Read All Reviews」
      当时走 `comingSoon` —— 本次两件事一起收口。设计数据经 Figma MCP `get_figma_data` 取回
      (整帧渲染图 `.figma-cache/hotel-reviews-page-full.png`)。

      **稿面实测**:根 frame padding-top 124(= 状态栏 54 + 顶栏 70)、底色 `#EBF0FF`;
      顶栏 `1133:3247` 悬浮(y=54)padding 16/20、gap 16、底 `#FEFEFE` + Effect/DS、
      标题「Reviews (1,240)」Outfit 600/24/32 主色;Main padding 24px 16px 124px、gap 24;
      总览卡与评论卡同为 padding 24 / gap 32|12 / **圆角 24** / `#FEFEFE` / 1px `#D9E1FB` / Effect/DS;
      评论卡:48 圆头像、药丸底 `rgba(66,104,244,.1)` + 1px `rgba(32,77,218,.2)` + 圆角 32、
      图墙单图 192×128 圆角 32、商家回复块 `#ECF5FE` + 4px 左蓝边 + 圆角 32 + padding 16。

      **总览区抽成共享组件** `components/hotel/HotelReviewDashboard.tsx`:页签 `222:3117` 与本页
      `1133:3257` 是同一组设计,只留一份实现;`HotelReviewsTab` 退化成薄容器(只把 CTA 接到整页,
      `HotelDetailScreen.renderTab` 的「一个壳 + 六个页签内容组件」结构不变,未删文件)。
      **顺带修正圆角**:两个 Figma 节点都写 `borderRadius=24`,而 `detailShared.panel` 是 32 ——
      Reviews 相关卡改用 `CARD_RADIUS = 24`,**其余五个页签的壳仍是 32(`detailShared.panel` 没动)**。

      **⚠️ 取数口径是本轮逐项拍板的,不是沿用本项目「酒店详情先把设计稿数值固化」的旧惯例** ——
      评价内容接真实接口 `/api/v1/app/hotels/reviews`(`HotelController::reviews`,**接口早已存在**,
      `HotelReviewsTab` 里「后端没有评价接口」的注释从本次起作废)。四件事没有数据源,按拍板拆开:

      | 稿面元素 | 处理 | 原因 |
      |---|---|---|
      | 总分行 /「Based on N reviews」/ 顶栏 `Reviews (N)` | **真实** | `reviewSummary.rating ×2` + 列表 `total`,顶栏与卡内同源,不会自相矛盾 |
      | 维度条 4 条、AI Summary 两段引述 | **设计稿静态文案** | `goods_review` 只有单一 `rating`(1-5),无分维度列、无 AI 总结源 |
      | 评论标题、同行类型(Solo/Couple/Family) | **整行不渲染** | 表里没有这两列,不编造 |
      | Helpful / Report 底行 | **不做** | 本页稿面三张卡都没有(只有关怀模式 `2352:6648` 那张有) |

      **评分口径**:后端 `rating` 是 **1-5**、稿面是 **/10**,按 `×2` 换算(与搜索结果页 9.3 同口径),
      卡片写 `toFixed(1)`。⚠️ **`EXCELLENT` 档位阈值是按 10 分制 8.0 推定的**(稿面只给了
      「8.8 → EXCELLENT」一个样本,没有分档表),**与 `HotelResultCard` 的 `EXCELLENT_FROM = 4.5`
      (5 分制,等价 9.0/10)**不是同一把尺子** —— 设计给出分档表后需统一。低于阈值不画胶囊。

      **⚠️ 后端兜底值污染 i18n**:`HotelController::reviews` 在 `nickname` 为空时填**中文字面量
      「匿名用户」**,英文/缅文界面会冒中文;客户端把它当「没有昵称」换成
      `hotels.reviewsPage.anonymous`。**根治要在后端**,这里只是客户端 shim。

      **底栏「Choose my room」按用户拍板不是进订房向导,而是回详情页并切到 Rooms 页签**:
      `HotelDetail` 路由新增可选 `tab`,详情页用 `useEffect` 跟着 `route.params.tab` 走 ——
      本页在栈里是**已挂载**的,`navigate` 只改 params 不重挂,只在 `useState` 初值里读一次
      会让这次回跳看起来没生效。底栏金额取真实 `minPrice`,拿不到就只留 CTA、**不编造金额**。

      **空态**:无 `propertyId`(演示酒店)不发请求直接空态;总数为 0 时 `EmptyView`「暂无评价」,
      顶栏显示 `Reviews (0)`;请求失败 `ErrorView` 可重试。列表自持分页(PAGE_SIZE 10,触底加载 +
      下拉刷新),分页请求失败保留已有内容不清空。

      **新增**:`screens/hotel/HotelReviewsScreen.tsx`、`components/hotel/HotelReviewCard.tsx`;
      `api/goods.ts` 增 `HotelReview` + `fetchHotelReviews`;`types/models.ts` 给 `GoodsDetail`
      补可选 `reviewSummary{rating,count}`;**`HomeIcon.tsx` 新增 `verifiedBadge`**
      (`fluent:checkmark-starburst-16-filled`,商家回复抬头;星星中间的对号靠组件固定的
      `fillRule="evenodd"` 挖空,改成 nonzero 就没有对号了)。i18n 新增 `hotels.reviewsPage`
      三语各 5 键(`title`/`empty`/`anonymous`/`outOfTen`/`replyFrom`),插值用 `{{reviews}}`
      避开 i18next 保留字 `count`;总览区文案复用既有 `hotels.detail.reviews.*` 与
      `hotels.results.excellent`,不重复造词条。⚠️ **缅文 5 条待母语者复核**。

      **新增校验脚本** `scripts/check-hotel-reviews-page.cjs`(稿面几何/字号/色值 + 三语键结构 +
      「不做 Helpful/Report」+ 圆角只影响 Reviews 卡等),⚠️ **未接进 `scripts/check.ps1`**。

      **验证(真跑过)**:`npm run typecheck` **零报错(exit 0)**;`scripts/check-hotel-reviews-page.cjs`
      **红→绿 157/161 → 161/161(exit 0)**。⚠️ 那次红是**断言过度约束**而非实现错:4 条否定断言直接扫原文,
      命中的是"解释性注释里提到的那个词"(卡片注释写了「Helpful (12) / Report」、总览注释写了
      「`detailShared.panel` 的 32」、卡壳注释写了「overflow 会连阴影一起吃掉」)—— 已加 `stripComments()`
      先剥注释再判。⚠️ `scripts/check.ps1` 第 1 步因本机 `php` 不在 PATH 即断(本次未改任何 PHP 文件)。
      ⚠️ 本会话执行器一度整体不可用(`0xC0000142`),绿灯是恢复后取的。⚠️ **未做真机 / Web 冒烟**,需人工对图。

      🐞 **交付后用户报缺陷并已修(Web/H5)**:症状是「顶栏返回点不动 / 顶栏层级错 / 上拉时内容挡住顶栏」。
      根因是 JSX 声明顺序:`headerBar` 与 `bottomBar` 都是 `position: 'absolute'`,而顶栏被声明在
      **FlatList 之前** —— RN / react-native-web 的同级兄弟按**声明顺序**绘制,后声明者在上,于是列表盖住顶栏,
      既挡内容又吃掉返回按钮的点击。**同仓库的 `HotelDetailScreen` 就是正确参照**:它的悬浮 topBar 声明在
      ScrollView 之后,只差这一处。修法:① 顶栏/底栏移到 FlatList **之后**;② 两个悬浮层显式 `zIndex: 2`
      (Android 的 z-order 靠 elevation,由 `shadows.subtle` 提供);③ FlatList 补 `style={styles.flex}`
      (`flex: 1`)—— 原先连 style 都没有,滚动视口会被撑成内容高。**稿面几何/字号/色值未动**,顶栏仍是
      稿面的绝对定位悬浮(用户选定,没改成固定分栏)。

      另新增全仓审计 `scripts/audit-overlay-order.cjs`(整宽悬浮栏是否声明在滚动容器之前):
      12 个候选文件里**报 0 处**,本页是唯一一处、已修;其余 11 个顺序本就正确,按「拿不准的不改」只加守卫。
      该审计**做过灵敏度自检**(故意放违规样本 → `FOUND 1 处 (bar@192 < scroller@213)` + exit 1,样本即删),
      否则只会报 OK 的审计等于没有。修复验证:契约脚本新增 5 条层级断言,**RED 161/166 → GREEN 166/166**;
      typecheck exit 0;`expo export -p web` exit 0;审计 exit 0。


- [x] **购物车 Check Out 接进支付流程 + 整车金额口径**(2026-09-21):上一条已把 Trip 链路
      (`order/trip/create` + `order/trip/pay`)接通,但**入口没打通** —— `RoomCart` 页的 Check Out
      仍只弹「暂不支持多房型」,详情页多选 Continue 也照旧提示一次。本次两处都改为进订房向导:
      带过去的 `propertyId` / `roomTypeId` **只用于让向导进真实模式**拉商品详情(酒店名 / 退改规则),
      真正下单的房型与间数由向导读**同一份购物车**决定;`hotels.detail.rooms.singleOnly` 三份 i18n 已删。

      **同时修掉跟着暴露的三处口径问题**:
      ① **向导金额与间数改整车口径**(`useBookingWizard` 新增 `cartMode / roomsTotal / roomCount`,
         房费 = Σ 单价 × 间数 × 晚数,券试算基数 `couponBase` 同步)。此前复核页、支付页汇总卡、
         吸底栏与**余额校验**都只算路由带进来的那一间 —— 余额不足的账号会被放过去,到 `trip/pay`
         才被后端打回,用户看到的数字也比实扣少。`ReviewBody` 新增可选 `roomTotal`(不传按单间算,
         Stay 明细页 / 关怀模式 / 演示模式行为不变)。
      ② **成功页「本单订了几间」修复**:下单成功会清空购物车,而 `BookingSuccessScreen` 读的是
         `items`,那块**永远渲染不出来**。`roomCartStore` 改为 `checkout()` —— 先把车转存进 `booked`
         快照再清空,成功页读快照;单房型旧链路也走一次 `checkout()`,免得串到上一单的快照。
      ③ **后端 `TripController::create` 的券适用范围**按 Trip 实际覆盖的物业/房型校验:原来一律传
         `propertyId=0 / roomTypeId=0`,「指定物业 / 指定房型」的券会被判不适用而**整单失败** ——
         而 App 侧恰恰是按 `/coupon/match-list`(带 propertyId/roomTypeId)算出可用并**自动应用**的。
         现在整车同一家酒店(购物车必然如此)就把该物业/房型传下去,跨物业 / 跨房型才传 0。
         **只放宽不收紧**,`order/create` 单订单链路一行未动。

      **关怀模式两道护栏**:`useBookingWizard` 新增 `useCart`(Lite 传 `false`),另加「车的
      `propertyId` 必须等于本次下单的 `propertyId`」判定 —— 否则完整模式留在车里的房会被关怀模式
      悄悄拿去下单。

      ⚠️ 不带日期(如从「我的精选」)进来时,购物车页按「没选日期 = 1 晚」算合计,而向导会按
      `normalizeDates` 规整成「今天起 2 晚」,两页合计差一倍晚数;以向导为准,实付仍以
      `trip/create` 返回的 `payAmount` 为准。
      **验证**:`npm run typecheck` 零报错;`TripController.php` 借 order-service 容器的 PHP 跑
      `php -l` 通过。⚠️ 本机未装 php,`scripts/check.ps1` 仍停在第 1 步(本次 PHP 改动已单独 lint);
      ⚠️ **未做真机 / Web 冒烟**。

- [x] **Rooms 页签房型卡:Choose 后就地变加减器**(2026-09-21,加减器取自 Room Cart `2659:12366`):
      正常模式房型卡原本是 Choose ⇄ Remove 两段文案,现改为 Choose → **就地换成加减器**,
      减到 0 移出并变回 Choose、**不弹确认**(购物车页那张 Alert Overlay `2659:12483` 是删整条时
      才有的;房型卡点错再点一下就回来,多一次确认反而碍事)。
      设计稿 `222:1428` 三张卡画的都是未选态、没给已选态视觉,所以已选态**直接复用购物车页那只**,
      不自创第三种样式。

      **新增 `components/hotel/RoomStepper.tsx`** 给购物车页与房型卡共用 —— 此前加减器在
      `RoomCartScreen` 内联了一份、`lite/LiteRoomCard` 又有一份,改一处忘另一处就会出现
      「同一个控件两种样子」。`RoomCartScreen` 已切过去(内联样式删掉),**关怀模式那份没动**
      (它是旧稿 `2707:13670` 的规格,尺寸字号都不同,合并反而会改掉 Lite 的版式)。

      接口改动:`HotelRoomCard` 的 `selectLabel` 只剩未选态文案,新增 `quantity` + `onChangeQuantity`;
      `HotelRoomsTab` 的 `onToggleRoom` / `pickedKeys` 换成 `onChooseRoom` / `onChangeQuantity` /
      `quantities`;`HotelDetailScreen` 把加减器直接接到 `roomCartStore.setQuantity`
      (传 0 即移出,与购物车页同一个 action,两处行为不会走偏),Choose 仍走 `toggle`
      —— 它只在间数为 0 时出现,等同于「加入」。引导页那张示意卡显式 `quantity={0}` 恒为未选态。
      `hotels.detail.rooms.remove` 已无调用点,三份 i18n 删除,**1060 键零差异**。
      **验证**:`npm run typecheck` 零报错;⚠️ **未做真机 / Web 冒烟**。

- [x] **正常模式预订结果页整页重做**(2026-09-21,Figma `2659:13475` 多房间 / `224:3826` 单房间):
      用户给的两张稿**其实是同一页** —— 唯一差别是状态卡里「Booking Status」有几行:
      多房间一行一个预订(标 `(Room n)`),单房间只有一行、不带房号。所以一份实现两用,
      行数由下单快照 `roomCartStore.booked` 决定(**一条 = 一个预订**,`trip/create` 按房型各建一单);
      同一房型订了多间时稿面没画,按既有的「× n」口径补在房号里,不另造版式。

      **整页换掉上一版**(`1675:6714` 二维码凭证页):QR、Booking Summary 四行(入离 / 人数 / 实付)、
      Download Voucher、Back to Home 稿面都没有了。现在是:结果头(状态色 10% 的 96x88 圆底 + 40 图标 +
      Inter 700 24/32 标题 + 说明)→ 凭证卡(1px 白描边 / 圆角 24 / p25 / 投影 0 -4 20 `rgba(78,115,255,.08)`;
      logo 100x74 +「Travel with us」+ 状态行 + 可复制的 Booking ID)→ Booking Details
      (96 缩略图圆角 12.8 + 酒店名 + 日期行)→ 引流卡 → 吸底只剩一枚 View Booking。
      **核销码没有丢**:它在订单详情页(`OrderDetailScreen` 的 `VerifyCodeView`),
      所以「View Booking」跳 `OrderDetail`,演示模式没有单号就退回 `OrderList` —— 与关怀模式成功页同一处理。

      **一屏两态**,与 `BookingSuccessLiteScreen` 同一套状态机(路由参数 `status`):
      `confirmed` 绿勾 PAID/CONFIRMED,`confirming` 橙钟 PAID/CONFIRMING(**稿面画的是这一态**)。
      ⚠️ **`confirming` 目前产生不了,不是漏接**:后端 `ORDER_STATUS` 没有「等酒店确认」这一档,
      `order/pay` 与 `trip/pay` 成功即已支付且预订已确认,所以缺省 `confirmed`;
      后端补上该状态时只需让 `useBookingWizard.goSuccess` 传 `status: 'confirming'`,页面不用再动。

      **新增两枚图标 + 一张图**:`HomeIcon` 补 `walletCreditCard` / `calendarClock`
      (fluent:wallet-credit-card-20-filled / calendar-clock-20-filled,20 原生画布,
      path 由稿面导出的 SVG 直接提取)—— 与已有的 `wallet`(15.833)、`wallet20`、`calendar`
      都是**不同字形**,没有互相顶替;`assets/images/logo-2026.png`(532x386)是稿面那张蓝底 logo,
      仓库原有的 `logo.png` 是白底蓝字那版,**不是同一张**。

      ⚠️ **两处照稿不能照抄**:① 稿面的说明文字与两枚状态药丸是 Plus Jakarta Sans,本项目没装这个字族
      (`App.tsx` 只加载 Outfit + Inter),与关怀模式成功页同一口径用 Inter 顶替 ——
      同一套设计的两页,顶替口径必须一致;② 详情标题稿面写 20/16,那个 16 是 Figma 文本框高度,
      RN 上会切掉下行字母,按 24(关怀模式成功页同一处也是这么做的)。
      ⚠️ 稿面缩略图是酒店照片,接口这一层没把酒店封面透到成功页 —— 用**本单第一间房的封面**
      (购物车快照里现成的真实图),没有才回落临时图,不假装有图。

      i18n:`hotels.booking.success` 段重写(+15 新键,清掉 8 个旧凭证页的键),三份**零差异 1062 键**;
      ⚠️ 新增缅文 10 条待母语复核。顺带删掉失去调用点的 `TEMP_VOUCHER_QR` 与 `VOUCHER_TAGS`
      (`voucher-qr.png` 文件留在原地);`react-native-qrcode-svg` 全仓已无调用,依赖未动。

      **验证**:新增 `scripts/check-booking-success-page.cjs`(67 项:稿面尺寸/色值/结构 + 新图标与资产 +
      路由参数 + i18n 结构),**GREEN 67/67**,并做过**灵敏度自检**(故意把缩略图圆角 12.8 改成 12、
      多画一条分隔线 → `RED 65/67`,样本即删);`npm run typecheck` 零报错;
      `npx expo export -p web` 通过(顺带验证新 logo 打进了包)。
      ⚠️ 该脚本**未接进 `scripts/check.ps1`**(本机仍未装 php,那条链第 1 步即断);
      ⚠️ **未做真机 / Web 冒烟,需人工对图**。

      🐞 **交付后用户报缺陷并已修**:点 View Booking 进订单详情,**详情页返回又回到成功页** ——
      本屏是下单流程的终点、稿面**没有任何返回入口**(吸底只有这一枚按钮),于是卡成
      「成功页 ⇄ 订单详情」出不来。根因是那枚按钮用了 `navigate`(往栈上再 push 一层);
      上一版之所以没暴露,是因为它吸底还有一枚「Back to Home」,而新稿把它去掉了。
      改成 `navigation.reset` 重置为「底部 Tab(我的预订)+ 订单详情」:详情页返回落到预订列表,
      已完成的结账流程整个从历史里移除(本来也不该退回去)。
      **关怀模式成功页 `BookingSuccessLiteScreen` 是同一段代码、同一个坑,一并修了。**
      契约脚本补 2 条断言(必须用 `reset`、底下垫的是 `MyPickTab`):**GREEN 69/69**;typecheck 零报错。
