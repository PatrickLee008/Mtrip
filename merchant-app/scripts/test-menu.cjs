const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function screen(file, section, options = {}) {
  const state = [], refs = [], calls = [];
  let cursor = 0, refCursor = 0;
  const element = (type, props, ...children) => ({ type, props: { ...props, children } });
  const common = { lang: 'zh-CN', setLang: async (lang) => { calls.push(['save', lang]); if (options.failSave) throw Error('storage'); }, showToast: (message) => calls.push(['toast', message]) };
  const merchant = { profile: { realName: 'Owner', username: 'owner', subjectName: 'Company', isOwner: options.owner !== false }, propertyId: 0, setPropertyId: (id) => calls.push(['property', id]), logout: async () => { calls.push(['logout']); await options.logoutWait; } };
  const navigation = { navigate: (...args) => calls.push(['navigate', ...args]), reset: (value) => calls.push(['reset', value]), goBack() {} };
  const modules = {
    react: { default: { createElement: element }, useState: (initial) => { const id = cursor++; if (!(id in state)) state[id] = initial; return [state[id], (value) => { state[id] = typeof value === 'function' ? value(state[id]) : value; }]; }, useRef: (initial) => refs[refCursor++] ||= { current: initial }, useEffect() {}, useCallback: (fn) => fn },
    'react-native': { StyleSheet: { create: (s) => s }, Platform: { OS: 'web' }, ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'Switch', 'Text', 'TextInput', 'View'].map((name) => [name, name])) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    '@react-navigation/native': { useFocusEffect() {} }, 'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '@/config/theme': { colors: {} }, '@/config/typography': { fonts: {} }, '@/config/global': {},
    '@/api/merchant': {}, '@/i18n': { changeLanguage: (lang) => calls.push(['language', lang]) },
    '@/store/commonStore': { useCommonStore: (select) => select(common) }, '@/store/merchantStore': { useMerchantStore: (select) => select(merchant) },
    '@/screens/bookings/BookingUi': { BookingIcon: 'BookingIcon' },
    './MenuUi': { MenuAvatar: 'MenuAvatar', MenuDialog: 'MenuDialog', MenuHeader: 'MenuHeader', MenuIcon: 'MenuIcon', ui: {} },
  };
  const context = { exports: {}, Intl, require: (name) => { assert.ok(modules[name], name); return modules[name]; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/screens/menu', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
  function render() { cursor = 0; refCursor = 0; return context.exports.default({ navigation, route: { params: { section } } }); }
  return { render, calls };
}
function nodes(tree) {
  return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props.children)] : [];
}
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props.children) : String(tree || ''); }
function button(tree, label) { const found = nodes(tree).find((n) => n.type === 'Pressable' && text(n).trim() === label); assert.ok(found, label); return found; }

async function run() {
  let release;
  const menu = screen('MenuScreen.tsx', null, { logoutWait: new Promise((resolve) => { release = resolve; }) });
  let tree = menu.render();
  for (const [key, section] of [['security', 'security'], ['notifications', 'notifications'], ['localization', 'localization']]) {
    const row = nodes(tree).find((n) => n.type === 'Pressable' && text(n).includes(`menu.items.${key}`));
    row.props.onPress();
    assert.equal(menu.calls.at(-1)[1], 'MenuSettings'); assert.equal(menu.calls.at(-1)[2].section, section);
  }
  button(tree, 'menu.items.hotelProfile').props.onPress();
  assert.equal(menu.calls.at(-1)[0], 'toast');
  button(tree, 'dashboardHome.logout').props.onPress();
  tree = menu.render();
  assert.equal(nodes(tree).find((n) => n.type === 'MenuDialog' && n.props.title === 'dashboardHome.logoutConfirmTitle').props.visible, true);
  button(tree, 'dashboardHome.cancel').props.onPress();
  assert.equal(menu.calls.filter(([kind]) => kind === 'logout').length, 0);
  button(menu.render(), 'dashboardHome.logout').props.onPress();
  tree = menu.render();
  const confirmation = nodes(tree).find((n) => n.type === 'MenuDialog' && n.props.title === 'dashboardHome.logoutConfirmTitle');
  button(confirmation, 'dashboardHome.logout').props.onPress();
  button(confirmation, 'dashboardHome.logout').props.onPress();
  assert.equal(menu.calls.filter(([kind]) => kind === 'logout').length, 1);
  assert.equal(menu.calls.filter(([kind]) => kind === 'reset').length, 0);
  release(); await new Promise(setImmediate);
  assert.equal(menu.calls.at(-1)[0], 'reset'); assert.equal(menu.calls.at(-1)[1].routes[0].name, 'Onboarding');

  for (const failSave of [false, true]) {
    const locale = screen('MenuSettingsScreen.tsx', 'localization', { failSave });
    tree = locale.render();
    assert.equal(button(tree, 'menu.save').props.disabled, true);
    button(tree, 'English (US)').props.onPress();
    tree = locale.render(); assert.equal(button(tree, 'menu.save').props.disabled, false);
    await button(tree, 'menu.save').props.onPress();
    await new Promise(setImmediate);
    assert.equal(locale.calls.filter(([kind]) => kind === 'language').length, failSave ? 0 : 1);
    assert.equal(locale.calls.at(-1)[1], failSave ? 'menu.saveFailed' : 'menu.languageSaved');
  }
  const draft = screen('MenuSettingsScreen.tsx', 'localization');
  button(draft.render(), 'English (US)').props.onPress();
  button(draft.render(), 'menu.reset').props.onPress();
  assert.equal(button(draft.render(), 'menu.save').props.disabled, true);
  for (const section of ['profile', 'notifications']) assert.equal(button(screen('MenuSettingsScreen.tsx', section).render(), 'menu.save').props.disabled, true);
  for (const owner of [false, true]) {
    tree = screen('MenuSettingsScreen.tsx', 'security', { owner }).render();
    assert.equal(nodes(tree).filter((n) => n.type === 'Pressable' && text(n).includes('menu.security.closureCopy')).length, owner ? 1 : 0);
    assert.equal(button(tree, 'menu.security.logoutOthers').props.disabled, true);
    assert.equal(button(tree, 'menu.security.submitRequest').props.disabled, true);
  }
  console.log('Menu routes, deferred actions, logout cancellation/concurrency, language save/reset/failure and owner-only closure passed (mocked UI/store, no network).');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
