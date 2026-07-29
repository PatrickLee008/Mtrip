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
} as const;
