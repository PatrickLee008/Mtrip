/**
 * 导航参数表:Stack / Tab 路由类型定义
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

import type { SmsScene } from '@/api/user';
import type { DetailTabKey } from '@/screens/hotel/detailDemo';
import type { TravelerItem } from '@/types/models';

/**
 * 注册草稿:注册表单填完、但**还没落库**的资料。
 *
 * 后端 `/app/auth/register` 是一次性收单(手机号 + 密码 + 推荐码),
 * 而设计稿 Onboarding 把「验证码 → 推荐码」排在注册表单之后,
 * 所以 Register / VerifyOtp 两页只收集,真正的注册请求在 ReferralCode 页发出。
 */
export interface SignupDraft {
  mobile: string;
  password: string;
  /** 姓名(取代原邮箱栏),落库进 `user_info.real_name` 加密列 */
  realName: string;
}

/** 底部 Tab(对应 Figma M-Trip / Home 81:2464 的 BottomNavBar) */
export type MainTabParamList = {
  HomeTab: undefined;
  MyPickTab: undefined;
  PromotionsTab: undefined;
  MoreTab: undefined;
};

/** 根 Stack */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  SiteSelect: undefined;
  /** 酒店搜索页(Figma 91:200),首页快捷入口 hotels 的落地页 */
  Hotels: undefined;
  /**
   * 关怀模式酒店搜索页(Figma section `Hotel Search Lite` `2312:6435`),
   * liteMode 下首页 Hotels 卡的落地页;完整模式仍走 `Hotels`
   */
  HotelsLite: undefined;
  /**
   * 关怀模式酒店详情族(Figma section `Hotel Details Lite` `2352:5591`)。
   * 五页共用同一个商品 id;`checkIn/checkOut` 一路透传到订房向导,免得选完房日期跳回默认值。
   */
  HotelDetailLite: { id: number; checkIn?: string; checkOut?: string };
  /**
   * 正常模式房型详情(Figma Rooms Details `281:1041`),酒店详情 Rooms 页签真实房型卡的 See Details 进来。
   * 参数与关怀模式同形:商品 id + 房型 id,日期透传给订房向导。
   */
  RoomDetail: { goodsId: number; skuId: number; checkIn?: string; checkOut?: string };
  /** 房型详情(Rooms Details `2352:6030`) */
  RoomDetailLite: { goodsId: number; skuId: number; checkIn?: string; checkOut?: string };
  /** 酒店信息页(View Hotel Detail `2352:8182`) */
  HotelInfoLite: { id: number };
  /** 酒店政策(Lite Hotel Details Policies `2352:8890`) */
  HotelPolicyLite: { id: number };
  /** 住客评价(Hotel Details Reviews Page `2352:6648`) */
  HotelReviewsLite: { id: number };
  /** 实景预览(Property Preview `2352:7051`) */
  PropertyPreviewLite: { id: number };
  /** 关怀模式酒店搜索结果页(同上 section 的 Search Results `2312:6745`) */
  HotelResultsLite: {
    /** 与完整模式 `HotelResults` 同一套列表参数:两位用于按国家/城市圈定物业 */
    countryCode?: string;
    cityKey?: string;
    keyword?: string;
    checkIn?: string;
    checkOut?: string;
    flexDays?: number;
    citizen?: boolean;
    /** 房间/成人/儿童:列表接口用不上,带过来只为结果页顶部回显与后续透传 */
    rooms?: number;
    adults?: number;
    children?: number;
  };
  /** 酒店搜索结果页(Figma 1695:6325),酒店搜索页 Search 的落地页 */
  HotelResults: {
    countryCode?: string;
    cityKey?: string;
    keyword?: string;
    /** YYYY-MM-DD */
    checkIn?: string;
    checkOut?: string;
    /** 弹性日期天数,0=精确日期 */
    flexDays?: number;
    /** 是否按缅甸公民价展示 */
    citizen?: boolean;
  };
  /**
   * 酒店详情页(Figma 94:438),搜索结果卡的落地页。
   * 真实卡带 id 拉 `/goods/detail`,演示卡无 id 时使用设计稿数据。
   * `checkIn`/`checkOut` 是搜索页选好的日期,只是过一道手透传给订房向导 ——
   * 否则选完房日期会跳回向导自己挑的默认值。
   * `tab` 是**回跳时要落在哪个页签**:评价整页底栏的「Choose my room」用它把本页切到 Rooms
   * (本页在栈里已挂载,`navigate` 只改 params 不重挂,页面里要跟着 params 同步一次)。
   */
  HotelDetail: { propertyId?: number; checkIn?: string; checkOut?: string; tab?: DetailTabKey } | undefined;
  /**
   * 房型购物车(Figma Room Cart `2659:11842`)。
   * 不收参数 —— 车里的内容与所属酒店都在 `store/roomCartStore` 里,避免与详情页两份状态。
   */
  RoomCart: undefined;
  /**
   * 住客评价整页(Figma `Hotel Details Reviews Page` `1133:2998`),
   * 酒店详情 Reviews 页签里「Read All Reviews」的落地页。
   * `checkIn`/`checkOut` 只是过一道手 —— 底栏「Choose my room」回跳详情时要带回搜索页选的日期。
   * 无 `propertyId`(演示酒店)时页面为空态,不发请求。
   */
  HotelReviews: { propertyId?: number; checkIn?: string; checkOut?: string } | undefined;
  /**
   * 订房向导(Figma section 1675:5776),房型卡 Select 的落地页。
   * 4 步在同一个路由内切换,`roomKey` 只用来指定进来时选中的房型(演示模式下可缺省)。
   */
  HotelBooking:
    | {
        roomKey?: string;
        /** 搜索页选好的入离日期(`YYYY-MM-DD`),缺省时向导用今天起 2 晚(与搜索页默认口径一致) */
        checkIn?: string;
        checkOut?: string;
        /** 真实物业 id;带上即「真实模式」 */
        propertyId?: number;
        /** 选中的房型 id(hotel_room_type.id) */
        roomTypeId?: number;
        /**
         * 从常旅客页选回来的主要入住人。**只有姓名** ——
         * `user_traveler` 没有联系方式列,`/app/user/me` 的手机号与邮箱又是脱敏的,
         * 拿不到可直接提交的原值,所以电话/邮箱仍由用户自己填。
         */
        leadGuest?: { firstName: string; lastName: string };
      }
    | undefined;
  /**
   * 关怀模式订房向导(Figma section `Booking Flow` `759:9777`)。
   * 参数与 `HotelBooking` 同形 —— 两页共用 `useBookingWizard`,只是排版与步骤序列不同
   * (关怀版恒 4 步,没有多住宿 trip 步)。Lite 详情 / 房型详情的 Choose 落到这里。
   */
  HotelBookingLite:
    | {
        roomKey?: string;
        checkIn?: string;
        checkOut?: string;
        propertyId?: number;
        roomTypeId?: number;
        leadGuest?: { firstName: string; lastName: string };
      }
    | undefined;
  /**
   * 新增 / 编辑常旅客(1675:5777),向导第 2 步与「更多 / 常用旅客」共用。
   * 带 `traveler` 即编辑态 —— 列表接口已返回全部可编辑字段,不再单独请求详情。
   */
  AddGuest: { traveler?: TravelerItem } | undefined;
  /** 旅行保险(1675:5900),向导第 1 步加购卡的落地页 */
  Insurance: undefined;
  /** Trip 里单段住宿的复核页(1675:9677);index 从 0 起 */
  StayDetail: { index?: number } | undefined;
  /**
   * 预订结果页(Figma `2659:13475` 多房间 / `224:3826` 单房间)。
   * 真实下单后带上订单结果,缺省则显示设计稿演示值。
   */
  BookingSuccess:
    | {
        /** 订单数字主键,给「View Booking」跳 `OrderDetail` 用 */
        orderId?: number;
        orderNo?: string;
        /**
         * 支付接口返回的核销码。新稿的成功页不再画二维码(核销码在订单详情页),
         * 这个参数留着是因为向导两条链路都拿得到它,后续要在成功页加凭证时不用再改一遍调用方。
         */
        verifyCode?: string;
        hotelName?: string;
        address?: string;
        checkIn?: string;
        checkOut?: string;
        adults?: number;
        rooms?: number;
        paidTotal?: number;
        /** 多房间链路的 Trip 主键;结果页靠它读整车明细并重付整车 */
        tripId?: number;
        /** 支付失败的后端原因(失败态显示,空则回落稿面的固定文案) */
        failReason?: string;
        /**
         * `confirmed` 成功 / `confirming` 等酒店确认(后端暂无此档,稿面 `2540:19741` 留着)/
         * `failed` **支付失败**:单已建好、仍待支付,本页读订单并对同一张单重新发起支付。
         */
        status?: 'confirming' | 'confirmed' | 'failed';
      }
    | undefined;
  /**
   * 关怀模式预订成功(Figma `2540:19863` Booking Confirmed / `2540:19741` Booking Confirming)。
   * 参数比 `BookingSuccess` 多一个 `status`:后端目前没有「等酒店确认」这个状态,
   * 支付成功即 `confirmed`,`confirming` 留着等后端支持(见该页头部注释)。
   */
  BookingSuccessLite:
    | {
        orderId?: number;
        orderNo?: string;
        verifyCode?: string;
        hotelName?: string;
        address?: string;
        checkIn?: string;
        checkOut?: string;
        adults?: number;
        rooms?: number;
        paidTotal?: number;
        /** 多房间链路的 Trip 主键;结果页靠它读整车明细并重付整车 */
        tripId?: number;
        /** 支付失败的后端原因(失败态显示,空则回落稿面的固定文案) */
        failReason?: string;
        /**
         * `confirmed` 成功 / `confirming` 等酒店确认(后端暂无此档,稿面 `2540:19741` 留着)/
         * `failed` **支付失败**:单已建好、仍待支付,本页读订单并对同一张单重新发起支付。
         */
        status?: 'confirming' | 'confirmed' | 'failed';
      }
    | undefined;
  GoodsList: { goodsType?: number; categoryId?: number; keyword?: string; title?: string };
  GoodsDetail: { id: number };
  OrderList: undefined;
  OrderConfirm: { goodsId: number; skuId: number };
  OrderDetail: { orderId: number };
  /**
   * 酒店订单详情(Figma `2659:16092` 多房间 / `289:1670` 单房间,同一页两用)。
   * `tripId` > 0 时按 Trip 展开同单下各预订;缺省就是单个预订。
   * 通用的 `OrderDetail` 仍在(门票等非酒店订单、以及取消/退款动作暂时还在那边)。
   */
  BookingDetail: { orderId: number; tripId?: number };
  /**
   * 多酒店行程详情(Figma `2142:4389`):一个 Trip 下各段住宿排成时间轴,
   * 单段的 View Details 再进 `BookingDetail`。**只读** —— 后端没有改期/改信息接口。
   */
  TripDetail: { tripId: number };
  /**
   * 取消预订(Figma `1205:2159` 退款摘要 → `1205:2480` 取消原因,一个路由内两步)。
   * **按 PRD 取消粒度是「一个 booking」**(§1.1 line 110/142/145),所以只收一个 `orderId`;
   * 同 Trip 下的其他预订不受影响,要取消得各进各的详情页。
   */
  CancelBooking: { orderId: number };
  /**
   * 取消结果页,一页两态:
   *   用户自己取消(Figma `1205:2679`)—— 取消流程 `replace` 进来,退款单号/金额/酒店名/日期都带着,不再请求;
   *   **商户取消**(`1685:3429`)—— 从「我的预订」的已取消单点进来,**只给 `orderId`**,
   *     页面自己拉 `order/detail`(后端附的 `cancelInfo` 里有谁取消的与退款单号)。
   * `by` 不传就按 `cancelInfo.operatorType` 判断(2 = 商户)。
   */
  BookingCancelled: {
    orderId: number;
    refundNo?: string;
    refundAmount?: number;
    hotelName?: string;
    dateRange?: string;
    by?: 'guest' | 'merchant';
  };
  /**
   * 优惠券详情(Figma 1625:2009),优惠中心的券卡落地页。
   * `receiveId` = 我的券(带券码),`couponId` = 尚未领取的券模板;
   * 两者都不传 = 未登录时的设计稿静态详情。
   */
  CouponDetail: { receiveId?: number; couponId?: number } | undefined;
  /* ---- 「更多」section(Figma 1695:5951)的子页,全部无参数(当前都是静态页) ---- */
  /** 通知(Figma 1770:3863),首页 / 我的精选顶部栏铃铛的落地页 */
  Notifications: undefined;
  Account: undefined;
  /** `pick` = 从订房第 2 步进来的「选择主要入住人」模式:点一行即选中并返回,不是多选管理 */
  Travelers: { pick?: boolean } | undefined;
  EditEmail: undefined;
  Referral: undefined;
  ReferralStatus: undefined;
  HowReferralWorks: undefined;
  Guides: undefined;
  LegalTerms: undefined;
  Login: undefined;
  Register: undefined;
  /**
   * 短信验证码(Figma `566:3741` / `566:3902`),三个场景共用一页。
   *
   * **进入本页前上一屏必须已经发过一次码**(注册页 / 忘记密码页 / 登录页的验证码登录入口),
   * 所以本页挂载时不再发码,只按 `resendAfter` 起跳倒计时 —— 否则会连发两条。
   * 验证通过后按 `scene` 分流:register 去推荐码页、login 直接登录、reset 去重置密码页。
   */
  VerifyOtp: {
    scene: SmsScene;
    mobile: string;
    /** scene=register 专用:注册草稿,验证通过后透传给推荐码页统一提交 */
    draft?: SignupDraft;
    /** 发码接口返回的重发冷却(秒),缺省 60 */
    resendAfter?: number;
    /** 发码接口返回的验证码位数(后台可配 4~8),缺省 6 */
    pinLength?: number;
    /** 后端脱敏后的目标号码,用于「已发送到 097****56」;缺省则本地按 mobile 打码 */
    maskedMobile?: string;
  };
  /**
   * 推荐码(Figma `1077:1734`),注册流程最后一步,在这里真正提交注册。
   * `verifyToken` 由验证码页透传;站点没配短信渠道时为空(后端此时也不强制)。
   */
  ReferralCode: { draft: SignupDraft; verifyToken?: string };
  /** 资料向导第 1 步 Complete Your Profile(Figma 2485:8211),入口是注册/登录后的 Set Up Profile 弹窗 */
  ProfileSetup: undefined;
  /** 资料向导第 2 步 Identity Verification(Figma 2485:8355) */
  IdentityVerify: undefined;
  /** 忘记密码第一步:输入手机号发码(设计稿未画,见页面头部注释) */
  ForgotPassword: undefined;
  /** 忘记密码第二步:凭 verifyToken 设置新密码(设计稿未画,见页面头部注释) */
  ResetPassword: { mobile: string; verifyToken: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
