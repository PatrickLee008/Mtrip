/**
 * App 更新与强制更新(Consumer App PRD v1.0.6 19.1)
 *
 * 启动时与每次回到前台调 GET /api/v1/app/site/version-check(公开接口,版本配置在后台
 * 「全局配置 → App Version」按 Android / iOS 分别维护,改完即生效,无需发新包):
 *   forceUpdate  已装版本 < 最低支持版本 → 阻断弹窗,只有「Update」一枚按钮,点遮罩 / 返回键都关不掉;
 *                跳商店后回到前台会重新检查,升级完成前一直挡着。
 *   hasUpdate    已装版本 < 最新版本 → 可选更新弹窗(Update / Later);点 Later 按版本号记住,
 *                同一版本不再打扰,后台再发更高版本才会重新提示。
 *
 * 只在原生端生效(H5 无安装版本概念,直接跳过);检查失败(断网 / 接口异常)静默放行,不拦用户。
 * 已装版本取 expo-constants 的 expoConfig.version(即 app.json 的 expo.version,发版时须同步递增)。
 *
 * 跟进项:Android 的 Google Play「立即更新」(In-App Updates immediate flow)需要原生模块
 * (如 sp-react-native-in-app-updates)并重新 prebuild,当前统一回落为打开 Google Play 应用页。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { fetchVersionCheck, type VersionCheckResult } from '@/api/site';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { colors } from '@/config/theme';
import { useCommonStore } from '@/store/commonStore';
import { openExternal } from '@/utils/openExternal';
import { storage } from '@/utils/storage';

/** 用户对「可选更新」点了 Later 的版本号 */
const DISMISSED_KEY = 'app_update_dismissed_version';

/** Android 商店地址兜底(后台未配置时):app.json 的 android.package */
const ANDROID_PACKAGE = 'com.mtrip.clientapp';

export default function AppUpdateGate() {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const [result, setResult] = useState<VersionCheckResult | null>(null);
  const [optionalVisible, setOptionalVisible] = useState(false);
  const checking = useRef(false);
  /** 本次启动已弹过可选更新的版本号 */
  const promptedVersion = useRef('');

  const check = useCallback(async () => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const version = Constants.expoConfig?.version ?? '';
    if (!version || checking.current) return;
    checking.current = true;
    try {
      const res = await fetchVersionCheck(Platform.OS, version);
      setResult(res);
      if (res.forceUpdate) {
        setOptionalVisible(false);
      } else if (res.hasUpdate) {
        // 可选更新每次启动最多弹一次(去商店没装就回来不再连环弹)
        if (promptedVersion.current === res.latestVersion) return;
        const dismissed = await storage.getString(DISMISSED_KEY);
        if (dismissed !== res.latestVersion) {
          promptedVersion.current = res.latestVersion;
          setOptionalVisible(true);
        }
      } else {
        setOptionalVisible(false);
      }
    } catch {
      // 检查失败静默放行
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!result) return null;

  const openStore = () => {
    let url = result.storeUrl;
    if (!url && Platform.OS === 'android') {
      url = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    }
    const fail = () => showToast(t('appUpdate.openFailed'));
    if (!url) {
      fail();
      return;
    }
    void openExternal(url, fail);
  };

  if (result.forceUpdate) {
    return (
      <ConfirmDialog
        visible
        icon="download"
        iconColor={colors.primary}
        title={t('appUpdate.forceTitle')}
        message={result.notes || t('appUpdate.forceMessage', { version: result.minVersion })}
        confirmLabel={t('appUpdate.update')}
        // 强更不可关闭:遮罩 / Android 返回键都不响应
        onCancel={() => {}}
        onConfirm={openStore}
      />
    );
  }

  const later = () => {
    setOptionalVisible(false);
    void storage.setString(DISMISSED_KEY, result.latestVersion);
  };

  return (
    <ConfirmDialog
      visible={optionalVisible}
      icon="download"
      iconColor={colors.primary}
      title={t('appUpdate.optionalTitle')}
      message={result.notes || t('appUpdate.optionalMessage', { version: result.latestVersion })}
      cancelLabel={t('appUpdate.later')}
      confirmLabel={t('appUpdate.update')}
      onCancel={later}
      onConfirm={() => {
        setOptionalVisible(false);
        openStore();
      }}
    />
  );
}
