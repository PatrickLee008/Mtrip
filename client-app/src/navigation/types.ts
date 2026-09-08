/**
 * 导航参数表:Stack / Tab 路由类型定义
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

import type { SmsScene } from '@/api/user';
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
  email?: string;
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
   */
  HotelDetail: { id?: number; checkIn?: string; checkOut?: string } | undefined;
  /**
   * 订房向导(Figma section 1675:5776),房型卡 Select 的落地页。
   * 4 步在同一个路由内切换,`roomKey` 只用来指定进来时选中的房型(演示模式下可缺省)。
   */
  HotelBooking:
    | {
        roomKey?: string;
        /** 搜索页选好的入离日期(`YYYY-MM-DD`),缺省时向导用明天起 1 晚 */
        checkIn?: string;
        checkOut?: string;
        /** 真实商品 id;带上即「真实模式」,向导会拉 /goods/detail 并真的下单 */
        goodsId?: number;
        /** 选中的房型 id(hotel_room_type.id) */
        skuId?: number;
        /**
         * 从常旅客页选回来的主要入住人。**只有姓名** ——
         * `user_traveler` 没有联系方式列,`/app/user/me` 的手机号与邮箱又是脱敏的,
         * 拿不到可直接提交的原值,所以电话/邮箱仍由用户自己填。
         */
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
  /** 预订成功(1675:6714);真实下单后带上订单结果,缺省则显示设计稿演示值 */
  BookingSuccess:
    | {
        orderNo?: string;
        /** 支付接口返回的核销码,成功页的二维码就是它 */
        verifyCode?: string;
        hotelName?: string;
        address?: string;
        checkIn?: string;
        checkOut?: string;
        adults?: number;
        rooms?: number;
        paidTotal?: number;
      }
    | undefined;
  GoodsList: { goodsType?: number; categoryId?: number; keyword?: string; title?: string };
  GoodsDetail: { id: number };
  OrderList: undefined;
  OrderConfirm: { goodsId: number; skuId: number };
  OrderDetail: { orderId: number };
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
