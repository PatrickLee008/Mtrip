import axios, { type AxiosRequestConfig } from 'axios';
import { message } from 'ant-design-vue';
import { getToken, clearAuth } from '@/utils/auth';
import type { ApiResult } from '@/api/types';

/** 业务错误(code!=0),拦截器已弹出提示 */
export class BizError extends Error {
  constructor(
    public code: number,
    msg: string,
  ) {
    super(msg);
  }
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 30000,
});

instance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => {
    const result = response.data as ApiResult;
    if (result.code === 0) {
      return response;
    }
    // 40101 未登录 / 40102 token过期 → 清理并跳登录
    if (result.code === 40101 || result.code === 40102) {
      clearAuth();
      message.warning(result.message || '登录已失效,请重新登录');
      window.location.href = '/login';
    } else if (result.code === 40301 || result.code === 40302) {
      message.error(result.message || '无操作权限');
    } else {
      message.error(result.message || '请求失败');
    }
    return Promise.reject(new BizError(result.code, result.message));
  },
  (error) => {
    if (!(error instanceof BizError)) {
      message.error(error?.message === 'Network Error' ? '网络异常,请稍后重试' : '服务异常,请稍后重试');
    }
    return Promise.reject(error);
  },
);

/** 统一解包:直接返回 data 字段 */
export async function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  const response = await instance.request<ApiResult<T>>(config);
  return response.data.data;
}

export function get<T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'GET', url, params });
}

export function post<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'POST', url, data });
}
