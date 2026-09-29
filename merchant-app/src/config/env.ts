/** 环境配置:沿用 client-app 的 EXPO_PUBLIC_* 注入方式,商户端 API 走 /api/v1/merchant 前缀。 */

export type AppEnv = 'development' | 'staging' | 'production';

const RAW_ENV = (process.env.EXPO_PUBLIC_ENV ?? 'development') as AppEnv;

const DEFAULT_BASE_URL: Record<AppEnv, string> = {
  development: 'http://localhost:8081',
  staging: 'https://staging-api.mtrip.com',
  production: 'https://api.mtrip.com',
};

export const ENV: AppEnv = ['development', 'staging', 'production'].includes(RAW_ENV)
  ? RAW_ENV
  : 'development';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL[ENV];

export const DEFAULT_SITE_ID: number = Number(process.env.EXPO_PUBLIC_DEFAULT_SITE_ID ?? 1);

export const CLIENT_ID: string = process.env.EXPO_PUBLIC_CLIENT_ID ?? '';
export const CLIENT_SECRET: string = process.env.EXPO_PUBLIC_CLIENT_SECRET ?? '';

/**
 * 入驻/KYC 静态原型模式(当前阶段:先把静态界面做出来)。
 * 打开时注册 5 步与 KYC 页**不调用后端**,点击即可走完整流程,便于按 Figma 逐屏走查;
 * 需要联调真实入驻 API 时,把 `EXPO_PUBLIC_ONBOARDING_PROTOTYPE` 设为 `false`。
 */
export const ONBOARDING_PROTOTYPE: boolean =
  (process.env.EXPO_PUBLIC_ONBOARDING_PROTOTYPE ?? 'true') !== 'false';

export const MERCHANT_API_PREFIX = '/api/v1/merchant';
