/** Axios 单例:统一解包 {code,message,data},自动携带商户 JWT 与端类型/语言头。 */

import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

import { API_CODE, type ApiResponse } from '@/api/types';
import { API_BASE_URL, CLIENT_ID, CLIENT_SECRET, MERCHANT_API_PREFIX } from '@/config/env';
import { REQUEST_TIMEOUT } from '@/config/global';
import { logger } from '@/logs/logger';
import { getClientType } from '@/utils/device';
import { encryptPayload, genNonce, signRequest } from '@/utils/sign';

export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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

const instance = axios.create({ baseURL: API_BASE_URL, timeout: REQUEST_TIMEOUT });

instance.interceptors.request.use((config) => {
  const token = hooks.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const siteId = hooks.getSiteId();
  if (siteId > 0) config.headers['X-Site-Id'] = String(siteId);

  const timestamp = String(Math.floor(Date.now() / 1000));
  config.headers['X-Client-Type'] = getClientType();
  config.headers['X-Timestamp'] = timestamp;
  config.headers['X-Lang'] = hooks.getLang();

  const path = (config.url ?? '').split('?')[0];
  if (CLIENT_ID && CLIENT_SECRET && path.startsWith(MERCHANT_API_PREFIX)) {
    const nonce = genNonce();
    const method = (config.method ?? 'get').toUpperCase();
    config.headers['X-Client-Id'] = CLIENT_ID;
    config.headers['X-Nonce'] = nonce;
    config.headers['X-Sign'] = signRequest(CLIENT_ID, method, path, timestamp, nonce, CLIENT_SECRET);
  }
  return config;
});

function fullPath(path: string): string {
  return path.startsWith('/api/') ? path : `${MERCHANT_API_PREFIX}${path}`;
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const finalConfig = { ...config, url: fullPath(config.url ?? '') };
  try {
    const response = await instance.request<ApiResponse<T>>(finalConfig);
    const body = response.data;
    if (body.code === API_CODE.SUCCESS) return body.data;
    if (body.code === API_CODE.UNAUTHORIZED || body.code === API_CODE.TOKEN_EXPIRED) {
      hooks.onUnauthorized();
    }
    logger.warn('api', finalConfig.url, body.code, body.message);
    hooks.onToast(body.message);
    throw new ApiError(body.code, body.message);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const result = (error as AxiosError<ApiResponse>)?.response?.data;
    if (result && typeof result.code === 'number') {
      if (result.code === API_CODE.UNAUTHORIZED || result.code === API_CODE.TOKEN_EXPIRED) hooks.onUnauthorized();
      hooks.onToast(result.message);
      throw new ApiError(result.code, result.message);
    }
    const message = (error as AxiosError).message || 'Network Error';
    logger.error('api', finalConfig.url, message);
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

export function postEncrypted<T>(url: string, data?: Record<string, unknown>): Promise<T> {
  if (!CLIENT_SECRET) return post<T>(url, data);
  return request<T>({
    method: 'POST',
    url,
    data: { payload: encryptPayload(data ?? {}, CLIENT_SECRET) },
    headers: { 'X-Encrypted': '1' },
  });
}
