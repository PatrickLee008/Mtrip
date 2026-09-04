/**
 * 导航参数表:Stack / Tab 路由类型定义
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

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
   * 当前是静态页(后端无优惠券接口),故不带参数。
   */
  CouponDetail: undefined;
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
  /** 短信验证码(Figma `566:3741` / `566:3902`),注册表单的下一步 */
  VerifyOtp: { draft: SignupDraft };
  /** 推荐码(Figma `1077:1734`),注册流程最后一步,在这里真正提交注册 */
  ReferralCode: { draft: SignupDraft };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
