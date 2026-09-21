/**
 * Promotions 页纯函数(Figma `2285:21516`)。
 *
 * 全部为不依赖 Vue 的纯函数,便于 `scripts/check-promotions-figma.mjs` 直接断言,
 * 也避免把换算逻辑散落在模板里(模板禁用 `as` 断言与 TS 类型标注)。
 */
import type { MerchantPromotion, PromotionPayload, PromotionPerformanceRow } from '@/api/promotions';
import { DISCOUNT_UNIT, PROMOTION_KIND } from '@/api/promotions';

/** Tab 顺序(稿面 Tab 条 + 功能需求要求的长住) */
export const KIND_TABS = [
  PROMOTION_KIND.percentage,
  PROMOTION_KIND.fixedAmount,
  PROMOTION_KIND.promoCode,
  PROMOTION_KIND.longStay,
] as const;

/**
 * 促销形态。存量/平台券 `promotion_kind = 0`,按 `coupon_type` + 是否有券码兜底推断,
 * 保证老数据也能落到正确的 Tab 上(而不是全部掉进第一个 Tab)。
 */
export function kindOf(row: Pick<MerchantPromotion, 'promotion_kind' | 'coupon_type' | 'promo_code' | 'min_nights'>): number {
  const kind = Number(row.promotion_kind || 0);
  if (KIND_TABS.indexOf(kind as (typeof KIND_TABS)[number]) >= 0) return kind;
  if (Number(row.min_nights || 0) > 0) return PROMOTION_KIND.longStay;
  if (String(row.promo_code || '') !== '') return PROMOTION_KIND.promoCode;
  return Number(row.coupon_type) === 2 ? PROMOTION_KIND.percentage : PROMOTION_KIND.fixedAmount;
}

/**
 * 折扣单位:百分比促销与长住促销固定按「立减百分比」,固定金额促销固定按金额,
 * 优惠码促销由 `coupon_type` 反推(2=折扣券 → 百分比)。
 */
export function unitOf(row: Pick<MerchantPromotion, 'promotion_kind' | 'coupon_type' | 'promo_code' | 'min_nights'>): number {
  const kind = kindOf(row);
  if (kind === PROMOTION_KIND.percentage || kind === PROMOTION_KIND.longStay) return DISCOUNT_UNIT.percent;
  if (kind === PROMOTION_KIND.fixedAmount) return DISCOUNT_UNIT.amount;
  return Number(row.coupon_type) === 2 ? DISCOUNT_UNIT.percent : DISCOUNT_UNIT.amount;
}

/**
 * 折扣文案。稿面写法:`15% Off` / `MMK 5,000 Off`。
 * 百分比直接用后端算好的 `discount_percent_off`(避免前端重复做 10 分制换算)。
 */
export function discountText(row: MerchantPromotion, currency: string): string {
  if (unitOf(row) === DISCOUNT_UNIT.percent) {
    return `${trimNumber(Number(row.discount_percent_off || 0))}% Off`;
  }
  return `${currency} ${thousands(Number(row.discount_value || 0))} Off`;
}

/** 卡片标题里的高亮片段(稿面把折扣数字染成红色 `#EC1317`) */
export function discountHighlight(row: MerchantPromotion, currency: string): string {
  if (unitOf(row) === DISCOUNT_UNIT.percent) {
    return `${trimNumber(Number(row.discount_percent_off || 0))}% Off`;
  }
  return `${currency} ${thousands(Number(row.discount_value || 0))} Off`;
}

/**
 * 状态徽标:稿面只有 Active / Upcoming / Expired 三种,这里把后端的「已停发」也映射成
 * Upcoming(未在跑)之外的独立语义 —— 但稿面没有 Paused 徽标样式,故沿用灰底徽标 + 文案区分。
 */
export function statusKey(status: number): string {
  if (status === 1) return 'active';
  if (status === 0) return 'upcoming';
  if (status === 2) return 'paused';
  return 'expired';
}

/** 领取进度文案:稿面 `45 / 100 Used` / `Unlimited` */
export function usageText(row: MerchantPromotion): string {
  const total = Number(row.total_count || 0);
  if (total <= 0) return '';
  return `${Number(row.used_count || 0)} / ${total} Used`;
}

/** 领取进度比例(0~1);不限量时返回 0,由调用方决定是否画进度条 */
export function usageRatio(row: MerchantPromotion): number {
  const total = Number(row.total_count || 0);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, Number(row.used_count || 0) / total));
}

/**
 * 有效期文案:稿面 `Oct 1 – Oct 31, 2026` / `No Expiry`(空串由调用方换成「不过期」文案)。
 * 同一年内省略起始年份(与稿面一致);跨年则两边都带年份。
 * ⚠ 稿面卡片用的是补零写法(`Oct 01 – Dec 31, 2026`),表格用不补零(`Oct 1 – Oct 31, 2026`)——
 *   同一份稿面自相矛盾,这里统一取不补零写法。
 */
