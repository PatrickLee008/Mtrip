# 2026-11-05 Consumer App QA 复测记录

来源:`C:\test_result\mTrip Test Cases.xlsx`(11-05 版)。表已按模块拆成 16 个 Consumer App 页签(Login / Register / Hotels / Promotion / mTrip Wallet / Referral / Accessibility Mode / Reviews / Chat / Notifications / UIUX Consumer App …)。
复测环境:本地开发栈 + Expo Web(8082)+ Chrome CDP,测试账号 +95 977700123(用户 32,站点 7)。UI 对稿用 Figma 文件 `k6yJOiDvU0fqkmrHUGBfyT`。
QA 附图在 Google Drive,本机无法访问,UI 判断只基于设计稿与 App 截图对照。

## 一、已修复,可请 QA 关闭(48 + 4)

功能(测试日期多为 9 月,是旧结论):
- Hotels:H_TC_003–016(12 种筛选 + 组合 + 最近使用)、H_TC_022–026(精确/±1/2/3/7 天,请求带 `flexDays`)、H_TC_027 / 072(返回链路)、H_TC_035(附加服务计入应付)、H_TC_039(钱包扣款正确)、H_TC_040 / 074(跨月)、H_TC_052(排序可重置)、H_TC_062 / 093(数量上限 = 剩余间数,可多间)、H_TC_078(特殊要求入库并在预订详情展示)、H_TC_080 / 088 / 089(必填与格式校验)。
- Accessibility Mode:L_TC_006–019、025–031、038、042(与普通模式同一套实现,实测筛选、灵活日期、返回、详情、附加服务计价、钱包扣款均正常)。

UI(与设计稿一致):UI/UX_TC_011(订房第 1 步底栏 Back + Continue)、UI/UX_TC_012(房型按钮「Choose」)、UI/UX_TC_013(选房可加减)、GM_TC_030(英文占位「Search anything...」)。

## 二、确认仍有问题

### 功能(25 条)— 2026-11-05 已修复,待 QA 复测

