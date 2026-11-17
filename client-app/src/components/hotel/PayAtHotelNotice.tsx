/** Hotel detail notice for properties that offer pay at hotel. */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function PayAtHotelNotice() {
  const { t } = useTranslation();
  return (
    <View style={styles.box}>
      <HomeIcon name="info" size={16} color={colors.primary} />
      <View style={styles.texts}>
        <Text style={styles.title}>{t('hotels.payAtHotel.title')}</Text>
        <Text style={styles.desc}>{t('hotels.payAtHotel.desc')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  texts: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  desc: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
  },
});