export function validityText(row: MerchantPromotion): string {
  if (Number(row.valid_type) === 2) return `+${Number(row.valid_days || 0)}d`;
  const start = shortDate(row.valid_start);
  const end = shortDate(row.valid_end);
  if (start && end) {
    const sameYear = start.slice(-4) === end.slice(-4);
    return `${sameYear ? shortDateNoYear(row.valid_start) : start} – ${end}`;
  }
  if (start) return start;
  if (end) return end;
  return '';
}

/**
 * 适用对象文案:稿面 `All Room Types` / `Deluxe King Only`。
 * 房型有选中就列房型名(最多 2 个 + `+N`),否则退回物业名,再退回「全部房型」。
 */
export function targetText(row: MerchantPromotion, propertyNames: Record<number, string>, roomNames: Record<number, string>): string {
  const rooms = (row.room_type_ids || []).filter((id) => roomNames[id]);
  if (rooms.length > 0) {
    const names = rooms.slice(0, 2).map((id) => roomNames[id]);
    return rooms.length > 2 ? `${names.join(', ')} +${rooms.length - 2}` : names.join(', ');
  }
  const properties = (row.property_ids || []).filter((id) => propertyNames[id]);
  if (properties.length === 1) return propertyNames[properties[0]];
  if (properties.length > 1) return `${properties[0]} +${properties.length - 1}`;
  return '';
}

/** 促销码文案(kind=3 才有) */
export function promoCodeText(row: Pick<MerchantPromotion, 'promo_code'>): string {
  return String(row.promo_code || '');
}

/** 千分位;稿面金额不带小数 */
export function thousands(value: number): string {
  return Math.round(Number(value || 0)).toLocaleString('en-US');
}

