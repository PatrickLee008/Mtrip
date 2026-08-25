/**
 * 酒店详情 · Overview 页签(Figma M-Trip / Hotel Details Overview 94:438 的 Left Content Column)
 *
 * 自上而下:
 *   三宫格 222:1421          `--tab` 底 / `--secondary` 描边 / 圆角 20 / padding 16,图标 20 + 数值 + 副标题
 *   Hotel Location 361:1427  圆角 32 / padding 25 / gap 16,标题行右侧 See Map
 *   Highlight 1671:2058      同一张卡壳
 *   Why Guests Choose 94:528 三条,左侧 4px 主色竖条 + 40x40 图标(`--secondary` 色)
 *   设施标签 222:1355        两行两列,`--tab` 底 / 圆角 32 / 高 36
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  DETAIL_AMENITIES,
  DETAIL_DEMO,
  DETAIL_REASONS,
  DETAIL_STATS,
} from '@/screens/hotel/detailDemo';

interface Props {
  onComingSoon: () => void;
}

export default function HotelOverviewTab({ onComingSoon }: Props) {
  const { t } = useTranslation();

  /** 三宫格的主数值:星级/评分/已订(副标题各自另有词条) */
  const statValue: Record<(typeof DETAIL_STATS)[number]['key'], string> = {
    /* 插值键避开 i18next 保留字 count(会触发复数查找),同 hotels.results.* 的约定 */
    star: t('hotels.detail.stats.starValue', { stars: DETAIL_DEMO.starLevel }),
    score: String(DETAIL_DEMO.score),
    booked: String(DETAIL_DEMO.booked),
  };

  return (
    <View style={styles.root}>
      {/* 三宫格 */}
      <View style={styles.statRow}>
        {DETAIL_STATS.map((stat) => (
          <View key={stat.key} style={styles.statCard}>
            <HomeIcon name={stat.icon} size={20} color={colors.primary} />
            <Text style={styles.statValue}>{statValue[stat.key]}</Text>
            <Text style={styles.statLabel}>{t(`hotels.detail.stats.${stat.key}Label`)}</Text>
          </View>
        ))}
      </View>

      {/* Hotel Location */}
      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <View style={styles.panelHeadLeft}>
            <HomeIcon name="map" size={20} color={colors.primary} />
            <Text style={styles.panelTitle}>{t('hotels.detail.location.title')}</Text>
          </View>
          <Pressable onPress={onComingSoon} hitSlop={8}>
            {({ pressed }) => (
              <Text style={[styles.panelLink, pressed && styles.pressed]}>
                {t('hotels.detail.location.seeMap')}
              </Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.panelBody}>{t('hotels.detail.location.address')}</Text>
      </View>

      {/* Highlight */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t('hotels.detail.highlight.title')}</Text>
        <Text style={styles.panelBody}>{t('hotels.detail.highlight.body')}</Text>
      </View>

      {/* Why Guests Choose */}
      <View style={styles.reasonList}>
        {DETAIL_REASONS.map((reason) => (
          <View key={reason.key} style={styles.reasonCard}>
            <HomeIcon name={reason.icon} size={40} color={colors.softBlue} />
            <View>
              <Text style={styles.reasonTitle}>
                {t(`hotels.detail.reasons.${reason.key}.title`)}
              </Text>
              <Text style={styles.reasonDesc}>{t(`hotels.detail.reasons.${reason.key}.desc`)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 设施标签:两行两列 */}
      <View style={styles.amenityGrid}>
        {[DETAIL_AMENITIES.slice(0, 2), DETAIL_AMENITIES.slice(2)].map((row, i) => (
          <View key={i} style={styles.amenityRow}>
            {row.map((item) => (
              <View key={item.key} style={styles.amenityChip}>
                <HomeIcon
                  name={item.icon}
                  width={item.width}
                  height={item.height}
                  color={colors.primary}
                />
                <Text style={styles.amenityText}>{t(`hotels.detail.amenities.${item.key}`)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },

  statRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  statValue: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
    textAlign: 'center',
  },
  statLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.textSoft,
    textAlign: 'center',
  },

  panel: {
    gap: 16,
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  panelTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  panelLink: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  panelBody: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },

  reasonList: { gap: 16 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 24,
    paddingRight: 20,
    paddingVertical: 20,
    borderRadius: radius.card,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  reasonTitle: {
    fontFamily: fonts.outfitSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
  },
  reasonDesc: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  amenityGrid: { gap: 8 },
  amenityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amenityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  amenityText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  pressed: { opacity: 0.85 },
});
