/**
 * 「更多」section 子页的设计稿静态数据(Figma M-Trip / More 1695:5951)
 *
 * 后端现状:推荐(referral)在 user-service 里只有「注册时绑定推荐人 + 生成本人推荐码」,
 * 没有查询自己推荐码/推荐统计/推荐明细的 App 接口;教程视频与条款也没有内容接口。
 * 因此这几页照搬设计稿的值,文案走 i18n,接口就绪后逐项替换即可。
 */

/** 推荐统计(设计稿 1687:4142) */
export const REFERRAL_STATS = {
  /** 累计奖励金额 */
  totalRewards: 150000,
  invited: 5,
  pending: 2,
  rewarded: 3,
  code: 'MTRIP-8D7H92',
  link: 'https://mtrip.app/r/MTRIP-8D7H92',
} as const;

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

export interface DemoReferee {
  key: string;
  /** 头像用姓名首字母 */
  name: string;
  /** 说明文案走 more.referral.status.desc.<key> */
  descKey: 'waitingBooking' | 'waitingStay' | 'rewarded';
  status: 'pending' | 'rewarded';
  /** 已完成到第几步(含),用于进度条打勾 */
  doneUntil: number;
}

/** 推荐明细(设计稿 1690:5352 / 1690:5513) */
export const DEMO_REFEREES: DemoReferee[] = [
  { key: 'r1', name: 'Ko Aung', descKey: 'waitingBooking', status: 'pending', doneUntil: 2 },
  { key: 'r2', name: 'Ko Aung', descKey: 'waitingStay', status: 'pending', doneUntil: 3 },
];

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
