/**
 * 领域模型类型(与模块09 后端返回结构对齐)
 * 注意:user 模块返回 camelCase;goods/order/site 返回数据库 snake_case 原始行
 */

/** 站点(system-service /api/v1/app/site/list) */
export interface SiteInfo {
  id: number;
  parent_id: number;
  site_name: string;
  site_type: number;
  site_domain: string;
  country_code: string;
  timezone: string;
  currency: string;
  language: string;
  sort: number;
}

/** 站点公开配置 */
export interface SiteConfigData {
  site: Omit<SiteInfo, 'parent_id' | 'sort'>;
  configs: Record<string, string>;
}

/** C端用户资料(user-service,camelCase 脱敏) */
export interface UserProfile {
  id: number;
  siteId: number;
  nickname: string;
  avatar: string;
  mobile: string;
  email: string;
  memberLevelId: number;
  memberLevelName: string;
  balance: string;
  points: number;
  realNameStatus: number;
  registerTime: string | null;
}

/** 登录/注册返回 */
export interface AuthResult {
  token: string;
  expiresIn: number;
  user: UserProfile;
}

/** 商品列表行(goods-service,含起价) */
export interface GoodsItem {
  id: number;
  goods_type: number;
  category_id: number;
  goods_name: string;
  goods_brief: string;
  cover_image: string;
  address: string;
  longitude: string | null;
  latitude: string | null;
  star_level: number;
  is_recommend: number;
  is_hot: number;
  sales_count: number;
  minPrice: number;
  /** 缅甸公民起价(后端 rowWithPrice 一并下发,无公民价时等于 minPrice) */
  minPriceCitizen?: number;
  /**
   * 评分与评价数:设计稿搜索结果卡有「Rating: 9.3 (1,230 Review)」一行,
   * 酒店市场列表从真实已显示评价聚合；其他商品/旧响应没有时不渲染。
   */
  rating?: number;
  reviewCount?: number;
}

/**
 * 收藏列表行(user-service /user/favorite/list,join goods_info 直出)
 * 注意:后端未返回起价与评分,故收藏卡片不展示价格
 */
export interface FavoriteItem {
  id: number;
  goods_id: number;
  created_at: string;
  goods_name: string;
  cover_image: string;
  address: string;
  star_level: number;
  goods_type: number;
  status: number;
}

/**
 * 常旅客(user-service `/api/v1/app/user/traveler/list`,列表行 snake_case 直出)
 *
 * `id_no` 是**脱敏值**(后端 MaskHelper::idCard,形如 12****3456),不是原文 ——
 * 编辑时留空即保持原值,不要把它当默认值提交回去。
 */
