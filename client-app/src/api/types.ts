/**
 * 接口通用类型:统一响应/分页(对齐后端 Result::success/page)
 */

/** 统一响应 {code,message,data,timestamp} */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

/** 分页数据 data={list,total,page,pageSize} */
export interface PageData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页请求参数 */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** 后端错误码(shared ErrorCode 子集,前端需感知的) */
export const API_CODE = {
  SUCCESS: 0,
  PARAM_ERROR: 40001,
  UNAUTHORIZED: 40101,
  TOKEN_EXPIRED: 40102,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  DATA_CONFLICT: 40901,
  /* 促销码兑换(C-M6):后端把「不存在/过期/兑完/重复/资格不符」拆成了独立码,
     App 据此给出不同文案,不能只靠 40401/40901 两个码 */
  PROMO_CODE_NOT_FOUND: 40411,
  PROMO_CODE_EXPIRED: 40911,
  PROMO_CODE_EXHAUSTED: 40912,
  PROMO_CODE_DUPLICATED: 40913,
  PROMO_CODE_INELIGIBLE: 40914,
} as const;
