// Render the real referral screens with controlled API data; no browser/provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const fromApp = Module.createRequire(path.join(root, 'client-app/package.json'));
const ts = fromApp('typescript');
const React = fromApp('react');
const { renderToStaticMarkup } = fromApp('react-dom/server');
const i18next = fromApp('i18next').createInstance();
let summary, list = [], currency = 'EUR', passed = 0;
const cache = new Map();
const host = tag => ({ children }) => React.createElement(tag, null, children);
const native = {
  View: host('div'), Text: host('span'), Pressable: host('button'), Image: () => null,
  StyleSheet: { create: x => x, absoluteFill: {} },
};
function load(relative) {
  const filename = path.join(root, 'client-app/src', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const item = new Module(filename, module);
  item.filename = filename;
  item.paths = fromApp.resolve.paths('react');
  item.require = id => {
    if (id === 'react') return { ...React, useState: () => ['rewarded', () => {}] };
    if (id === 'react-native') return native;
    if (id === 'react-i18next') return { useTranslation: () => ({ t: i18next.t.bind(i18next) }) };
    if (id === 'react-native-svg') return { __esModule: true, default: () => null, Defs: () => null, LinearGradient: () => null, Rect: () => null, Stop: () => null };
    if (id === 'expo-clipboard') return { setStringAsync: async () => {} };
    if (id === '@react-navigation/native') return { useNavigation: () => ({ navigate() {} }) };
    if (id === '@/api/user') return { REFERRAL_STATUS: { PENDING: 0, REWARDED: 1 } };
    if (id === '@/screens/more/useReferralData') return {
      useReferralSummary: () => ({ summary, link: 'https://example.test/ref', isLogin: true }),
      useReferralInvitees: () => ({ list }),
      refereeDescKey: status => status === 1 ? 'rewarded' : 'waitingBooking',
      refereeDoneUntil: status => status === 1 ? 5 : 2,
    };
    if (id === '@/store/siteStore') return { useSiteStore: fn => fn({ currency }) };
    if (id === '@/store/commonStore') return { useCommonStore: fn => fn({ showToast() {} }) };
    if (id === '@/components/home/HomeIcon') return { __esModule: true, default: () => null };
    if (id === '@/components/more/MorePageLayout') return { __esModule: true, default: ({ children }) => React.createElement('div', null, children) };
    if (id === '@/components/common/SegmentedTabs') return { __esModule: true, default: ({ tabs, label }) => React.createElement('div', null, ...tabs.map(x => React.createElement('span', { key: x }, label(x)))) };
    if (id === '@/assets/tempImages') return { TEMP_REFERRAL_BANNER: {} };
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts' + (fs.existsSync(path.join(root, 'client-app/src', id.slice(2) + '.tsx')) ? 'x' : ''));
    return fromApp(id);
  };
  cache.set(filename, item);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  });
  item._compile(output.outputText, filename);
  return item.exports;
}
function render(relative) {
  const component = load(relative).default;
  return renderToStaticMarkup(React.createElement(component, relative.includes('ReferralStatsCard') ? { summary } : {}));
}
function check(name, condition) {
  assert.ok(condition, name); passed++; process.stdout.write('PASS ' + name + '\n');
}
(async () => {
  const resources = Object.fromEntries(['en-US', 'zh-CN', 'my-MM'].map(lang => [lang, {
    translation: JSON.parse(fs.readFileSync(path.join(root, 'client-app/assets/i18n', lang + '.json'), 'utf8')),
  }]));
  await i18next.init({ resources, lng: 'en-US', fallbackLng: 'en-US', interpolation: { escapeValue: false } });
  for (const lang of Object.keys(resources)) {
    await i18next.changeLanguage(lang);
    summary = { referralCode: 'QA', inviteeCount: 2, pendingCount: 1, rewardedCount: 0, rewardTotal: 0, noRewardCount: 1,
      program: { inviterAmount: 12345, inviteeAmount: 2000, currency: 'MMK' } };
    let html = render('screens/more/ReferralScreen.tsx');
    check(lang + ': banner shows configured amount and currency', html.includes('12,345') && html.includes('MMK') && !html.includes('50,000'));
    html = render('components/more/ReferralStatsCard.tsx');
    check(lang + ': zero history is explicitly explained', html.includes(i18next.t('more.referral.noRewardNote', { count: 1 })));
    check(lang + ': summary currency comes from its offer', html.includes('MMK') && !html.includes('EUR'));
    summary.program.inviterAmount = 0;
    html = render('screens/more/ReferralScreen.tsx');
    check(lang + ': disabled offer never promises money', html.includes(i18next.t('more.referral.unavailable')) && !html.includes('12,345') && !html.includes('50,000'));
    delete summary.program;
    html = render('screens/more/ReferralScreen.tsx');
    check(lang + ': older API fallback does not promise an unverified amount', html.includes(i18next.t('more.referral.bannerDesc')) && !html.includes('50,000'));
    list = [{ id: 1, nickname: 'QA', reward_status: 1, reward_amount: '0.00' }];
    html = render('screens/more/ReferralStatusScreen.tsx');
    check(lang + ': completed zero record is not called wallet credit', html.includes(i18next.t('more.referral.noRewardDesc')) && !html.includes(i18next.t('more.referral.status.desc.rewarded')));
    check(lang + ': completed tab keeps zero history accessible', html.includes(i18next.t('more.referral.completed')));
    list[0].reward_amount = '12345.00';
    html = render('screens/more/ReferralStatusScreen.tsx');
    check(lang + ': positive reward still describes the actual credit', html.includes(i18next.t('more.referral.status.desc.rewarded')) && !html.includes(i18next.t('more.referral.noRewardDesc')));
  }
  process.stdout.write('PASS_COUNT=' + passed + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