export interface TravelerItem {
  id: number;
  site_id: number;
  user_id: number;
  nationality: string;
  first_name: string;
  last_name: string;
  /** 1 NRC 2 护照 3 其他 */
  id_type: number;
  /** 已脱敏 */
  id_no: string;
  /** YYYY-MM-DD,可为空 */
  id_expire_date: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

/** 商品分类(两级树) */
export interface GoodsCategory {
  id: number;
  parent_id: number;
  category_name: string;
  goods_type: number;
  icon: string;
  sort: number;
  children: GoodsCategory[];
}

/** SKU:酒店房型/门票票种(字段并集,按 goods_type 取用) */
export interface GoodsSku {
  id: number;
  goods_id: number;
  base_price: string;
  base_stock: number;
  status: number;
  sort: number;
  /* 房型字段 */
  room_name?: string;
  bed_type?: string;
  area?: string;
  max_guests?: number;
  breakfast?: number;
  images?: string[];
  facilities?: string[];
  /* 票种字段 */
  ticket_name?: string;
  ticket_kind?: number;
  time_slots?: unknown[];
  valid_days?: number;
  book_limit?: number;
  advance_hours?: number;
  verify_times?: number;
}

/** 退改规则 */
export interface RefundRule {
  id: number;
  sku_type: number;
  sku_id: number;
  rule_type: number;
  rules: Array<{ hours_before: number; refund_rate: number }>;
  remark: string;
}

/** 商品详情 */
export interface GoodsDetail extends GoodsItem {
  merchant_id: number;
  goods_detail: string | null;
  images: string[];
  facilities: string[];
  open_time: string;
  close_time: string;
  skus: GoodsSku[];
  refundRules: RefundRule[];
}

/** 价格库存日历项 */
export interface CalendarDay {
  date: string;
  price: number;
  stock: number;
  closed: boolean;
}

/** 订单列表行(order-service) */
export interface OrderItemData {
  id: number;
  order_no: string;
  order_type: number;
  goods_id: number;
  goods_name: string;
  goods_image: string;
  sku_name: string;
  quantity: number;
  pay_amount: string;
  order_status: number;
  refund_status: number;
  use_date: string | null;
  end_date: string | null;
  created_at: string;
}

/** 订单详情 */
export interface OrderDetail extends OrderItemData {
  site_id: number;
  user_id: number;
  unit_price: string;
  original_price: string;
  total_amount: string;
  discount_amount: string;
  pay_method: number;
  pay_trade_no: string;
  pay_time: string | null;
  contact_name: string;
  contact_phone: string;
  verify_code: string;
  cancel_reason: string;
  remark: string;
}

/** 核销码展示数据 */
export interface VerifyCodeData {
  orderNo: string;
  verifyCode: string;
  orderStatus: number;
  goodsName: string;
  skuName: string;
  quantity: number;
  useDate: string | null;
}

/* ============================================================
 * 营销(marketing-service /api/v1/app/marketing/*)
 * ============================================================ */

/** 促销中心活动(列表) */
export interface CampaignItem {
  id: number;
  title: string;
  subtitle: string;
  banner: string;
  landing_url: string;
  start_time: string | null;
  end_time: string | null;
}

/** 促销中心活动详情:附本活动可领的券(统一券口径) */
export interface CampaignDetail extends CampaignItem {
  coupon_ids: number[];
  coupons: CouponView[];
  sort: number;
  status: number;
}

/** 专题位 Banner(marketing_banner position=3) */
export interface PromoBanner {
  id: number;
  title: string;
  image: string;
  link_type: number;
  link_value: string;
}

/** 券状态(后端 CouponView::STATUS_*,文案由前端 i18n 决定) */
export type CouponStatus =
  | 'claimable'
  | 'unclaimable'
  | 'available'
  | 'unusable'
  | 'used'
  | 'expired'
  | 'void';

/** 不可领 / 不可用原因(后端 CouponView::REASON_*) */
export type CouponReason =
  | 'sold_out'
  | 'limit_reached'
  | 'not_started'
  | 'expired'
  | 'used'
  | 'void'
  | 'min_amount'
  | 'scope'
  | 'offline';

/**
 * 统一优惠券视图:领券中心 / 活动详情 / 券详情 / 我的券 / 结账共用同一套字段。
 * 未领取的券 `receive_id=0`、`coupon_code=''`;已领取的券带券码与状态。
 */
export interface CouponView {
  /** 券模板ID(领取时提交) */
  coupon_id: number;
  /** 领券记录ID(未领取=0;下单提交的 couponId 是这个) */
  receive_id: number;
  coupon_code: string;
  coupon_name: string;
  /** 1 满减 2 折扣 3 无门槛 */
  coupon_type: number;
  /** 满减/无门槛=金额,折扣=10 分制折扣率(如 8.5) */
  discount_value: number;
  /** 使用门槛,0=无门槛 */
  min_amount: number;
  /** 折扣券封顶,0=不限 */
  max_discount: number;
  /** 0 全部 1 酒店 2 门票 3 指定商品 */
  goods_scope: number;
  goods_ids: number[];
  sku_ids: number[];
  applicable_hotels: { goods_id: number; goods_name: string }[];
  applicable_rooms: { sku_id: number; goods_id: number; room_name: string }[];
  /** 0 不可与其他优惠叠加 1 可叠加 */
  stackable: number;
  valid_start: string | null;
  valid_end: string | null;
  remark: string;
  status: CouponStatus;
  /** null = 可领 / 可用 */
  unusableReason: CouponReason | null;
  /* ---- 券模板侧特有(领券中心 / 活动详情) ---- */
  total_count?: number;
  received_count?: number;
  per_user_limit?: number;
  myReceived?: number;
  canClaim?: boolean;
  /** 1 固定日期 2 领取后N天 */
  valid_type?: number;
  valid_days?: number;
  /* ---- 领券记录侧特有(我的券 / 结账) ---- */
  order_id?: number;
  /** 传了下单上下文时才有值 */
  discount?: number;
}

/** 我的优惠券分类 */
export type MyCouponType = 'available' | 'used' | 'expired';

/** 促销码兑换结果 */
export interface PromoRedeemResult {
  receiveId: number;
  couponCode: string;
  couponName: string;
  validStart: string | null;
  validEnd: string | null;
}
