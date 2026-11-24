import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fetchVersionCheck } from '@/api/site';
import { colors } from '@/config/theme';
import { referralPlayStoreUrl } from '@/utils/referralInvitation';

export default function ReferralDownload({ code }: { code: string }) {
  const { t } = useTranslation();
  const [iosStore, setIosStore] = useState('');
  const userAgent = Platform.OS === 'web' ? window.navigator.userAgent : '';
  const android = /Android/i.test(userAgent);
  const ios = /iPhone|iPad|iPod/i.test(userAgent)
    || (Platform.OS === 'web' && /Macintosh/i.test(userAgent) && window.navigator.maxTouchPoints > 1);

  useEffect(() => {
    if (!ios) return;
    let active = true;
    void fetchVersionCheck('ios', '0.0.0').then(({ storeUrl }) => {
      if (!active) return;
      const url = new URL(storeUrl);
      if (url.origin === 'https://apps.apple.com' && /\/id\d+\/?$/.test(url.pathname)) {
        setIosStore(url.toString());
      }
    }).catch(() => { /* Web registration is available when a store is unconfigured. */ });
    return () => { active = false; };
  }, [ios]);

  const url = android ? referralPlayStoreUrl(code) : iosStore;
  useEffect(() => {
    if (!url) return;
    try {
      const key = `referral_store_opened:${code}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
      window.location.assign(url);
    } catch {
      // A manual link is still available when the browser restricts automatic navigation.
    }
  }, [code, url]);

  if (!android && !ios) return null;
  return (
    <View style={{ padding: 12, gap: 8, backgroundColor: colors.softBlue }}>
      <Text selectable style={{ color: colors.text }}>{t('user.referral.invitationCode', { code })}</Text>
      {url ? (
        <Pressable accessibilityRole="link" onPress={() => window.location.assign(url)}>
          <Text style={{ color: colors.primary }}>{t('user.referral.downloadApp')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
