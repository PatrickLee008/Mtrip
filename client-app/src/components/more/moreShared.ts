/**
 * 「更多」section(Figma M-Trip / More 1695:5951)各页共用的卡壳与标题样式
 *
 * 与酒店详情的 detailShared / 优惠中心的 promoShared 是同一套设计语言的第三份实例:
 * `--tab` 底 / 1px `--secondary` 描边 / 圆角 32 / padding 24。三者只差投影档位
 * (这里与优惠中心一样是 DS_AG = shadows.card)。等哪天要统一,把三处合并成一个公共卡壳即可。
 */

import { StyleSheet } from 'react-native';

import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 菜单项左侧圆形图标底(设计稿 #ECF5FE,只在这个 section 出现,未进色板) */
export const MENU_ICON_BG = '#ECF5FE';
/** 深一档的主色,用于会员胶囊底与 Top Up 文字(设计稿 #204DDA) */
export const DEEP_PRIMARY = '#204DDA';

export const moreShared = StyleSheet.create({
  /** 内容卡壳(设计稿 Profile Header / Account Group / …) */
  panel: {
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  /** 页面区块标题 Inter 600/20 */
  sectionTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 32,
    color: colors.heading,
  },
  /** 卡内小标题 Inter 600/16 */
  panelTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  /** 正文 Inter 400/16 */
  body: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  /** 次要正文 Inter 400/14 */
  bodyMuted: {
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSoft,
  },

  /** 卡内分隔线(设计稿 Horizontal Divider,`--secondary`) */
  divider: { height: 1, width: '100%', backgroundColor: colors.softBlue },

  /** 主色大按钮(py16 圆角 12,Outfit 400/16) */
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
