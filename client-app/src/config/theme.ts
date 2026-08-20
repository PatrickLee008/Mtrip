/**
 * 主题令牌(移动端以 Figma 设计稿 M-Trip 为准,主色与 admin-web 不再强制一致)
 * 设计稿取值来源:Figma M-Trip / Home 81:2464
 */

export const colors = {
  primary: '#4169ED',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  text: '#1f1f1f',
  textSecondary: '#8c8c8c',
  border: '#f0f0f0',
  background: '#f5f6f8',
  card: '#ffffff',
  price: '#ff6b35',
  /* ---- 以下为 Figma 设计稿色板(新页面优先使用) ---- */
  /** 页面底色 */
  pageBg: '#EBF0FF',
  /** 浮起面板/卡片底色(略暖于纯白) */
  surface: '#FEFEFE',
  /** 促销大卡深蓝 */
  deepBlue: '#0036AD',
  /** 深蓝卡上的徽章底/字 */
  badgeBg: '#1F4ED3',
  badgeText: '#C8D1FF',
  /** 区块标题 */
  heading: '#1B1D30',
  /** 卡片标题 */
  cardTitle: '#061C34',
  /** 正文 */
  body: '#191A25',
  /** 次要说明 */
  muted: '#434654',
  /** 浅蓝底板(路线图标底/次要按钮底) */
  softBlue: '#D9E1FB',
  /** 更浅的蓝底(旅行协助卡) */
  tintBg: '#EFF4FF',
  /** 热门角标红 */
  hot: '#EC1317',
  /** 紧急求助底/前景 */
  emergencyBg: '#FFDAD6',
  emergencyFg: '#BA1A1A',
  /** 分隔线 */
  divider: '#C4C5D7',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  price: 18,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  round: 999,
  /** 设计稿卡片圆角 */
  card: 32,
  /** 设计稿按钮圆角 */
  btn: 12,
  /** 设计稿图标底板圆角 */
  tile: 20,
} as const;

/** 页面横向内边距(设计稿 Main paddingLeft/Right) */
export const PAGE_PADDING = 16;
/** 区块间距(设计稿 Main itemSpacing) */
export const SECTION_GAP = 24;
