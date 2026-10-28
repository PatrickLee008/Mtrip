import axios, { type AxiosRequestConfig } from 'axios';
import { message } from 'ant-design-vue';
import { getToken } from '@/utils/auth';
import { ensureSession, expireSession, isProtectedRequest, sessionState } from '@/utils/session';
import type { ApiResult } from '@/api/types';
import { getSelectedPropertyId } from '@/utils/propertyContext';

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

instance.interceptors.request.use(async (config) => {
  if (isProtectedRequest(config.url)) await ensureSession();
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const propertyId = getSelectedPropertyId();
  if (propertyId !== null && !config.headers.has('X-Mtrip-Property-Id')) {
    config.headers.set('X-Mtrip-Property-Id', String(propertyId));
  }
  return config;
});

/** 统一业务错码处理(2xx 与非 2xx 响应共用) */
function handleBizResult(result: ApiResult): void {
  if (result.code === 40101 || result.code === 40102) {
    expireSession();
  } else if (result.code === 40301 || result.code === 40302) {
    message.error(result.message || '无操作权限');
  } else {
    message.error(result.message || '请求失败');
  }
}

type RetryConfig = AxiosRequestConfig & { sessionRetried?: boolean };

async function readResult(data: unknown): Promise<ApiResult | undefined> {
  if (data instanceof Blob) {
    if (!data.type.includes('json')) return undefined;
    try { return JSON.parse(await data.text()); } catch { return undefined; }
  }
  return data && typeof data === 'object' && 'code' in data ? data as ApiResult : undefined;
}

async function failedResult(result: ApiResult, config: RetryConfig) {
  const protectedRequest = isProtectedRequest(config.url);
  if (result.code === 40102 && protectedRequest && !config.sessionRetried) {
    const sent = String((config.headers as Record<string, unknown> | undefined)?.Authorization ?? '').replace(/^Bearer /, '');
    if (getToken() === sent) await ensureSession(true);
    return instance.request({ ...config, sessionRetried: true } as RetryConfig);
  }
  if ((result.code === 40101 || result.code === 40102) && !protectedRequest) {
    message.warning(result.message);
  } else {
    handleBizResult(result);
  }
  throw new BizError(result.code, result.message);
}

instance.interceptors.response.use(
  async (response) => {
    const result = await readResult(response.data);
    if (!result || result.code === 0) return response;
    return failedResult(result, response.config);
  },
  async (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const result = await readResult(error?.response?.data);
    if (result && typeof result.code === 'number' && result.code !== 0) {
      return failedResult(result, error.config ?? {});
    }
    if (!(error instanceof BizError) && !sessionState.expired) {
      message.error(error?.message === 'Network Error' ? '网络异常,请稍后重试' : '服务异常,请稍后重试');
    }
    return Promise.reject(error);
  },
);

export function requestBlob(config: AxiosRequestConfig) {
  return instance.request<Blob>({ ...config, responseType: 'blob' });
}

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
