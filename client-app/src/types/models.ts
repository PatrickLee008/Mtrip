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
