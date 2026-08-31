/**
 * 优惠中心各区块共用的卡壳与标题样式(Figma M-Trip / Promotion 1633:3300)
 *
 * 「活动概览 / 关于本活动 / 条款与条件 / 优惠码 / 券详情」几张卡是同一套壳:
 * `--tab` 底 / 1px `--secondary` 描边 / 圆角 32 / 投影 DS_AG(= shadows.card),
 * 只有 padding(25 或 24)与内部间距不同。标题也只有两种,统一放这里。
 */

import { StyleSheet } from 'react-native';

import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export const promoShared = StyleSheet.create({
  /** 内容卡壳(设计稿 1325:2598 / 1328:2718 / 1328:2725 / 1429:2571) */
  panel: {
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  /** 区块大标题 Inter 600/20(设计稿 Weekly Promotions / Monthly Promotions …) */
  sectionTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 32,
    color: colors.heading,
  },
  /** 卡内小标题 Inter 600/14 大写 tracking 1.4(设计稿 Heading 3) */
  panelTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.heading,
  },
  /** 卡内正文 Inter 400/16 */
  body: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  /** 圆点列表的一项(设计稿 Terms & Conditions 的 Item) */
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  /** 圆点自身:6px 主色圆,顶部留 8 让它对齐首行文字的视觉中线 */
  bulletDot: {
    width: 6,
    height: 6,
    marginTop: 8,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  /** 主色大按钮(设计稿 Button - Search CTA:py16 圆角 12,Outfit 400/16) */
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
