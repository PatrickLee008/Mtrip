import { get, post } from '@/utils/http';
import type { PageData } from '@/api/types';

/** 商品管理接口(goods-service /api/v1/admin/goods/*) */
type Row = Record<string, any>;

// ---------- 商品主表(状态机 0草稿→1待审核→3已上架/2驳回,3⇄4,5软删) ----------
export function apiGoodsList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/list', params);
}

export function apiGoodsDetail(id: number): Promise<{ goods: Row; skus: Row[]; refundRules: Row[] }> {
  return get('/admin/goods/detail', { id });
}

export function apiGoodsAdd(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/add', data);
}

export function apiGoodsUpdate(data: Record<string, unknown>): Promise<null> {
  return post('/admin/goods/update', data);
}

/** 提交审核:0草稿/2驳回 → 1待审核,须至少一个在售 SKU */
export function apiGoodsSubmit(id: number): Promise<null> {
  return post('/admin/goods/submit', { id });
}

/** auditStatus 1通过(直接上架) 2驳回(必填 auditRemark) */
export function apiGoodsAudit(data: { id: number; auditStatus: number; auditRemark?: string }): Promise<null> {
  return post('/admin/goods/audit', data);
}

export function apiGoodsToggleStatus(id: number): Promise<{ status: number }> {
  return post('/admin/goods/toggle-status', { id });
}

export function apiGoodsDelete(id: number): Promise<null> {
  return post('/admin/goods/delete', { id });
}

// ---------- 商品分类(两级树) ----------
export function apiCategoryList(params?: Record<string, unknown>): Promise<Row[]> {
  return get('/admin/goods/category/list', params);
}

/** 带 id 编辑,不带 id 新增 */
export function apiCategorySave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/category/save', data);
}

export function apiCategoryDelete(id: number): Promise<null> {
  return post('/admin/goods/category/delete', { id });
}

// ---------- 酒店房型 ----------
export function apiRoomList(goodsId: number): Promise<Row[]> {
  return get('/admin/goods/room/list', { goodsId });
}

export function apiRoomSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/room/save', data);
}

export function apiRoomDelete(goodsId: number, id: number): Promise<null> {
  return post('/admin/goods/room/delete', { goodsId, id });
}

export function apiRoomReviewList(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/room-review/list', params);
}

export function apiRoomReviewDetail(id: number): Promise<{ revision: Row; effective: Row; history: Row[] }> {
  return get('/admin/goods/room-review/detail', { id });
}

export function apiRoomReviewAudit(data: { id: number; auditStatus: number; auditRemark?: string }): Promise<null> {
  return post('/admin/goods/room-review/audit', data);
}

// ---------- 门票票种 ----------
export function apiTicketList(goodsId: number): Promise<Row[]> {
  return get('/admin/goods/ticket/list', { goodsId });
}

export function apiTicketSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/ticket/save', data);
}

export function apiTicketDelete(goodsId: number, id: number): Promise<null> {
  return post('/admin/goods/ticket/delete', { goodsId, id });
}

// ---------- 退改规则(goods+sku 维度唯一,存在则覆盖) ----------
export function apiRefundRuleList(goodsId: number): Promise<Row[]> {
  return get('/admin/goods/refund-rule/list', { goodsId });
}

export function apiRefundRuleSave(data: Record<string, unknown>): Promise<{ id: number }> {
  return post('/admin/goods/refund-rule/save', data);
}

// ---------- 价格库存日历 ----------
export interface StockDay {
  date: string;
  price: number;
  stockTotal: number;
  stockSold: number;
  stockLocked: number;
  stockLeft: number;
  isClosed: number;
  hasRecord: number;
}

export function apiStockCalendar(params: {
  goodsId: number;
  skuType: number;
  skuId: number;
  startDate: string;
  endDate: string;
}): Promise<{ goodsId: number; skuType: number; skuId: number; basePrice: number; baseStock: number; days: StockDay[] }> {
  return get('/admin/goods/stock/calendar', params);
}

/** 区间批量设置 price/stockTotal/isClosed 至少一项;weekdays 0-6 可选过滤 */
export function apiStockBatchSet(data: Record<string, unknown>): Promise<{ affectedDays: number }> {
  return post('/admin/goods/stock/batch-set', data);
}

/** 单日调整:changeQty 正增负减,下限=已售+锁定 */
export function apiStockAdjust(data: Record<string, unknown>): Promise<{ stockLeft: number }> {
  return post('/admin/goods/stock/adjust', data);
}

export function apiStockLogs(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/stock/logs', params);
}

export function apiStockLowWarning(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/stock/low-warning', params);
}

export function apiStockOverview(params: Record<string, unknown>): Promise<PageData<Row>> {
  return get<PageData<Row>>('/admin/goods/stock/overview', params);
}
