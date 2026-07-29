/**
 * 全局日志(设计方案第八章):
 * 开发环境全量打印;生产仅保留 warn/error 供上报;自动携带站点/设备/用户/时间
 * 日志禁止手动删除,上报归档由后端 api_log 体系承接
 */

import { IS_DEV } from '@/config/env';
import { getClientType } from '@/utils/device';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 由 store 注入的上下文提供者(避免循环依赖) */
let contextProvider: () => { siteId: number; userId: number } = () => ({ siteId: 0, userId: 0 });

export function setLogContextProvider(provider: () => { siteId: number; userId: number }): void {
  contextProvider = provider;
}

function emit(level: LogLevel, tag: string, ...args: unknown[]): void {
  if (!IS_DEV && (level === 'debug' || level === 'info')) return;
  const { siteId, userId } = contextProvider();
  const prefix = `[${new Date().toISOString()}][${level}][${tag}][site:${siteId}][uid:${userId}][${getClientType()}]`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](prefix, ...args);
}

export const logger = {
  debug: (tag: string, ...args: unknown[]) => emit('debug', tag, ...args),
  info: (tag: string, ...args: unknown[]) => emit('info', tag, ...args),
  warn: (tag: string, ...args: unknown[]) => emit('warn', tag, ...args),
  error: (tag: string, ...args: unknown[]) => emit('error', tag, ...args),
};
