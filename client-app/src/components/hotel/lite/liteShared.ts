/**
 * 关怀模式酒店详情族四个页面(信息 / 政策 / 评价 / 实景)的公共壳样式
 *
 * 四张稿共用同一套盒子:白卡 + 1px `--secondary` + 圆角 24/32 + 弱投影,
 * 区块标题 Inter 600/24、正文 Inter 400/16-20 —— 抽出来一处维护,
 * 免得四个文件各写一份、改一次要改四遍(与 `components/hotel/detailShared.ts` 同一做法)。
 *
 * 关怀版与完整版的差别只有一处:字号整体大一档(正文 16→20、标题 20→24)。
 */

import { StyleSheet } from 'react-native';

import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export const liteShared = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  flexCol: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },

  /** 顶部栏:返回 + 标题(白底页用) */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  main: { paddingHorizontal: PAGE_PADDING, paddingBottom: 32, gap: 24 },

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
  /** 区块标题 */
  sectionTitle: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  /** 分组小标(大写 + 字距,设计稿里是主色) */
  groupTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  /** 条目标题 */
  itemTitle: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 28, color: colors.heading },
  /** 正文 */
  body: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  /** 大号正文(设计稿设施条目用 20) */
  bodyLarge: { fontFamily: fonts.inter, fontSize: 20, lineHeight: 24, color: colors.cardTitle },
  /** 主色链接 */
  link: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  divider: { height: 1, backgroundColor: 'rgba(196, 197, 215, 0.3)' },
});
