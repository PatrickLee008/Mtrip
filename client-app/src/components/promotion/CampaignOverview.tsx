/**
 * 活动概览卡(设计稿 1325:2598 Campaign Overview Section)
 *
 * 设计稿:卡壳 padding 25(比其余几张卡多 1)、gap 20;
 * 上半是活动名 Inter 700/20 + 说明 Inter 400/16,中间一条 `--secondary` 分隔线,
 * 下半是 40 见方的 `--secondary` 圆角底板(内含 20 的日历图标)+ 期间标签/日期两行。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { promoShared } from '@/components/promotion/promoShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function CampaignOverview() {
  const { t } = useTranslation();
  return (
    <View style={[promoShared.panel, styles.panel]}>
      <View style={styles.head}>
        <Text style={styles.name}>{t('promotions.campaign.name')}</Text>
        <Text style={styles.desc}>{t('promotions.campaign.desc')}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.periodRow}>
        <View style={styles.iconBox}>
          <HomeIcon name="calendar2" size={20} color={colors.primary} />
        </View>
        <View style={styles.periodText}>
          <Text style={styles.periodLabel}>{t('promotions.campaign.periodLabel')}</Text>
          <Text style={styles.period}>{t('promotions.campaign.period')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 25, gap: 20 },
  head: { gap: 4 },
  name: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },

  divider: { height: 1, backgroundColor: colors.softBlue },

  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  periodText: { flex: 1, minWidth: 0 },
  periodLabel: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.heading,
  },
  period: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },
});
