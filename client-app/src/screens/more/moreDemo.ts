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

/* ======================================================================
 * 以下为「更多」section 支持类子页(FAQ / 联系我们 / 反馈 / 隐私政策 / 关于)的静态数据
 * ====================================================================== */

/**
 * FAQ 分类与问题(设计稿 FAQ 1699:7636 / 1793:3969 分类卡 / 1793:4029 问答卡)
 *
 * **后端缺口**:user-service 只有 `GET /api/v1/app/chat/faqs`,那是客服聊天里的
 * 4 条中文快捷提问(只有问题没有答案、没有分类、不分语言),撑不起这一页。
 * 设计稿要的是「分类 → 问题 → 答案」三级内容,只能先写死在这里,文案走 more.faq.items.<key>.{q,a}。
 * 等后端有内容接口(或 CMS)后,把这张表换成接口数据即可,页面结构不用动。
 */
export const FAQ_CATEGORIES = [
  { key: 'general', items: ['whatIsMtrip', 'account', 'language'] },
  { key: 'booking', items: ['howToBook', 'freeCancel', 'payment'] },
  { key: 'cars', items: ['carArea', 'carDriver'] },
  { key: 'food', items: ['foodReserve', 'foodPay'] },
] as const;

/**
 * 联系方式(设计稿 Contact us 3503:9182 / Hotline Overlay 3578:10243)
 *
 * **后端缺口**:平台没有「客服联系方式」配置接口(站点表里也没有热线/邮箱字段),
 * 值照抄设计稿。等有站点级配置后改成从接口取,注意热线是**站点相关**的。
 */
export const SUPPORT_CONTACT = {
  website: 'https://www.myanmartrip.com/',
  email: 'support@myanmartrip.com',
  hotlines: ['09986668882', '09986668883'],
} as const;

/** 热线弹层的服务时间两行(设计稿 3578:10330),文案走 more.contact.hotline.hours.<key> */
export const HOTLINE_HOURS = ['carsHotels', 'others'] as const;

/**
 * 「Report Issue」的问题类型下拉(设计稿 Button 3313:11169 展开态)
 *
 * 后端 user_feedback.feedback_type 只有四档(1功能建议 2订单投诉 3商户投诉 4其他),
 * 这里把设计稿的十个细分类映射到最接近的一档;细分类本身拼进 content 开头(`[Booking Issue] ...`)
 * 让后台能看到,不新增后端字段。
 */
export const FEEDBACK_ISSUE_TYPES = [
  { key: 'booking', feedbackType: 2 },
  { key: 'appCrash', feedbackType: 4 },
  { key: 'login', feedbackType: 4 },
  { key: 'payment', feedbackType: 2 },
  { key: 'hotelInfo', feedbackType: 3 },
  { key: 'transport', feedbackType: 3 },
  { key: 'food', feedbackType: 3 },
  { key: 'coupon', feedbackType: 4 },
  { key: 'notification', feedbackType: 4 },
  { key: 'other', feedbackType: 4 },
] as const;
export type FeedbackIssueKey = (typeof FEEDBACK_ISSUE_TYPES)[number]['key'];
/** 「Suggestion / Feedback」统一记为 1 功能建议 */
export const FEEDBACK_TYPE_SUGGESTION = 1;

/**
 * 隐私政策(设计稿 Privacy Policy 3256:19233)
 *
 * 法律文本没有内容接口,与条款页一样照搬设计稿、文案走 more.privacy.*。
 * 第 1 节两个小节是「说明 + 列表」,1.2 末尾还挂一块灰底提示;2/3 节是两段纯文本;
 * 第 4 节「联系我们」的卡片单独排版(邮箱 / 网址 / 地址)。
 */
export const PRIVACY_UPDATED_AT = '24 October 2026';
export const PRIVACY_COLLECT_SUBSECTIONS = [
  {
    key: 'account',
    items: ['fullName', 'phone', 'password', 'profile', 'referral', 'thirdParty'],
    note: false,
  },
  {
    key: 'booking',
    items: ['guestName', 'contactPhone', 'details', 'service', 'dates', 'guests', 'requests', 'transaction'],
    note: true,
  },
] as const;
export const PRIVACY_TEXT_SECTIONS = ['thirdParty', 'transfers'] as const;
export const PRIVACY_CONTACT = {
  email: 'privacy@mtrip.com',
  website: 'https://www.mtrip.com',
} as const;

/** 关于页 Transportation 一节的四个服务标签(设计稿 3256:19446),文案走 more.about.transport.tags.<key> */
export const ABOUT_TRANSPORT_TAGS = ['airportPickup', 'airportDropoff', 'pointToPoint', 'carRental'] as const;

/**
 * 商店评分链接(Rate Application Overlay 3282:21342 的「Yes! leave rating」)
 *
 * Android 按 app.json 的包名拼 Play 商店链接;**iOS 还没有 App Store 上架 id(运营缺口)**,
 * 为 null 时按钮只提示「即将开放」。拿到 id 后填 `itms-apps://apps.apple.com/app/id<ID>?action=write-review`。
 */
export const STORE_REVIEW_URL: { android: string; ios: string | null } = {
  android: 'market://details?id=com.mtrip.clientapp',
  ios: null,
};
