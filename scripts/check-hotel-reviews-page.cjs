#!/usr/bin/env node
/**
 * 设计契约校验:完整模式「住客评价」整页(Hotel Details Reviews Page)
 *
 * 依据:Figma M-Trip / `Hotel Details Reviews Page` `1133:2998`
 * 设计数据落档:本轮经 Figma MCP `get_figma_data` 取回(整帧渲染图 .figma-cache/hotel-reviews-page-full.png)
 *
 * 为什么用源码级断言:client-app 没有测试框架(无 jest / 无 render harness),
 * 唯一可自动化的等价物是「稿面规格的源码契约」+ i18n 结构一致性 + tsc。
 * 断言的是设计稿的事实(尺寸/文案/结构)与本次拍板的取数口径,不是实现的自证。
 *
 * 用法:powershell -Command "node scripts/check-hotel-reviews-page.cjs"
 * 退出码:0 = 全部通过(GREEN),1 = 有失败项(RED)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const at = (...segments) => path.join(ROOT, ...segments);

const SCREEN = at('client-app/src/screens/hotel/HotelReviewsScreen.tsx');
const DASHBOARD = at('client-app/src/components/hotel/HotelReviewDashboard.tsx');
const CARD = at('client-app/src/components/hotel/HotelReviewCard.tsx');
const DETAIL_SCREEN = at('client-app/src/screens/hotel/HotelDetailScreen.tsx');
const NAV = at('client-app/src/navigation/index.tsx');
const NAV_TYPES = at('client-app/src/navigation/types.ts');
const API = at('client-app/src/api/goods.ts');
const ICONS = at('client-app/src/components/home/HomeIcon.tsx');
const DETAIL_SHARED = at('client-app/src/components/hotel/detailShared.ts');
const TAB = at('client-app/src/components/hotel/HotelReviewsTab.tsx');
const LOCALES = ['en-US', 'zh-CN', 'my-MM'].map((name) => ({
  name,
  file: at(`client-app/assets/i18n/${name}.json`),
}));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  [${detail}]`}`);
}
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}
function valueAt(tree, dotted) {
  return dotted.split('.').reduce((node, key) => (node === undefined ? undefined : node[key]), tree);
}

/**
 * 取出 StyleSheet.create 里的具名样式块。用花括号配对扫描而不是正则配对:
 * 块既有单行也有多行,正则配对着会跨块吞掉后面的内容。
 */
