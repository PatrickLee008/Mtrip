/**
 * 关怀模式订房向导四步共用的卡壳 / 表单 / 按钮样式
 *
 * 设计侧**没有出订房流程的 Lite 稿**(Figma section `Booking Flow` `759:9777` 与完整模式
 * 已实现的 `Multi Booking Hotel Booking Flow` 1675:5776 逐屏同构,逐帧比对过)。
 * 所以这一份不是「实测某张稿」,而是把完整版 `bookingShared.ts` 按仓库已确立的
 * **关怀模式换算规则**整体放大一档 —— 与 `components/hotel/lite/liteShared.ts`
 * (详情族)、`HotelsLiteScreen`(搜索)同一口径,保证四条链路的字号是一套。
 *
 * 换算表(左=完整版实测,右=本文件):
 *   卡壳       圆角 32 / padding 25        →  圆角 24 / padding 24(同 liteShared.card)
 *   区块标题   Inter 600/24                →  Inter 600/32
 *   卡内标题   Inter 700/16                →  Inter 700/24
 *   大写小标   Inter 600/12 tracking .6    →  Inter 700/16 tracking 1.2(同 liteShared.groupTitle)
 *   正文/说明  Inter 500/14                →  Inter 400/20
 *   表单 label Inter 500/14                →  Inter 600/20
 *   输入框     高 56、文字 16              →  高 64、文字 24(同 Lite 搜索框)
 *   主按钮     py8、Inter 600/14           →  py16、Outfit 400/24(同 Lite CTA)
 *
 * 颜色一律沿用完整版的 `bookingShared` 常量,只改尺寸 —— 关怀模式改的是「看得清」,不是换皮。
 */

import { StyleSheet } from 'react-native';

import { FORM_TEXT, PLACEHOLDER, TINT_BUTTON } from '@/components/hotel/booking/bookingShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 吸底栏高度(py16 ×2 + 按钮 60),页面用它算滚动区的底部留白 */
export const LITE_BAR_HEIGHT = 108;

export const liteBooking = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  flexCol: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },

  /** 主卡壳:`--tab` 底 + `--secondary` 描边 */
  card: {
    width: '100%',
    padding: 24,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  /** 纯白卡壳(价格明细 / 特殊要求) */
  cardWhite: {
    width: '100%',
    padding: 24,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  /** 不带内边距的卡壳(人数卡 / 加购卡外壳,内容自己排 padding) */
  cardPlain: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.subtle,
  },

  /** 区块大标题(Who's Coming? / Enhance Your Stay / Special Requests) */
  sectionTitle: { fontFamily: fonts.interSemi, fontSize: 32, lineHeight: 40, color: colors.heading },
  /** 卡内标题(Price Breakdown / Add On Service / Cancellation Policy) */
  cardTitle: { fontFamily: fonts.interBold, fontSize: 24, lineHeight: 32, color: colors.heading },
  /** 条目标题 */
  itemTitle: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  /** 全大写的分组小标(BOOKING DURATION / TOTAL AMOUNT / COUPONS) */
  overline: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.label,
  },
  /** 正文 */
  body: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 28, color: colors.textSoft },
  /** 说明性正文(比 body 弱一档,用于提示行) */
  note: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.label },
  /** 主色链接 */
  link: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 28, color: colors.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  divider: { height: 1, backgroundColor: 'rgba(196, 197, 215, 0.3)' },

  /* ---- 表单 ---- */
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 },
  fieldLabel: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 28, color: FORM_TEXT },
  required: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 28, color: colors.hot },
  /** 输入框 / 下拉框外框 */
  control: {
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: 'transparent',
  },
  controlText: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
    padding: 0,
  },
  controlPlaceholder: { color: PLACEHOLDER },

  /* ---- 按钮 ---- */
  /** 主色整宽按钮 */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.outfit,
    fontSize: 24,
    lineHeight: 32,
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
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: TINT_BUTTON,
  },
  tintBtnText: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    color: colors.primary,
  },
});