/** 去掉多余的尾零:15.00 → 15,12.50 → 12.5 */
export function trimNumber(value: number): string {
  const fixed = Number(value || 0).toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

/** 百分比展示:0.1234 → 12.3% */
export function percentText(value: number): string {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

/** ROI 展示:保留两位,`倍` 由 i18n 文案给出 */
export function roiText(value: number): string {
  return Number(value || 0).toFixed(2);
}

/** 短日期:`2026-10-01 00:00:00` → `Oct 1, 2026`(稿面英文月份缩写) */
export function shortDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(String(value).replace(/-/g, '/'));
  if (Number.isNaN(date.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** 短日期(不带年):`2026-10-01` → `Oct 1` */
export function shortDateNoYear(value: string | null): string {
  const full = shortDate(value);
  return full ? full.replace(/, \d{4}$/, '') : '';
}

/** 日期区间文案:稿面 `Oct 01, 2026 – Dec 31, 2026` */
export function dateRangeText(start: string | null, end: string | null): string {
  const from = shortDate(start);
  const to = shortDate(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || '';
}

/** 效果分析表格里的折扣文案(只看 coupon_type,不必判 kind) */
export function performanceDiscountText(row: PromotionPerformanceRow, currency: string): string {
  if (Number(row.coupon_type) === 2) {
    return `${trimNumber((10 - Number(row.discount_value || 0)) * 10)}% Off`;
  }
  return `${currency} ${thousands(Number(row.discount_value || 0))} Off`;
}

/** 生成随机券码(稿面 `Generate Random`);避开易混字符 O/0/I/1 */
export function randomPromoCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return code;
}

/** 抽屉表单模型(模板里只用这个结构,不再散落字段) */
export interface PromotionForm {
  id: number;
  merchantId: number;
  couponName: string;
  description: string;
  promotionKind: number;
  discountUnit: number;
  discountValue: number;
  minAmount: number;
  maxDiscount: number;
  limitTotal: boolean;
  totalCount: number;
  perUserLimit: number;
  minNights: number;
  maxNights: number;
  bookAdvanceDays: number;
  noExpiry: boolean;
  validStart: string;
  validEnd: string;
  promoCode: string;
  propertyIds: number[];
  roomTypeIds: number[];
  remark: string;
  staffNote: string;
}

/** 新建时的表单初值(稿面默认:百分比、20、限 100 次、30 天有效期窗口) */
export function defaultForm(kind: number = PROMOTION_KIND.percentage): PromotionForm {
  return {
    id: 0,
    merchantId: 0,
    couponName: '',
    description: '',
    promotionKind: kind,
    discountUnit: DISCOUNT_UNIT.percent,
    discountValue: kind === PROMOTION_KIND.fixedAmount ? 0 : 20,
    minAmount: 0,
    maxDiscount: 0,
    limitTotal: true,
    totalCount: 100,
    perUserLimit: 1,
    minNights: kind === PROMOTION_KIND.longStay ? 3 : 0,
    maxNights: 0,
    bookAdvanceDays: 0,
    noExpiry: false,
    validStart: '',
    validEnd: '',
    promoCode: '',
    propertyIds: [],
    roomTypeIds: [],
    remark: '',
    staffNote: '',
  };
}

/** 编辑:详情 → 表单。百分比按「立减百分比」回填,金额直接回填 */
export function formFromDetail(row: MerchantPromotion): PromotionForm {
  const form = defaultForm(kindOf(row));
  form.id = Number(row.id);
  form.merchantId = Number(row.merchant_id || 0);
  form.couponName = String(row.coupon_name || '');
  form.description = String(row.description || '');
  form.discountUnit = unitOf(row);
  form.discountValue = form.discountUnit === DISCOUNT_UNIT.percent
    ? Number(row.discount_percent_off || 0)
    : Number(row.discount_value || 0);
  form.minAmount = Number(row.min_amount || 0);
  form.maxDiscount = Number(row.max_discount || 0);
  form.limitTotal = Number(row.total_count || 0) > 0;
  form.totalCount = Number(row.total_count || 0);
  form.perUserLimit = Number(row.per_user_limit || 1);
  form.minNights = Number(row.min_nights || 0);
  form.maxNights = Number(row.max_nights || 0);
  form.bookAdvanceDays = Number(row.book_advance_days || 0);
  form.noExpiry = !row.valid_end;
  form.validStart = String(row.valid_start || '');
  form.validEnd = String(row.valid_end || '');
  form.promoCode = String(row.promo_code || '');
  form.propertyIds = (row.property_ids || []).map((id) => Number(id));
  form.roomTypeIds = (row.room_type_ids || []).map((id) => Number(id));
  form.remark = String(row.remark || '');
  form.staffNote = String(row.staff_note || '');
  return form;
}

/** 表单 → 接口载荷(把 boolean 勾选翻译成后端要的 0/1 与 0 值语义) */
export function formToPayload(form: PromotionForm): PromotionPayload {
  const isPercentKind = form.promotionKind === PROMOTION_KIND.percentage
    || form.promotionKind === PROMOTION_KIND.longStay
    || (form.promotionKind === PROMOTION_KIND.promoCode && form.discountUnit === DISCOUNT_UNIT.percent);
  return {
    id: form.id > 0 ? form.id : undefined,
    merchantId: form.merchantId > 0 ? form.merchantId : undefined,
    couponName: form.couponName.trim(),
    description: form.description.trim(),
    promotionKind: form.promotionKind,
    discountUnit: isPercentKind ? DISCOUNT_UNIT.percent : DISCOUNT_UNIT.amount,
    discountValue: Number(form.discountValue || 0),
    minAmount: Number(form.minAmount || 0),
    maxDiscount: isPercentKind ? Number(form.maxDiscount || 0) : 0,
    // 「Limit total number of uses」不勾 → 0 = 不限量
    totalCount: form.limitTotal ? Math.max(0, Number(form.totalCount || 0)) : 0,
    perUserLimit: Math.max(1, Number(form.perUserLimit || 1)),
    minNights: form.promotionKind === PROMOTION_KIND.longStay ? Number(form.minNights || 0) : 0,
    maxNights: form.promotionKind === PROMOTION_KIND.longStay ? Number(form.maxNights || 0) : 0,
    bookAdvanceDays: Math.max(0, Number(form.bookAdvanceDays || 0)),
    validType: 1,
    validStart: form.validStart || undefined,
    // 「No expiry date」勾选 → 不传结束时间(后端落 NULL = 不过期)
    validEnd: form.noExpiry ? undefined : (form.validEnd || undefined),
    noExpiry: form.noExpiry ? 1 : 0,
    promoCode: form.promotionKind === PROMOTION_KIND.promoCode ? form.promoCode.trim().toUpperCase() : '',
    propertyIds: form.propertyIds,
    roomTypeIds: form.roomTypeIds,
    remark: form.remark.trim(),
    staffNote: form.staffNote.trim(),
  };
}

/** 表单校验:返回 i18n 词条键,空串 = 通过(模板据此弹提示) */
export function validateForm(form: PromotionForm): string {
  if (form.couponName.trim() === '') return 'promotions.validation.name';
  if (form.propertyIds.length === 0) return 'promotions.validation.goods';
  if (form.promotionKind === PROMOTION_KIND.promoCode && form.promoCode.trim() === '') return 'promotions.validation.promoCode';
  if (Number(form.discountValue) <= 0) return 'promotions.validation.discount';
  if ((form.promotionKind === PROMOTION_KIND.percentage || form.promotionKind === PROMOTION_KIND.longStay
    || (form.promotionKind === PROMOTION_KIND.promoCode && form.discountUnit === DISCOUNT_UNIT.percent))
    && Number(form.discountValue) >= 100) {
    return 'promotions.validation.discountRange';
  }
  if (form.promotionKind === PROMOTION_KIND.longStay && Number(form.minNights) < 2) return 'promotions.validation.minNights';
  if (form.validStart === '') return 'promotions.validation.start';
  if (!form.noExpiry && form.validEnd === '') return 'promotions.validation.end';
  return '';
}
