import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { useConsumerAffiliateAccess } from './useConsumerAffiliateAccess';

export default function AffiliateCenterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const access = useConsumerAffiliateAccess();

  useEffect(() => {
    if (access?.active === false && navigation.canGoBack()) navigation.goBack();
  }, [access?.active, navigation]);

  return (
    <MorePageLayout title={t('affiliateAccess.title')}>
      {access === undefined ? <ActivityIndicator color={colors.primary} /> : null}
      {access?.active ? (
        <View style={moreShared.panel}>
          <Text>{t('affiliateAccess.id')} {access.affiliateId}</Text>
          <Text>{t(`affiliateAccess.${access.affiliateType}`)}</Text>
          <Text>{t('affiliateAccess.activatedAt')} {access.activatedAt.slice(0, 10)}</Text>
          <Text>{t('affiliateAccess.registeredReferrals')} {access.registeredReferrals}</Text>
        </View>
      ) : null}
    </MorePageLayout>
  );
}
