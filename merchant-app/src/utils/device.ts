/**
 * 设备工具:多端判断 / 客户端类型(X-Client-Type 请求头,后端映射注册来源)
 */

import { Platform } from 'react-native';

export function isH5(): boolean {
  return Platform.OS === 'web';
}

export function isApp(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** 请求头 X-Client-Type:app-ios / app-android / app-h5 */
export function getClientType(): 'app-ios' | 'app-android' | 'app-h5' {
  if (Platform.OS === 'ios') return 'app-ios';
  if (Platform.OS === 'android') return 'app-android';
  return 'app-h5';
}

export function getOsVersion(): string {
  return `${Platform.OS} ${Platform.Version ?? ''}`.trim();
}