修复与实测结论(用户 11-05 拍板:旅行保障只恢复入口;活动分类走后台字段;短信接 SMSPoh):
| 用例 | 修复 | 实测 |
|---|---|---|
| L_TC_008、R_TC_007 | 登录 / 注册 / 忘记密码 / 保险页手机号只留数字(`utils/validate.ts digitsOnly`);订房联系电话保留空格横线与 +(`phoneChars`) | `9abc77-00x123` → `97700123` |
| R_TC_012 | 设密码统一「6-32 位 + ≥1 大写 + ≥1 数字」:App `isPassword` 与 user-service `UserAuthService::PASSWORD_PATTERN`(注册 / 重置 / 改密);登录只校验长度(`isLoginPassword`),不挡老密码 | 注册页 `abcdef1` 被拦;后端正则 5 组样例符合预期 |
| H_TC_036 / 096 / 097 | 真实酒店订房第 1 步(普通 + 关怀模式)末尾常驻 Insurance 入口卡,进 Travel Protection 页;价格位写「Coming soon」不计价 —— 保险在 PRD 是 Phase 2,无保险商接口,**096 / 097(付保费)仍属 Phase 2** | 入口出现并能进保险页 |
| P_TC_001 | 券卡抽成 `CouponSelectCard`,多房间第 2 步(余额够付即终点)也放券卡,可选 / 换 / 不用券,明细与钱包抵扣随之重算 | 余额临时调到 200,000:第 2 步 Pay Now 下可「Don't use a coupon」,合计改为钱包抵 120,000;余额已恢复 101,000 |
| P_TC_003 | 卡片首行改为券名(无名称才退回券码) | 「我的优惠券」显示「[C Demo] 5,000 Off No Minimum」 |
| P_TC_005 | 迁移 `V20261105100000__campaign-type`:`marketing_campaign.campaign_type`(0 常规 1 季节 2 每周 3 每月 4 节日/特别);后台「促销活动」可选类型、列表列与筛选;App 促销中心按类型分页签,同类多场用标题胶囊切换 | 临时建 2 场活动验证分页签与空态后已删除 |
| MTW_TC_001–007 | 新增钱包页 `WalletScreen`(Figma 3452:9373:余额卡、All/Refunds/Spend/Expired、月份筛选、流水卡、「?」说明弹窗)与交易详情 `WalletTxnDetailScreen`(3452:8470);`/app/user/balance-logs` 增加 `type` / `month` 筛选并补 `txn_no` / `booking_no` / `property_name`(按备注区分 Trip 号与订单号);「更多」页钱包卡点击进入 | 测试账号流水、退款筛选、10 月筛选、详情、说明弹窗均正常。钱包余额目前无过期机制,Expired 页签恒空(预留 change_type 6) |
| MTW_TC_008 | 启动即拉站点配置;登录 / 注册 / 第三方登录后对齐账号所属站点(`siteStore.followUserSite`) | 本地默认站点 1 本身是 EUR 站;QA 环境若默认站点不是缅甸站,`EXPO_PUBLIC_DEFAULT_SITE_ID` 需指向缅甸站 |
| RV_TC_008 | 评价卡在图片后渲染视频(原生控件,可全屏) | 临时插一条带视频的评价验证后已删除 |
| CH_TC_002 | 与酒店的会话在输入框为空时给 3 条预设问题(入住退房时间 / 早餐 / 接送机),点了填进输入框可改后发送 | 实测填入正常 |
| N_TC_018–020 | `UserSms`:退款申请(含金额、退款去向、预计 3-7 个工作日)、退款完成、写评价提醒在站内信之外经 SMSPoh RESTful API 发短信(协程异步、写 `sys_sms_log` scene=notify);复用后台短信渠道配置 | 单测覆盖模板与发送请求;**本地未启用短信渠道,真实发送需在 QA 环境验证**(短信渠道需开通 SMSPoh 普通短信与 Sender ID) |

原问题清单:
| 用例 | 问题 | 定位 |
|---|---|---|
| L_TC_008、R_TC_007 | 手机号框可输入字母符号 | Web 上 `keyboardType="phone-pad"` 不限制字符;登录/注册/忘记密码页需在 onChangeText 过滤非数字 |
| R_TC_012 | 密码只校验 6–32 位,缺「≥1 大写 + ≥1 数字」 | `client-app/src/utils/validate.ts isPassword` + user-service `AuthController`(注册、重置)/`UserController`(改密) |
| H_TC_036 / 096 / 097 | 真实酒店订房找不到旅行保障入口 | `components/hotel/booking/StayExtras.tsx AddOnsSection`:有商户附加服务时只渲染附加服务,保险卡只在演示模式出现(2026-10-14 附加服务改造引入);保险页本身仍是静态页 |
| P_TC_001 | 钱包余额够时第 2 步直接「立即支付」,自动套最优券,不能选/换/取消券 | `screens/hotel/HotelBookingScreen.tsx` 的 `walletCovers` 分支;券选择只在第 3 步 `BookingStepPayment` |
| P_TC_003 | 「我的优惠券」首行显示券码而非券名 | `screens/promotions/couponFormat.ts:112` `codeLine: coupon_code \|\| coupon_name` |
| P_TC_005 | 优惠中心无季节/周/月/节日活动分类 | 目前只按服务品类 |
| MTW_TC_001–007 | 无钱包明细页(指南、全部/退款/支出/过期/按月筛选、交易详情) | 后端 `/app/user/balance-logs` 与前端 `fetchBalanceLogs` 已有,无页面 |
| MTW_TC_008 | 站点信息未加载前币种默认 EUR | `store/siteStore.ts` 默认 `currency: 'EUR'` |
| RV_TC_008 | 酒店详情评价卡不显示视频 | `components/hotel/HotelReviewCard.tsx` |
| CH_TC_002 | 聊天无预设问题 | `screens/chat/ChatScreen.tsx` |
| N_TC_018–020 | 短信通知未接 | 需先定服务商 |

