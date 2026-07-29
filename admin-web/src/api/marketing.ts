import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 营销活动接口(marketing-service /api/v1/admin/marketing/*) */
type Row = Record<string, any>;

// ---------- 优惠券模板(文档 6.4.6;状态机:0未开始→1进行中⇄2已停发;1/2→3已结束) ----------
export function apiCouponList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/coupon/list', params);
}

export function apiCouponDetail(id: number): Promise<Row> {
  return get('/admin/marketing/coupon/detail', { id });
}

/** 优惠券入参:couponType 1满减 2折扣(discountValue<10,如8.50=85折) 3无门槛 */
export type CouponPayload = {
  couponName: string;
  couponType: number;
  discountValue: number;
  minAmount: number;
  maxDiscount: number;
  goodsScope: number;
  goodsIds?: number[];
  totalCount: number;
  perUserLimit: number;
  validType: number;
  validStart?: string;
  validEnd?: string;
  validDays?: number;
  remark?: string;
  siteId?: number;
};

export function apiCouponAdd(data: CouponPayload): Promise<{ id: number }> {
  return post('/admin/marketing/coupon/add', data);
}

/** 编辑:仅未开始可改全部;进行中仅可调整发行总量 totalCount(不得低于已领取) */
export function apiCouponUpdate(data: Partial<CouponPayload> & { id: number }): Promise<null> {
  return post('/admin/marketing/coupon/update', data);
}

/** 发布:0未开始 → 1进行中 */
export function apiCouponPublish(data: { id: number }): Promise<null> {
  return post('/admin/marketing/coupon/publish', data);
}

/** 停发/恢复:1进行中 ⇄ 2已停发(已领取券不受影响) */
export function apiCouponToggleStatus(data: { id: number }): Promise<{ status: number }> {
  return post('/admin/marketing/coupon/toggle-status', data);
}

/** 结束:1/2 → 3已结束(不可逆) */
export function apiCouponFinish(data: { id: number }): Promise<null> {
  return post('/admin/marketing/coupon/finish', data);
}

/** 删除(软删):仅未开始/已结束 */
export function apiCouponDelete(data: { id: number }): Promise<null> {
  return post('/admin/marketing/coupon/delete', data);
}

/** 领券记录:筛选 couponId/userId/status(0未使用 1已使用 2已过期 3已作废) */
export function apiCouponReceives(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/marketing/coupon/receives', params);
}
