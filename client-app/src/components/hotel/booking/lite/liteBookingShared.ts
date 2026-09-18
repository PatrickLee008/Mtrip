/**
 * 关怀模式订房向导两步共用的卡壳 / 表单 / 按钮样式(Figma `2540:19101`)
 *
 * **这一份是实测值,不再是推导值。** 2026-09-15 首次落地 Lite 订房时设计侧没有出 Lite 稿,
 * 那一版是把完整版 `bookingShared.ts` 按「关怀模式换算规则」整体放大一档推导出来的
 * (区块标题 32/40、卡内标题 24/32、输入框高 64 文字 24……)。2026-09-18 设计出了真稿
 * `2540:19394`(step 1)/ `2540:19621`(step 2),**实测尺寸比推导值小**,故整表作废重写。
 *
 * 实测(节点 → 取值):
 *   页面 Main   `2540:19395`  padding 16 / gap 20
 *   页标题      `2540:19405`  Inter 600 20/32 `--text`
 *   卡壳        `2540:19406`  圆角 24 / 1px `--secondary` / 投影 Effect/DS(0/1 blur2 黑 5%)
 *                             内容区 padding 24~25 / gap 12~16
 *   卡内标题    `2540:19544`  Inter 600 20/32 `--text`
 *   条目标题    `2540:19600`  Inter 700 16/24 `--text`
 *   正文/说明   `2540:19602`  Inter 500 12/20 `--text-2`;摘要行 `2540:19437` Inter 500 16/24
 *   大写小标    `2540:19650`  Inter 600 12/16 tracking .6 `--text-2`
 *   输入框      `2540:19555`  高 56 / 圆角 12 / 1px `--secondary` / 文字 16
 *   折叠条      `2540:19593`  `--secondary` 底 + 1px 主色 + 圆角 24 + px24 py8 + 投影 DS_AG
 *   吸底双按钮  `2540:19604`  各 flex1 / 圆角 12 / px40 py16 / Inter 500 20/20
 *
 * 颜色沿用完整版 `bookingShared` 的常量,只有尺寸按新稿重排。
 */

import { StyleSheet } from 'react-native';

import { BORDER_SOFT_STRONG, TINT_BUTTON } from '@/components/hotel/booking/bookingShared';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 吸底栏高度(py16 ×2 + 按钮 52),页面用它算滚动区的底部留白 */
export const LITE_BAR_HEIGHT = 84;

export const liteBooking = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  flexCol: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },

  /** 页标题(Confirm Your Room & Date / Price Breakdown) */
  pageTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 32, color: colors.heading },

  /** 纯白卡壳(价格明细) */
  cardWhite: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER_SOFT_STRONG,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  /** 不带内边距的卡壳(加购卡外壳,内容自己排 padding) */
  cardPlain: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.subtle,
  },

  /** 卡内标题(Guest Info / Add On Service) */
  cardTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 32, color: colors.heading },
  /** 条目标题(Cancellation Policy / MMQR Pay) */
  itemTitle: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: colors.heading },
  /** 全大写的分组小标(TOTAL AMOUNT) */
  overline: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  /** 正文(摘要行 / 副标) */
  body: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  /** 说明性小字(退改政策正文) */
  note: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  /** 主色链接(View More > / + Add Email) */
  link: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  /* ---- 表单 ---- */
  /** 输入框 / 下拉框外框(设计稿 h56) */
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

  /* ---- 折叠条(Add On Service / See Other Payment) ---- */
  foldBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.softBlue,
    ...shadows.card,
  },

  /* ---- 按钮 ---- */
  /** 主色整宽按钮(加购卡的 Selected 态) */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
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
    paddingVertical: 12,
    borderRadius: radius.btn,
    backgroundColor: TINT_BUTTON,
  },
  tintBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.primary,
  },
});
