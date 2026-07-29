/**
 * GDPR 合规工具:隐私授权判断/记录(设计方案第九章)
 */

import { STORAGE_KEYS } from '@/config/global';
import { storage } from '@/utils/storage';

export interface GdprConsent {
  /** 是否同意隐私政策(必选,拒绝则不可注册/登录) */
  accepted: boolean;
  /** 同意时间 ISO 字符串 */
  acceptedAt: string;
}

export async function getGdprConsent(): Promise<GdprConsent | null> {
  return storage.getObject<GdprConsent>(STORAGE_KEYS.GDPR);
}

export async function setGdprConsent(accepted: boolean): Promise<void> {
  await storage.setObject(STORAGE_KEYS.GDPR, {
    accepted,
    acceptedAt: new Date().toISOString(),
  } satisfies GdprConsent);
}

/** 撤回授权(GDPR 被遗忘权入口,同时清空本地数据由调用方处理) */
export async function revokeGdprConsent(): Promise<void> {
  await storage.remove(STORAGE_KEYS.GDPR);
}
