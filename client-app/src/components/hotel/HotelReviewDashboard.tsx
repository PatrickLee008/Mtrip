/**
 * 酒店评价 · 评分总览区(Figma M-Trip / `Hotel Details` **222:3117** 与
 * `Hotel Details Reviews Page` **1133:3257** —— 两个节点是同一组设计)
 *
 * 两处宿主共用这一份实现:
 *   · 酒店详情「Reviews」页签(`HotelDetailScreen`),带「Read All Reviews」CTA;
 *   · 住客评价整页(`HotelReviewsScreen`),它自己就是落地页,故不传 `onReadAll`。
 *
 * 设计稿实测(两份节点一致):卡 padding 24 / gap 32 / 圆角 **24** / 底 `--tab` #FEFEFE /
 *   1px `--secondary` #D9E1FB / 投影 Effect/DS(= shadows.subtle),自上而下:
 *   总分行  8.8 Inter 700/60 + 右侧 EXCELLENT 主色胶囊 +「Based on 1,240 reviews」Inter 500/14
 *   CTA     Read All Reviews:描边按钮(1px 主色 / 圆角 12 / py12 / Inter 700/16 主色)
 *   维度条  四条,标题 Inter 500/14、分值 Inter 700/14,轨道 #DDE9FF 高 8 圆角 999,进度主色
 *   AI 总结 标题行(mingcute:ai-line + Inter 600/24 主色)+ 两张引述卡:
 *           TOP POSITIVE 主色底 10%、ROOM FOR IMPROVEMENT `--tertiary` #EC1317 底 10%,
 *           引文 Inter 400 **斜体** 16/24 `--text-2`
 *
 * **圆角 24 而不是 `detailShared.panel` 的 32**:两个 Figma 节点都写 borderRadius=24,
 * 而 `detailShared.panel` 是 32(其余五个页签沿用,本次不动)。这里自带卡壳,只借用
 * detailShared 的排版样式(panelTitle / panelHeadRow / body),不借用卡壳。
 *
 * **数据口径**:总分行与「Based on N reviews」接真实值(见 `HotelReviewsScreen`)——
 * 后端 `rating` 是 1-5 分制,调用方按 ×2 换算成设计稿的 10 分制后传进来。
 * 维度条与 AI Summary **没有后端字段**(`goods_review` 只有单一 rating),
 * 故按设计稿文案静态展示 —— 这是与用户确认过的取舍。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { detailShared } from '@/components/hotel/detailShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { DETAIL_REVIEW_SCORES, DETAIL_REVIEW_SUMMARY } from '@/screens/hotel/detailDemo';

/** 设计稿维度条轨道色 */
const TRACK_COLOR = '#DDE9FF';
/** 稿面卡圆角(两个节点都是 24,不是 detailShared 的 32) */
const CARD_RADIUS = 24;

/**
 * EXCELLENT 档位阈值(10 分制)。
 *
 * ⚠ **推定值**:设计稿只给了「8.8 → EXCELLENT」一个样本,没有给分档表,这里按 8.0 推定。
 * 注意它与搜索结果页 `HotelResultCard` 的 `EXCELLENT_FROM = 4.5` **不是同一把尺子** ——
 * 那边量的是 5 分制 rating,两者相差一档(4.5×2 = 9.0);若要统一,以后端补一份分档口径为准。
 */
const EXCELLENT_FROM_SCORE = 8;

interface Props {
  /** 10 分制总分(`rating × 2`);拿不到真实值时传 0,档位胶囊随之不渲染 */
  score: number;
  /** 评价条数 */
  total: number;
  /**
   * 给了才画「Read All Reviews」。整页自己就是落地页,传了会点回自己,故不传。
   */
  onReadAll?: () => void;
}

export default function HotelReviewDashboard({ score, total, onReadAll }: Props) {
  const { t, i18n } = useTranslation();
  /** 低于阈值不画胶囊 —— 宁可少一个标签,也不要给低分物业贴 EXCELLENT */
  const showTier = score >= EXCELLENT_FROM_SCORE;

  return (
    <View style={styles.card}>
      {/* 总分 */}
      <View style={styles.summaryRow}>
        <Text style={styles.score}>{score.toFixed(1)}</Text>
        <View style={styles.summaryRight}>
          {showTier ? (
            <View style={styles.tier}>
              <Text style={styles.tierText}>{t('hotels.results.excellent')}</Text>
            </View>
          ) : null}
          <Text style={styles.basedOn}>
            {t('hotels.detail.reviews.basedOn', {
              reviews: total.toLocaleString(i18n.language),
            })}
          </Text>
        </View>
      </View>

      {/* CTA(只有 Reviews 页签有) */}
      {onReadAll ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={onReadAll}
        >
          <Text style={styles.ctaText}>{t('hotels.detail.reviews.readAll')}</Text>
        </Pressable>
      ) : null}

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
        <View style={detailShared.panelHeadRow}>
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
  /** 稿面卡壳:padding 24 / 圆角 24 / 1px #D9E1FB / #FEFEFE / Effect/DS,gap 32 */
  card: {
    padding: 24,
    gap: 32,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },

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

  /** 稿面 Button 222:3701:padding 12px 0 / 1px 主色 / 圆角 12 */
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
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
