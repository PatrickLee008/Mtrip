/**
 * 存储工具:统一封装 AsyncStorage,业务禁止直接引用底层库
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setString(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // 存储失败静默(隐私模式/磁盘满),不阻塞业务
    }
  },

  async getObject<T>(key: string): Promise<T | null> {
    const raw = await this.getString(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setObject(key: string, value: unknown): Promise<void> {
    await this.setString(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // 忽略
    }
  },

  /** 清空缓存(退出登录/GDPR 数据删除) */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch {
      // 忽略
    }
  },
};
