import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import type { Svg } from 'react-native-svg';

import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { downloadQrPng } from '@/utils/downloadQrPng';
import { referralLink } from '@/utils/referralInvitation';
import { shareQrPng } from '@/utils/shareQrPng';
import { useConsumerAffiliateAccess } from './useConsumerAffiliateAccess';

export default function AffiliateCenterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AffiliateCenter'>>();
  const access = useConsumerAffiliateAccess();
  const showToast = useCommonStore((state) => state.showToast);
  const [exporting, setExporting] = useState(false);
  const qr = useRef<Svg | null>(null);
  const code = access?.active ? access.referralCode : '';
  const link = code ? referralLink(code, params?.propertyId) : '';
  const qrId = params ? `affiliate-hotel-qr-${params.propertyId}` : 'affiliate-registration-qr';

  useEffect(() => {
    if (access?.active === false && navigation.canGoBack()) navigation.goBack();
  }, [access?.active, navigation]);

  const copyLink = async () => {
    const copied = await Clipboard.setStringAsync(link).catch(() => false);
    showToast(t(copied ? 'more.referral.copied' : 'user.referral.copyFailed'));
  };

  const exportQr = async () => {
    setExporting(true);
    const fileName = params ? `mtrip-hotel-${params.propertyId}.png` : 'mtrip-invitation.png';
    try {
      const exported = Platform.OS === 'web'
        ? await downloadQrPng(qrId, fileName)
        : qr.current !== null && await shareQrPng(qr.current, fileName);
      if (!exported) showToast(t('affiliateAccess.exportFailed'));
    } catch {
      showToast(t('affiliateAccess.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <MorePageLayout title={t('affiliateAccess.title')}>
      {access === undefined ? <ActivityIndicator color={colors.primary} /> : null}
      {access?.active ? (
        <View style={moreShared.panel}>
          <Text>{t('affiliateAccess.id')} {access.affiliateId}</Text>
          <Text>{t(`affiliateAccess.${access.affiliateType}`)}</Text>
          <Text>{t('affiliateAccess.activatedAt')} {access.activatedAt.slice(0, 10)}</Text>
          <Text>{t('affiliateAccess.registeredReferrals')} {access.registeredReferrals}</Text>
          <Text>{t('affiliateAccess.linkOpens')} {access.linkOpens ?? 0}</Text>
        </View>
      ) : null}
      {link ? (
        <View style={[moreShared.panel, styles.invitation]}>
          <Text style={styles.title}>{params?.hotelName ?? t('affiliateAccess.registrationLink')}</Text>
          <Text selectable style={styles.link}>{link}</Text>
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => void copyLink()}>
            <Text style={styles.link}>{t('affiliateAccess.copyLink')}</Text>
          </Pressable>
          <View nativeID={qrId} accessibilityLabel={t('affiliateAccess.qrLabel')}>
            <QRCode value={link} size={220} quietZone={16} getRef={(view) => { qr.current = view; }} />
          </View>
          <Pressable accessibilityRole="button" disabled={exporting} style={styles.action} onPress={() => void exportQr()}>
            <Text style={styles.link}>{t('affiliateAccess.downloadQr')}</Text>
          </Pressable>
        </View>
      ) : null}
      {access?.active && !params ? (
        <Pressable accessibilityRole="button" style={styles.action} onPress={() => navigation.navigate('AffiliatePayoutAccounts')}>
          <Text style={styles.link}>{t('affiliatePayout.title')}</Text>
        </Pressable>
      ) : null}
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  invitation: { gap: 12 },
  title: { color: colors.heading, fontSize: 18, fontWeight: '600' },
  link: { color: colors.primary },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
