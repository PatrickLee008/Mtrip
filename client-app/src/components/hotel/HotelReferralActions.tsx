import React from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import ReferralDownload from '@/components/user/ReferralDownload';
import { colors } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useConsumerAffiliateAccess } from '@/screens/more/useConsumerAffiliateAccess';
import { useUserStore } from '@/store/userStore';

export default function HotelReferralActions({
  propertyId, hotelName, invitationCode,
}: { propertyId: number; hotelName?: string; invitationCode?: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const authenticated = useUserStore((state) => state.isLogin);
  const access = useConsumerAffiliateAccess();
  if (!authenticated && invitationCode) {
    return (
      <>
        {Platform.OS === 'web' ? <ReferralDownload code={invitationCode} propertyId={propertyId} autoRedirect={false} /> : null}
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Register', {
          referralCode: invitationCode, referralPropertyId: propertyId,
        })}>
          <Text style={{ color: colors.primary }}>{t('affiliateAccess.registerWithInvitation')}</Text>
        </Pressable>
      </>
    );
  }
  if (!access?.active || !hotelName) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('AffiliateCenter', { propertyId, hotelName })}>
      <Text style={{ color: colors.primary }}>{t('affiliateAccess.shareHotel')}</Text>
    </Pressable>
  );
}