### UI 与 Figma 不一致(10 条)— 2026-11-05 已全部修复,待 QA 复测

修复要点:快捷入口换成设计稿现行的蓝底白色线性图标 PNG(`assets/images/home/`);会员卡按钮靠右;HIGH DEMAND 移到描述下方;首页搜索框去掉 Explore 按钮(370x45 r24);
搜索页与结果页顶栏改为「how do I book ?」胶囊、Myanmar Citizen 后加 `fluent:info-20-filled` 说明按钮(点开提示本地居民价,共用 `components/hotel/HotelSearchBits.tsx`);
Stay Longer 标题左对齐;结果卡星级用 `colors.star`;券详情 OFF/立减与「PROMOTION DESCRIPTION」为主色、长券码单行按宽度缩字号。
UI/UX_TC_004:`goods/home` 的 recommend 在站点未发布酒店排行时回落为可搜索酒店默认排序;同时修了该区块两处潜在问题 —— 卡片名称读 `property_name`、点击进酒店详情(原来误进门票商品详情)。

| 用例 | 设计稿 | App |
|---|---|---|
| UI/UX_TC_002 | 首页四个快捷入口为白色线性图标(Home `81:2464`) | 3D 插画图标 |
| UI/UX_TC_003 | 会员卡 Login/Sign Up 按钮靠右 | `components/home/MemberCard.tsx` `alignSelf: 'flex-start'` 靠左 |
| UI/UX_TC_004 | Special Deals 与 Dining Offers 之间有 Hotel Promotion(`81:2619`) | 区块只在 `goods/home` 的 `recommend`(后台排行 `ranking_market` 已发布)非空时渲染;本地未发布故不显示。需确认 QA 环境是否发布酒店排行,或改为无数据时的兜底 |
| UI/UX_TC_005 | 本地体验卡 HIGH DEMAND 标签在描述下方 | 在标题上方 |
| UI/UX_TC_006 | 首页搜索框 Explore 按钮 hidden | 仍显示 |
| UI/UX_TC_007 | 酒店搜索页筛选按钮左侧有「how do I book ?」胶囊(Search 1 `91:200`) | 只有「?」圆钮 |
| UI/UX_TC_008 | Myanmar Citizen 后有 `fluent:info-20-filled` 说明图标 | 无 |
| UI/UX_TC_009 | 「Stay Longer, Save More」左对齐 | 居中 |
| UI/UX_TC_010 | 结果卡星级金黄色(`1695:6325`) | `components/hotel/HotelResultCard.tsx:175` 写死 `#FFFFFF` |
| P_TC_009 | 优惠券详情 `1625:2009`:「OFF」与「PROMOTION DESCRIPTION」为主色蓝 | 均为深色;长券码在码框内折两行 |

## 三、无法判断 / 本地无法验证
- UI/UX_TC_001 积分菱形:设计稿首页现为访客顶栏(无积分胶囊),原带积分顶栏 `81:2733` 已从 Figma 删除;组件库菱形 `fluent:diamond-12-filled` 与代码一致。需 QA 截图。
- L_TC-002 忘记密码、L_TC_012 验证码登录:本地无启用短信通道(`sys_sms_channel` id=4 status=2),返回 50021。需在 QA 环境核对短信配置。
- L_TC_003/004、R_TC_003/005 Facebook / TikTok:代码已上,线上平台配置与真实授权待验(见 `docs/plans/21-…`、`23-…`)。
- R_TC_015 邀请链接下载:依赖应用商店与深链。

## 测试数据
订单 72、73(测试账号已支付);领取优惠券 receive_id 74;余额已恢复 101,000。
11-05 修功能时:临时活动 / 临时评价均已删除;从酒店详情点聊天按钮新建了一条测试账号与 QA 测试酒店的会话。