function readStyleBlocks(text) {
  const blocks = new Map();
  const sheetIndex = text.indexOf('StyleSheet.create(');
  const scope = sheetIndex === -1 ? text : text.slice(sheetIndex);
  const header = /\n {2}(\w+): \{/gu;
  let match;
  while ((match = header.exec(scope)) !== null) {
    const start = scope.indexOf('{', match.index);
    let depth = 0;
    let end = start;
    for (; end < scope.length; end += 1) {
      if (scope[end] === '{') depth += 1;
      else if (scope[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.set(match[1], scope.slice(start, end + 1));
  }
  return blocks;
}

/**
 * 去掉注释后再做「不许出现某词」的否定断言。
 *
 * 第一版直接扫原文,**4 条断言全部误判** —— 命中的不是代码,而是解释性注释里提到的那个词:
 * 卡片注释写了「稿面有、本卡不渲染的行:… Helpful (12) / Report」,总览注释写了
 * 「圆角 24 而不是 `detailShared.panel` 的 32」,卡壳注释写了「overflow 会连阴影一起吃掉」。
 * 断言必须针对**代码**而不是散文,所以先剥注释。
 * 行注释的替换避开 `://`,免得把 `https://` 这类字符串从中间截断。
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gmu, '$1 ');
}

// ============================================================ 文件存在性 ====
const screenSource = readText(SCREEN);
const dashboardSource = readText(DASHBOARD);
const cardSource = readText(CARD);
const detailScreenSource = readText(DETAIL_SCREEN);
const navSource = readText(NAV);
const navTypesSource = readText(NAV_TYPES);
const apiSource = readText(API);
const iconSource = readText(ICONS);
const tabSource = readText(TAB);

check('新增评价整页 HotelReviewsScreen.tsx', screenSource !== null);
check('新增共享评分总览 HotelReviewDashboard.tsx', dashboardSource !== null);
check('新增评价卡 HotelReviewCard.tsx', cardSource !== null);
check('Reviews 页签仍在(改为承载共享总览的薄容器)', tabSource !== null);

// ================================================================== i18n ====
const REQUIRED_KEYS = [
  'hotels.reviewsPage.title',
  'hotels.reviewsPage.empty',
  'hotels.reviewsPage.anonymous',
  'hotels.reviewsPage.outOfTen',
  'hotels.reviewsPage.replyFrom',
];

const loaded = LOCALES.map((locale) => {
  try {
    return { ...locale, tree: readJson(locale.file) };
  } catch (cause) {
    check(`${locale.name}.json 可解析`, false, cause.message);
    return { ...locale, tree: undefined };
  }
});
for (const locale of loaded) check(`${locale.name}.json 可解析`, locale.tree !== undefined);

if (loaded.every((locale) => locale.tree !== undefined)) {
  /** 三语同结构:只对本页命名空间做硬断言(全文件漂移另作报告,不判失败) */
  const pageKeys = (tree) =>
    leafPaths((tree.hotels && tree.hotels.reviewsPage) || {}, '')
      .filter((key) => key !== '')
      .sort();
  const reference = pageKeys(loaded[0].tree);
  check('hotels.reviewsPage 命名空间非空', reference.length > 0, `${reference.length} keys`);
  for (const locale of loaded.slice(1)) {
    const keys = pageKeys(locale.tree);
    const missing = reference.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !reference.includes(key));
    check(
      `${locale.name} 的 hotels.reviewsPage 结构与 ${loaded[0].name} 一致`,
      missing.length === 0 && extra.length === 0,
      missing.length === 0 && extra.length === 0
        ? `${keys.length} keys`
        : `missing=${missing.join(',')} extra=${extra.join(',')}`,
    );
  }

  for (const key of REQUIRED_KEYS) {
    for (const locale of loaded) {
      const value = valueAt(locale.tree, key);
      check(
        `${locale.name} 有非空词条 ${key}`,
        typeof value === 'string' && value.trim() !== '',
        typeof value === 'string' ? JSON.stringify(value) : String(value),
      );
    }
  }

  const enTree = loaded.find((locale) => locale.name === 'en-US').tree;
  /** 稿面文案:en-US 必须与设计稿字面一致 */
  check(
    'en-US reviewsPage.title 等于稿面 "Reviews (1,240)" 的模板',
    valueAt(enTree, 'hotels.reviewsPage.title') === 'Reviews ({{reviews}})',
    JSON.stringify(valueAt(enTree, 'hotels.reviewsPage.title')),
  );
  check('en-US reviewsPage.outOfTen 等于稿面 "/10"', valueAt(enTree, 'hotels.reviewsPage.outOfTen') === '/10');
  /** 插值变量必须避开 i18next 保留字 count(本仓库既有约定) */
  check(
    'reviewsPage.title 的插值键避开保留字 count',
    !/\{\{\s*count\s*\}\}/u.test(String(valueAt(enTree, 'hotels.reviewsPage.title'))),
  );

  /** 总览区复用的既有词条:保证共享组件在两种宿主下都能取到文案 */
  for (const key of [
    'hotels.detail.reviews.basedOn',
    'hotels.detail.reviews.dimensions.cleanliness',
    'hotels.detail.reviews.dimensions.service',
    'hotels.detail.reviews.dimensions.value',
    'hotels.detail.reviews.dimensions.comfort',
    'hotels.detail.reviews.aiSummary',
    'hotels.detail.reviews.topPositive',
    'hotels.detail.reviews.improvement',
    'hotels.detail.reviews.positiveQuote',
    'hotels.detail.reviews.improvementQuote',
    'hotels.results.excellent',
  ]) {
    for (const locale of loaded) {
      const value = valueAt(locale.tree, key);
      check(`${locale.name} 复用词条可用 ${key}`, typeof value === 'string' && value.trim() !== '');
    }
  }

  const allKeys = (tree) => leafPaths(tree).sort();
  const en = allKeys(enTree);
  for (const locale of loaded.filter((l) => l.name !== 'en-US')) {
    const missing = en.filter((key) => !allKeys(locale.tree).includes(key)).length;
    console.log(`INFO  ${locale.name} 相对 en-US 整份文件缺 ${missing} 个 key(报告项,不判失败)`);
  }
}

// ============================================================ 设计稿结构 ====
/**
 * 稿面结构标记(1133:2998):
 *   根 frame  padding-top 124(= 状态栏 54 + 顶栏 70),底色 #EBF0FF
 *   顶栏      padding 16/20,gap 16,底 #FEFEFE + Effect/DS,标题 Outfit 600/24/32 主色
 *   Main      padding 24px 16px 124px,gap 24
 *   总览卡    padding 24,gap 32,圆角 24,底 #FEFEFE,1px #D9E1FB,Effect/DS
 *   评论卡    padding 24,gap 12,圆角 24,同上
 */
const SCREEN_MARKERS = [
  ['顶栏标题模板(Reviews (N))', 'hotels.reviewsPage.title'],
  ['返回箭头', 'name="arrowLeft"'],
  ['主页底色', 'colors.pageBg'],
  ['顶栏底色 surface', 'colors.surface'],
  ['横向页边距令牌', 'PAGE_PADDING'],
  ['区块间距令牌', 'SECTION_GAP'],
  ['共享总览组件', 'HotelReviewDashboard'],
  ['评价卡组件', 'HotelReviewCard'],
  ['取数接口', 'fetchHotelReviews'],
  ['详情取数(总分/物业名/起价)', 'fetchHotelDetail'],
  ['加载态', 'LoadingView'],
  ['空态', 'EmptyView'],
  ['错误态', 'ErrorView'],
  ['空态文案', 'hotels.reviewsPage.empty'],
  ['分页尺寸常量', 'PAGE_SIZE'],
  ['触底加载', 'onEndReached'],
  ['下拉刷新', 'onRefresh'],
  ['rating 换算 10 分制', '* 2'],
  ['底栏回到详情并切 Rooms 页签', "tab: 'rooms'"],
  ['底栏 CTA 文案', 'hotels.detail.chooseRoom'],
];
for (const [label, marker] of SCREEN_MARKERS) {
  check(`整页源码含稿面结构:${label}`, screenSource !== null && screenSource.includes(marker), marker);
}

/**
 * 评论卡(1133:3154 / 1133:3188 / 1133:3215)的稿面事实:
 *   头像 48 圆;昵称 Inter 400/16/24 #141D23;日期行 Inter 500/12/16 #5C5F60
 *   药丸   底 rgba(66,104,244,.1) + 1px rgba(32,77,218,.2) + 圆角 32,分数 Inter 400/18/28 主色
 *   标题   padding-top 4,Inter 600/18/20 #1B1D30
 *   图墙   单图 192x128、圆角 32、间距 12,横滑
 *   回复   底 #ECF5FE + 4px 左蓝边 rgba(32,77,218,.3) + 圆角 32 + padding 16,抬头为物业名
 */
const CARD_MARKERS = [
  ['头像尺寸 48', 'height: 48'],
  ['头像圆形', 'borderRadius: 999'],
  ['昵称色 #141D23', '#141D23'],
  ['日期行灰 #5C5F60', '#5C5F60'],
  ['药丸底色 rgba(66, 104, 244, 0.1)', 'rgba(66, 104, 244, 0.1)'],
  ['药丸描边 rgba(32, 77, 218, 0.2)', 'rgba(32, 77, 218, 0.2)'],
  ['药丸分数 18/28', 'fontSize: 18'],
  ['药丸称号 12/16', 'fontSize: 12'],
  ['正文用 detailShared.body', 'detailShared.body'],
  ['图墙单图宽常量 192', 'const PHOTO_WIDTH = 192'],
  ['图墙单图高常量 128', 'const PHOTO_HEIGHT = 128'],
  ['图墙图圆角常量 32', 'const PHOTO_RADIUS = 32'],
  ['回复块底色 #ECF5FE', '#ECF5FE'],
  ['回复块左蓝边 rgba(32, 77, 218, 0.3)', 'rgba(32, 77, 218, 0.3)'],
  ['回复块左框宽 4', 'borderLeftWidth: 4'],
  ['已核实物业徽章', 'verifiedBadge'],
  ['头像取不到时的占位人形', 'name="person"'],
  ['分数换算 10 分制', '* 2'],
  ['除以 10 称号', 'outOfTen'],
  ['图墙横滑', 'horizontal'],
  ['头像/图片地址解析', 'resolveMediaUri'],
];
for (const [label, marker] of CARD_MARKERS) {
  check(`评价卡源码含稿面结构:${label}`, cardSource !== null && cardSource.includes(marker), marker);
}

/** 本页非目标:Helpful / Report 底行(1133:2998 三张卡都没有,只有关怀模式那张有) */
const cardCode = stripComments(cardSource || '');
check('评价卡不做 Helpful 底行', !/helpful/iu.test(cardCode));
check('评价卡不做 Report 底行', !/\breport\b/iu.test(cardCode));
check('整页不引用关怀模式词条', screenSource !== null && !screenSource.includes('hotels.lite.'));

// ======================================== 总览区:共享 + 圆角 32 → 24 =======
const DASHBOARD_MARKERS = [
  ['总分 60/60 Inter Bold', 'fontSize: 60'],
  ['档位胶囊', 'tier'],
  ['EXCELLENT 词条', 'hotels.results.excellent'],
  ['Based on N reviews', 'hotels.detail.reviews.basedOn'],
  ['维度条轨道色 #DDE9FF', '#DDE9FF'],
  ['维度条 5 分制', 'scoreMax'],
  ['AI Summary 词条', 'hotels.detail.reviews.aiSummary'],
  ['AI 图标', 'aiSparkle'],
  ['TOP POSITIVE', 'hotels.detail.reviews.topPositive'],
  ['ROOM FOR IMPROVEMENT', 'hotels.detail.reviews.improvement'],
  ['正面引述底色 rgba(65, 105, 237, 0.1)', 'rgba(65, 105, 237, 0.1)'],
  ['改进引述底色 rgba(236, 19, 23, 0.1)', 'rgba(236, 19, 23, 0.1)'],
  ['引述斜体', "fontStyle: 'italic'"],
  ['可选 CTA(页签有 / 本页无)', 'onReadAll'],
  ['稿面圆角常量 24', 'const CARD_RADIUS = 24'],
];
for (const [label, marker] of DASHBOARD_MARKERS) {
  check(`总览组件含稿面结构:${label}`, dashboardSource !== null && dashboardSource.includes(marker), marker);
}
check(
  '总览卡不再用 detailShared.panel(它是圆角 32,本页稿面是 24)',
  /* 只禁卡壳本身;排版助手 panelTitle / panelHeadRow 不算(它们不带圆角)。剥注释后再判 */
  !/detailShared\.panel(?![A-Za-z])/u.test(stripComments(dashboardSource || '')),
);
check(
  '总览卡自带圆角 24 的卡壳',
  dashboardSource !== null && /borderRadius:\s*CARD_RADIUS/u.test(dashboardSource),
);
check(
  'CTA 可选:本页不传时整块不渲染',
  dashboardSource !== null && /onReadAll\s*\?/u.test(dashboardSource),
);

/** 圆角 24 只作用于 Reviews 相关卡,其他五个页签的壳保持 32 */
const detailSharedSource = readText(DETAIL_SHARED);
check(
  'detailShared.panel 圆角未被连带改掉(其余五个页签仍 32)',
  detailSharedSource !== null && /borderRadius:\s*radius\.card/u.test(detailSharedSource),
);

// ====================================================== 路由与入口接线 ====
check(
  '路由类型表新增 HotelReviews',
  navTypesSource !== null && /HotelReviews:\s*\{/u.test(navTypesSource),
);
check(
  'HotelDetail 路由新增可选 tab 参数(供底栏回跳切页签)',
  navTypesSource !== null && /HotelDetail:\s*\{[^}]*tab\?:/su.test(navTypesSource),
);
check('导航注册了 HotelReviews Screen', navSource !== null && navSource.includes('name="HotelReviews"'));
check('导航引用了新页面', navSource !== null && navSource.includes('HotelReviewsScreen'));

check(
  '详情页 Reviews 页签接到新页(不再 comingSoon)',
  tabSource !== null && /navigate\('HotelReviews'/u.test(tabSource),
);
check(
  'Reviews 页签复用共享总览组件(不再自己画一套)',
  tabSource !== null && tabSource.includes('HotelReviewDashboard'),
);
check(
  'Reviews 页签的 CTA 走 onReadAll,不是 comingSoon',
  tabSource !== null && tabSource.includes('onReadAll') && !/comingSoon|onComingSoon/u.test(tabSource),
);
check(
  '详情页按 route.params.tab 同步页签(不能只在挂载时读一次)',
  detailScreenSource !== null && /route\.params\?\.tab/u.test(detailScreenSource),
);
check(
  '详情页总览取真实 reviewSummary',
  detailScreenSource !== null && detailScreenSource.includes('reviewSummary'),
);
check(
  '详情页给 Reviews 页签传真实分数与条数',
  detailScreenSource !== null && /<HotelReviewsTab[\s\S]{0,200}score=\{reviewScore\}/u.test(detailScreenSource),
);
check(
  '详情页不再用 onComingSoon 渲染 Reviews 页签(CTA 已接线)',
  detailScreenSource !== null && !/<HotelReviewsTab onComingSoon/u.test(detailScreenSource),
);

// ================================================================== API ====
check(
  'api/goods.ts 定义 HotelReview 类型',
  apiSource !== null && /export interface HotelReview\b/u.test(apiSource),
);
check(
  'api/goods.ts 暴露 fetchHotelReviews',
  apiSource !== null && /export function fetchHotelReviews/u.test(apiSource),
);
check(
  '评价接口打到 /api/v1/app/hotels/reviews',
  apiSource !== null && apiSource.includes("'/api/v1/app/hotels/reviews'"),
);
check(
  'HotelReview 覆盖后端下发字段',
  apiSource !== null &&
    ['rating', 'content', 'images', 'reply_content', 'created_at', 'nickname', 'avatar'].every((field) =>
      apiSource.includes(field),
    ),
);

// ================================================================ 图标 ====
/* 断言的是「联合类型里有这个名字」,不是「它排在最后」—— 原来的正则带着行尾分号,
   后面任何人往联合里追加图标都会让这条假红(2026-09-22 新增 walletCreditCard/calendarClock 时踩到) */
check('HomeIcon 新增 verifiedBadge', iconSource !== null && /^\s*\| 'verifiedBadge';?$/mu.test(iconSource));
check(
  'verifiedBadge 用抠图的 fillRule(evenodd 由组件统一给)',
  iconSource !== null && iconSource.includes('checkmark-starburst'),
);

// ============================================ 样式块(必须在实现里成立) ====
if (screenSource !== null) {
  const blocks = readStyleBlocks(screenSource);
  const blockOf = (name) => blocks.get(name) || '';
  check('解析到整页样式块', blocks.size >= 12, `${blocks.size} 块`);

  /** 顶栏是悬浮层:position absolute + 状态栏下 */
  check('styles.headerBar 为绝对定位悬浮', /position:\s*'absolute'/u.test(blockOf('headerBar')));
  /** iOS 上 overflow:'hidden' 会连 shadow 一起裁掉 —— 带 Effect/DS 的层不能同时裁剪 */
  for (const [name, body] of blocks.entries()) {
    if (body.includes('shadows.subtle')) {
      check(
        `styles.${name} 有阴影但不与 overflow 同块(iOS 会吃掉阴影)`,
        !/overflow/u.test(stripComments(body)),
      );
    }
  }
  /** 底栏:padding 16/20 + 顶部 1px 分隔线(稿面 Mobile Bottom Bar) */
  const bar = blockOf('bottomBar');
  check('styles.bottomBar 顶部有 1px 分隔线', /borderTopWidth:\s*1/u.test(bar));
  check('styles.bottomBar 横向内边距 20', /paddingHorizontal:\s*20/u.test(bar));

  /**
   * 悬浮层的**绘制顺序**契约。
   *
   * RN / react-native-web 的同级兄弟按**声明顺序**绘制,后声明者在上 —— 绝对定位的顶栏若声明在
   * FlatList **之前**,列表就会盖住顶栏:既挡内容,又吃掉返回按钮的点击(实测就是这三个症状:
   * 返回点不动 / 顶栏层级错 / 上拉时内容挡住顶栏)。参照实现是本仓库同架构的 `HotelDetailScreen`,
   * 它的悬浮 topBar 就声明在 ScrollView **之后**。
   */
  const screenCode = stripComments(screenSource);
  const flatListAt = screenCode.indexOf('<FlatList');
  const headerAt = screenCode.indexOf('styles.headerBar,');
  check(
    '顶栏 JSX 声明在 FlatList 之后(同级兄弟按声明顺序绘制)',
    flatListAt !== -1 && headerAt !== -1 && flatListAt < headerAt,
    `FlatList@${flatListAt} headerBar@${headerAt}`,
  );
  check('styles.headerBar 显式 zIndex(不把层级寄托在声明顺序上)', /zIndex:\s*\d+/u.test(blockOf('headerBar')));
  check('styles.bottomBar 显式 zIndex(防止列表盖住底栏)', /zIndex:\s*\d+/u.test(bar));
  check(
    'FlatList 带 flex:1 的 style(滚动视口=屏幕,而不是撑成内容高)',
    /<FlatList[\s\S]{0,120}style=\{styles\.flex\}/u.test(screenCode),
  );
  check('styles.flex 为 flex 1', /flex:\s*1/u.test(blockOf('flex')));
}

if (cardSource !== null) {
  const blocks = readStyleBlocks(cardSource);
  const blockOf = (name) => blocks.get(name) || '';
  const cardBlock = blockOf('card');
  check('styles.card 圆角用稿面常量 24', /borderRadius:\s*CARD_RADIUS/u.test(cardBlock));
  check('styles.card 内边距 24', /padding:\s*24/u.test(cardBlock));
  check('styles.card 间距 12', /gap:\s*12/u.test(cardBlock));
  check('styles.card 底色 surface', cardBlock.includes('colors.surface'));
  check('styles.card 描边 softBlue', cardBlock.includes('colors.softBlue'));
  check('styles.card 带 Effect/DS 阴影', cardBlock.includes('shadows.subtle'));
  check(
    'styles.photo 单图按稿面常量给宽高',
    blockOf('photo').includes('PHOTO_WIDTH') &&
      blockOf('photo').includes('PHOTO_HEIGHT') &&
      blockOf('photo').includes('PHOTO_RADIUS'),
  );
  check('styles.reply 左框宽 4', /borderLeftWidth:\s*4/u.test(blockOf('reply')));
  check('styles.reply 内边距 16', /padding:\s*16/u.test(blockOf('reply')));
  check('styles.reply 圆角 32', /borderRadius:\s*32/u.test(blockOf('reply')));
  check('styles.scorePill 圆角 32', /borderRadius:\s*32/u.test(blockOf('scorePill')));
  check('styles.scorePill 1px 描边', /borderWidth:\s*1/u.test(blockOf('scorePill')));
  check('styles.avatar 48 圆', /width:\s*48/u.test(blockOf('avatar')) && /height:\s*48/u.test(blockOf('avatar')));
  /** iOS 上 overflow:'hidden' 会把 shadow 一起裁掉 —— 稿面卡带 Effect/DS,不能再裁剪 */
  const cardShadowBlocks = [...blocks.entries()].filter(([, body]) => body.includes('shadows.subtle'));
  check('评价卡存在带 Effect/DS 的样式块', cardShadowBlocks.length > 0, cardShadowBlocks.map(([name]) => name).join(', '));
  for (const [name, body] of cardShadowBlocks) {
    check(`评价卡 styles.${name} 有阴影但不与 overflow 同块`, !/overflow/u.test(stripComments(body)));
  }
}

// =============================================================== summary ====
const failed = results.filter((row) => !row.ok);
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'}  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`failing: ${failed.map((row) => row.label).join(' | ')}`);
  process.exit(1);
}
