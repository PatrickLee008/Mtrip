/**
 * Axios 请求单例(设计方案第七章):
 * - 自动携带 Authorization / X-Site-Id / X-Client-Type / X-Timestamp / X-Lang
 * - 统一解析 {code,message,data}:0 成功返回 data;40101/40102 清登录态并跳登录;其余抛错并 Toast
 */

import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

import { API_CODE, type ApiResponse } from '@/api/types';
import { API_BASE_URL } from '@/config/env';
import { REQUEST_TIMEOUT } from '@/config/global';
import { logger } from '@/logs/logger';
import { getClientType } from '@/utils/device';

/** 业务错误(code 非 0),页面可按 code 精细处理 */
export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 由 store/导航注入的钩子(避免循环依赖) */
interface RequestHooks {
  getToken: () => string;
  getSiteId: () => number;
  getLang: () => string;
  onUnauthorized: () => void;
  onToast: (message: string) => void;
}

let hooks: RequestHooks = {
  getToken: () => '',
  getSiteId: () => 0,
  getLang: () => 'en-US',
  onUnauthorized: () => undefined,
  onToast: () => undefined,
};

export function setRequestHooks(next: Partial<RequestHooks>): void {
  hooks = { ...hooks, ...next };
}

const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
});

instance.interceptors.request.use((config) => {
  const token = hooks.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const siteId = hooks.getSiteId();
  if (siteId > 0) {
    config.headers['X-Site-Id'] = String(siteId);
  }
  config.headers['X-Client-Type'] = getClientType();
  config.headers['X-Timestamp'] = String(Date.now());
  config.headers['X-Lang'] = hooks.getLang();
  return config;
});

/**
 * 统一请求入口:成功返回业务 data,失败抛 ApiError(已 Toast)
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await instance.request<ApiResponse<T>>(config);
    const body = response.data;
    if (body.code === API_CODE.SUCCESS) {
      return body.data;
    }
    if (body.code === API_CODE.UNAUTHORIZED || body.code === API_CODE.TOKEN_EXPIRED) {
      hooks.onUnauthorized();
    }
    logger.warn('api', config.url, body.code, body.message);
    hooks.onToast(body.message);
    throw new ApiError(body.code, body.message);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const axiosError = error as AxiosError;
    const message = axiosError.message ?? 'Network Error';
    logger.error('api', config.url, message);
    hooks.onToast(message);
    throw new ApiError(-1, message);
  }
}

export function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'GET', url, params });
}

export function post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'POST', url, data });
}
