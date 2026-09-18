/**
 * 关怀模式「AI Summary」评价总结块(Figma `2540:7491` 信息页尾 / `2540:18286` 评价页)
 *
 * 信息页(`HotelInfoLiteScreen`)与评价页(`HotelReviewsLiteScreen`)两张稿上都有这一块,
 * 结构一字不差,所以抽成一个组件两处共用。
 *
 * **内容与完整模式同源**:完整版 `components/hotel/HotelReviewsTab.tsx` 里已有同一块,
 * 文案共用 `hotels.detail.reviews.*` 那五个键(aiSummary / topPositive / positiveQuote /
 * improvement / improvementQuote),**不另造一套 Lite 词条** —— 否则两种模式会给出不同的总结。
 *
 * 版式按关怀模式的既有换算规则在完整版基础上放大一档(与 `liteShared.ts` 头部同一口径):
 *   标题   Inter 600/16 → 24/32(主色)
 *   小标   Inter 600/14 大写 → 20/28
 *   引言   Inter Italic 16/24 → 20/28
 *
 * ⚠️ **这一块目前是写死的设计稿文案**:后端没有评价接口,更没有 AI 总结接口(完整模式同此状态)。
 * 接通后把两段引言换成接口字段即可,版式不用动。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function LiteAiSummary() {
  const { t } = useTranslation();

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        {/* 设计稿图标框 24x24,字形本身带内缩,按字形原生比例放大一档 */}
        <HomeIcon name="aiSparkle" width={23.888} height={26.177} color={colors.primary} />
        <Text style={styles.title}>{t('hotels.detail.reviews.aiSummary')}</Text>
      </View>

      <View style={styles.list}>
        <View style={[styles.quote, styles.quotePositive]}>
          <View style={styles.quoteHead}>
            <HomeIcon name="thumbUp" width={25} height={24} color={colors.primary} />
            <Text style={[styles.quoteTitle, styles.quoteTitlePositive]}>
              {t('hotels.detail.reviews.topPositive')}
            </Text>
          </View>
          <Text style={styles.quoteText}>{t('hotels.detail.reviews.positiveQuote')}</Text>
        </View>

        <View style={[styles.quote, styles.quoteNegative]}>
          <View style={styles.quoteHead}>
            <HomeIcon name="thumbDown" width={25} height={24} color={colors.hot} />
            <Text style={[styles.quoteTitle, styles.quoteTitleNegative]}>
              {t('hotels.detail.reviews.improvement')}
            </Text>
          </View>
          <Text style={styles.quoteText}>{t('hotels.detail.reviews.improvementQuote')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%', gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /* 设计稿这处标题是主色(与区块标题的深色不同) */
  title: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.primary },

  list: { gap: 16 },
  quote: { gap: 16, padding: 24, borderRadius: radius.btn },
  quotePositive: { backgroundColor: 'rgba(65, 105, 237, 0.1)' },
  quoteNegative: { backgroundColor: 'rgba(236, 19, 23, 0.1)' },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0.14,
    textTransform: 'uppercase',
  },
  quoteTitlePositive: { color: colors.primary },
  quoteTitleNegative: { color: colors.hot },
  quoteText: {
    fontFamily: fonts.inter,
    /* 设计稿是 Inter Italic;@expo-google-fonts/inter 不含斜体字重,同完整版的处理 */
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 28,
    color: colors.textSoft,
  },
});
