/**
 * 环境配置(设计方案第五章:三环境切换)
 * 通过 EXPO_PUBLIC_ENV / EXPO_PUBLIC_API_BASE_URL 注入,严禁硬编码环境地址
 */

export type AppEnv = 'development' | 'staging' | 'production';

const RAW_ENV = (process.env.EXPO_PUBLIC_ENV ?? 'development') as AppEnv;

/** 各环境默认网关地址(.env 未配置时兜底) */
const DEFAULT_BASE_URL: Record<AppEnv, string> = {
  development: 'http://localhost:8081',
  staging: 'https://staging-api.mtrip.com',
  production: 'https://api.mtrip.com',
};

export const ENV: AppEnv = ['development', 'staging', 'production'].includes(RAW_ENV)
  ? RAW_ENV
  : 'development';

export const IS_DEV = ENV === 'development';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL[ENV];

export const DEFAULT_SITE_ID: number = Number(process.env.EXPO_PUBLIC_DEFAULT_SITE_ID ?? 1);
