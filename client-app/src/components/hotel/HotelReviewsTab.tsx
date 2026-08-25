/**
 * 酒店详情 · Reviews 页签(Figma M-Trip / Hotel Details Reviews 222:3117「Section 7: Reviews Dashboard」)
 *
 * 一张卡(padding 24 / gap 32),自上而下:
 *   总分行  8.8 Inter 700/60 + 右侧 EXCELLENT 主色胶囊 +「Based on 1,240 reviews」Inter 500/14
 *   CTA     Read All Reviews:描边按钮(1px 主色 / 圆角 12 / py13 / Inter 700/16 主色)
 *   维度条  四条,标题 Inter 500/14、分值 Inter 700/14,轨道 #DDE9FF 高 8 圆角 999,进度主色
 *   AI 总结 标题行(mingcute:ai-line 24 + Inter 600/24 主色)+ 两张引述卡:
 *           TOP POSITIVE 主色底 10%、ROOM FOR IMPROVEMENT `--tertiary` #EC1317 底 10%,
 *           引文 Inter 400 **斜体** 16/24 `--text-2`
 *
 * 设计稿维度分是 5 分制(4.9/4.8/4.6/4.7),总分是 10 分制(8.8)—— 两套口径按设计稿原样展示。
 * Read All Reviews 的落地页(`Hotel Details Reviews Page` 1133:2998)不在本次范围,走 comingSoon。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { detailShared } from '@/components/hotel/detailShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { DETAIL_REVIEW_SCORES, DETAIL_REVIEW_SUMMARY } from '@/screens/hotel/detailDemo';

/** 设计稿维度条轨道色 */
const TRACK_COLOR = '#DDE9FF';

interface Props {
  onComingSoon: () => void;
}

export default function HotelReviewsTab({ onComingSoon }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <View style={[detailShared.panel, styles.panel]}>
      {/* 总分 */}
      <View style={styles.summaryRow}>
        <Text style={styles.score}>{DETAIL_REVIEW_SUMMARY.score}</Text>
        <View style={styles.summaryRight}>
          <View style={styles.tier}>
            <Text style={styles.tierText}>{t('hotels.results.excellent')}</Text>
          </View>
          <Text style={styles.basedOn}>
            {t('hotels.detail.reviews.basedOn', {
              reviews: DETAIL_REVIEW_SUMMARY.total.toLocaleString(i18n.language),
            })}
          </Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        onPress={onComingSoon}
      >
        <Text style={styles.ctaText}>{t('hotels.detail.reviews.readAll')}</Text>
      </Pressable>

      {/* 维度条 */}
      <View style={styles.scoreList}>
        {DETAIL_REVIEW_SCORES.map((row) => (
          <View key={row.key} style={styles.scoreItem}>
            <View style={styles.scoreHead}>
              <Text style={styles.scoreLabel}>
                {t(`hotels.detail.reviews.dimensions.${row.key}`)}
              </Text>
              <Text style={styles.scoreValue}>{row.score}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${(row.score / DETAIL_REVIEW_SUMMARY.scoreMax) * 100}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* AI 总结 */}
      <View style={styles.aiBlock}>
        <View style={styles.aiHead}>
          {/* 设计稿图标框 24x24,字形本身只占其中 19.907x21.814(带内缩),按字形原生尺寸给 */}
          <HomeIcon name="aiSparkle" width={19.907} height={21.814} color={colors.primary} />
          <Text style={detailShared.panelTitle}>{t('hotels.detail.reviews.aiSummary')}</Text>
        </View>

        <View style={styles.quoteList}>
          <View style={[styles.quote, styles.quotePositive]}>
            <View style={styles.quoteHead}>
              <HomeIcon name="thumbUp" width={21} height={20} color={colors.primary} />
              <Text style={[styles.quoteTitle, styles.quoteTitlePositive]}>
                {t('hotels.detail.reviews.topPositive')}
              </Text>
            </View>
            <Text style={styles.quoteText}>{t('hotels.detail.reviews.positiveQuote')}</Text>
          </View>

          <View style={[styles.quote, styles.quoteNegative]}>
            <View style={styles.quoteHead}>
              <HomeIcon name="thumbDown" width={21} height={20} color={colors.hot} />
              <Text style={[styles.quoteTitle, styles.quoteTitleNegative]}>
                {t('hotels.detail.reviews.improvement')}
              </Text>
            </View>
            <Text style={styles.quoteText}>{t('hotels.detail.reviews.improvementQuote')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 32 },

  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  score: {
    fontFamily: fonts.interBold,
    fontSize: 60,
    lineHeight: 60,
    color: colors.heading,
  },
  summaryRight: { gap: 4, justifyContent: 'center', flexShrink: 1 },
  tier: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  tierText: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    lineHeight: 15,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  basedOn: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.muted,
  },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
    textAlign: 'center',
  },

  scoreList: { gap: 24 },
  scoreItem: { gap: 8 },
  scoreHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  scoreLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  scoreValue: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  track: { height: 8, borderRadius: 999, backgroundColor: TRACK_COLOR, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.primary },

  aiBlock: { gap: 16 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  quoteList: { gap: 16 },
  quote: { gap: 16, padding: 24, borderRadius: radius.btn },
  quotePositive: { backgroundColor: 'rgba(65, 105, 237, 0.1)' },
  quoteNegative: { backgroundColor: 'rgba(236, 19, 23, 0.1)' },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textTransform: 'uppercase',
  },
  quoteTitlePositive: { color: colors.primary },
  quoteTitleNegative: { color: colors.hot },
  quoteText: {
    fontFamily: fonts.inter,
    /* 设计稿是 Inter Italic;@expo-google-fonts/inter 不含斜体字重,同顶部栏积分那处的处理 */
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },

  pressed: { opacity: 0.85 },
});
