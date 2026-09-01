# 模块10:移动端 client-app(Expo 51 + RN + TS)

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
- [-] api/marketing.ts:后端 marketing-service 归模块06,待其落地后补充,避免无后端的误导性 API 文件

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
- [x] screens/order:下单确认页(日期/数量/联系人/预估价)、订单列表(状态Tab/获焦刷新)、订单详情(mock支付/核销码/取消/退款申请)
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
  **当前是静态页**:后端没有酒店下单接口、支付仍是 mock,数值走 `screens/hotel/bookingDemo.ts`,
  交互只在页面内生效。完整记录见 HANDOFF「★ 2026-09-01(订房流程)」。
