/**
 * 「更多」section 子页的设计稿静态数据(Figma M-Trip / More 1695:5951)
 *
 * 后端现状:推荐(referral)的推荐码/战绩/明细已接 user-service `/app/user/referral/*`
 * (取数见 `screens/more/useReferralData.ts`),**这里只剩纯排版用的静态步骤/规则常量**;
 * 教程视频与条款仍没有内容接口,照搬设计稿的值,文案走 i18n。
 */

/** 推荐流程五步(设计稿 1690:5788),文案走 more.referral.how.steps.<key> */
export const REFERRAL_STEPS = ['invite', 'join', 'book', 'stay', 'reward'] as const;

/** 奖励规则五条(设计稿 1690:5944) */
export const REFERRAL_RULES = [
  'firstBooking',
  'noCancelled',
  'afterStay',
  'toWallet',
  'campaignTerms',
] as const;

/** 推荐明细里的进度节点(设计稿 1690:5493),依次是 邀请→注册→下单→入住→奖励 */
export const REFERRAL_PROGRESS = ['invited', 'registered', 'book', 'stay', 'reward'] as const;
export type ReferralProgressStep = (typeof REFERRAL_PROGRESS)[number];

/** 教程视频(设计稿 2206:7577 等三张卡) */
export const GUIDE_VIDEOS = ['booking', 'register', 'cancel'] as const;

/** 图文指南(设计稿 2206:8255 三张折叠卡,内容后端未提供,展开态设计稿也没画) */
export const GUIDE_ARTICLES = ['hotelBooking', 'payment', 'cancellation'] as const;

/** 条款页的五节(设计稿 1697:7426 起) */
export const TERMS_SECTIONS = [
  { key: 'useOfService', bullets: ['age', 'confidentiality', 'legalUse'] },
  { key: 'bookingPolicy', bullets: ['confirmedOnPayment', 'intermediary'] },
  { key: 'payment', bullets: [] as string[] },
  { key: 'responsibilities', bullets: ['visa', 'healthSafety', 'dressCode'] },
  { key: 'privacy', bullets: [] as string[] },
] as const;

/** 退款时间表(设计稿 1697:7469),值直接展示不进 i18n */
export const REFUND_TIMELINE = [
  { key: 'over14', refund: '100%', danger: false },
  { key: 'days7to14', refund: '50%', danger: false },
  { key: 'under7', refund: null, danger: true },
] as const;
