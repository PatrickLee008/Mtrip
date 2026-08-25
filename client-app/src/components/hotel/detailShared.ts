/**
 * 酒店详情各页签共用的卡壳与标题样式(Figma M-Trip / Hotel Details 759:9776)
 *
 * 六张稿的内容块反复用同一套壳:`--tab` 底 / 1px `--secondary` 描边 / 圆角 32 / padding 24 /
 * 投影 Effect/DS(= shadows.subtle)。标题也只有两三种字号,统一放这里,避免五个页签各抄一遍。
 */

import { StyleSheet } from 'react-native';

import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export const detailShared = StyleSheet.create({
  /** 内容卡壳(设计稿 222:2705 / 222:3117 / 1695:6754 …) */
  panel: {
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  /** 纯白卡壳、无描边(设计稿入住/退房两张卡 222:3533 / 222:3556) */
  panelPlain: {
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },

  /** 页签内的区块大标题 Outfit 600/24(设计稿 Room Explorer / Nearby Location) */
  sectionTitle: {
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 24,
    color: colors.heading,
  },
  /** 卡内主标题 Inter 600/24(设计稿 Amenities / Booking Policies / Check-in …) */
  panelTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },
  /** 卡内主标题的深色变体(设计稿 Amenities / Pet Policy) */
  panelTitleDark: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  /** 卡内标题行:图标 + 标题 */
  panelHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  /** 卡内正文 Inter 400/16 次要色 */
  body: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },
});

/** 设计稿反复出现的分隔线色(`--divider` 叠 30% 透明度) */
export const DETAIL_DIVIDER = 'rgba(196, 197, 215, 0.3)';
