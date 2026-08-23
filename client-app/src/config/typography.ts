/**
 * 排版令牌:字体族与文本预设,取自 Figma M-Trip / Home 81:2464
 * 设计稿只用两套字体 —— Outfit(标题) + Inter(正文/徽章)
 * 说明:RN 用 fontFamily 指定具体字重的字体文件,不再叠加 fontWeight
 */

import type { TextStyle } from 'react-native';

import { colors } from '@/config/theme';

export const fonts = {
  outfit: 'Outfit_400Regular',
  outfitSemi: 'Outfit_600SemiBold',
  inter: 'Inter_400Regular',
  interSemi: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
  /**
   * 顶部栏积分数字。设计稿是 Inter Medium **Italic** 16,
   * 但 @expo-google-fonts/inter 不含斜体字重,只能用 Medium + fontStyle: 'italic'
   * (web 端由浏览器合成斜体,原生端会退化为正体)。
   */
  interMedium: 'Inter_500Medium',
} as const;

/** 文本预设(键名对应设计稿角色,数值为设计稿实测) */
export const text: Record<string, TextStyle> = {
  /** 区块标题 Outfit 600/24 */
  h2: { fontFamily: fonts.outfitSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  /** 卡片名 Outfit 400/20 */
  h4: { fontFamily: fonts.outfit, fontSize: 20, lineHeight: 24, color: colors.heading },
  /** 卡片标题 Outfit 600/16 */
  cardTitle: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 20, color: colors.cardTitle },
  /** Outfit 400/16 —— 卡内说明性标题 */
  subtitle: { fontFamily: fonts.outfit, fontSize: 16, lineHeight: 24, color: colors.heading },
  /** 正文 Inter 400/16 */
  body: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.body },
  /** 次要正文 Inter 400/16 灰 */
  bodyMuted: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },
  /** 元信息 Inter 400/12 */
  meta: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: colors.body },
  /** 强调元信息 Inter 600/12 */
  metaStrong: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.body },
  /** 徽章 Inter 700/10 */
  badge: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15 },
  /** 链接 / 按钮文字 Inter 400/16 */
  link: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.primary },
  /** 强调按钮文字 Inter 600/16 */
  linkStrong: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
};
