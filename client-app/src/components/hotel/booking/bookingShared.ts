/**
 * 订房流程各屏共用的卡壳 / 表单 / 按钮样式(Figma M-Trip / `Multi Booking Hotel Booking Flow` 1675:5776)
 *
 * 这是继 `detailShared`(酒店详情)/ `promoShared`(优惠中心)/ `moreShared`(更多)之后的第四份实例。
 * **不能直接复用前三份** —— 这一套稿的卡片虽然也是圆角 32,但内边距是 25(不是 24),
 * 描边在不同区块之间会在 `--secondary` 与 `rgba(196,197,215,0.2|0.3)` 之间切换,
 * 底色也分 `--tab`(#FEFEFE)与纯白两种,照搬前三份会有肉眼可见的差。
 *
 * 设计稿实测(以 Step 1 `1675:6069` / Step 3 `1675:6404` / Step 4 `1675:6537` 为准):
 *   页面     `--background` 底,Main px16 / pt32 / pb100,区块间距 24
 *   卡壳     圆角 32、padding 25、1px 描边、投影 Effect/DS(= shadows.subtle)
 *   表单     label Inter 500/14 tracking .14 `#434655` + 必填星号 `--tertiary`
 *            输入框 高 56、圆角 12、1px `--secondary`、px17 py18、placeholder `#6B7280`
 *   吸底栏   `--tab` 底、py16、内容 px24、两枚按钮 gap20、圆角 12、py16
 */

import { StyleSheet } from 'react-native';

import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 深一档主色(设计稿 `#204DDA`:Step n of 4、View Details、Share、成功页链接) */
export const DEEP_PRIMARY = '#204DDA';
/** 卡内深色标题(设计稿 `#0B1C30`,比 `--text` 更冷) */
export const CARD_HEADING = '#0B1C30';
/** 表单正文色(设计稿 `#434655` = colors.muted 的同值,这里给个语义名) */
export const FORM_TEXT = '#434655';
/** 输入框 placeholder(设计稿 `#6B7280`) */
export const PLACEHOLDER = '#6B7280';
/** 支付方式图标底板(设计稿 `#E5EEFF`) */
export const PAY_TILE_BG = '#E5EEFF';
/** 旅客头像底(设计稿 `#DDE1FF`,与「更多」的常用旅客同色) */
export const AVATAR_BG = '#DDE1FF';

/**
 * 主色 10% 的两种写法,设计稿里并存且**不是同一个值**:
 *   TINT_BUTTON 用在「Add to booking」按钮底(设计稿 `rgba(66,104,244,0.1)`)
 *   TINT_CHIP   用在加购胶囊 / Earn Points 徽章 / 返现横幅(设计稿 `rgba(65,105,237,0.1)`)
 * 照原值分开,不合并。
 */
export const TINT_BUTTON = 'rgba(66, 104, 244, 0.1)';
export const TINT_CHIP = 'rgba(65, 105, 237, 0.1)';
/** 深主色 10%(入离/人数两格的圆形图标底) */
export const TINT_DEEP = 'rgba(32, 77, 218, 0.1)';

/** 卡描边的三档(设计稿在不同区块之间切换,不要统一) */
export const BORDER_SOFT = 'rgba(196, 197, 215, 0.2)';
export const BORDER_SOFT_STRONG = 'rgba(196, 197, 215, 0.3)';
/** 人数卡两行之间的分隔(设计稿 `rgba(211,228,254,0.3)`) */
export const ROW_DIVIDER = 'rgba(211, 228, 254, 0.3)';

/** 吸底栏高度(py16 + 按钮 52),页面用它算滚动区的底部留白 */
export const BOTTOM_BAR_HEIGHT = 84;

export const bookingShared = StyleSheet.create({
  /** 主卡壳:`--tab` 底 + `--secondary` 描边(摘要卡 / 日历 / 表单 / 支付方式行) */
  panel: {
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  /** 纯白卡壳 + 更浅的描边(价格明细 / 特殊要求) */
  panelWhite: {
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: BORDER_SOFT_STRONG,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  /** 无描边、只有投影的卡(人数卡 / 加购卡外壳) */
  panelPlain: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },

  /** 区块大标题 Inter 600/24(Who's Coming? / Enhance Your Stay / Special Requests) */
  sectionTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  /** 卡内标题 Inter 700/16(Price Breakdown / Add On Service / Cancellation Policy) */
  panelTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  /** 全大写的小标题 Inter 600/12 tracking .6(BOOKING DURATION / TOTAL AMOUNT / CHECK-IN) */
  overline: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.label,
  },
  /** 说明性正文 Inter 500/14 tracking .14 */
  note: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.label,
  },

  /* ---- 表单 ---- */
  fieldLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: FORM_TEXT,
  },
  required: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.hot,
  },
  /** 输入框 / 下拉框外框(设计稿高 56、圆角 12、1px `--secondary`) */
  control: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: 'transparent',
  },
  controlText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
    padding: 0,
  },
  controlPlaceholder: { color: PLACEHOLDER },

  /* ---- 按钮 ---- */
  /** 主色整宽按钮(圆角 8、px16 py8,Inter 600/14) */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  /** 主色 10% 底的次级按钮(加购卡的 Add to booking) */
  tintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: TINT_BUTTON,
  },
  tintBtnText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.primary,
  },

  pressed: { opacity: 0.85 },
});
