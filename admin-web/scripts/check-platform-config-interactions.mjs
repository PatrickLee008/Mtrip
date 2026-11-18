import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const { build } = require('esbuild');
const src = fileURLToPath(new URL('../src', import.meta.url));
async function compile(filename) {
  const { descriptor } = parse(readFileSync(filename, 'utf8'));
  const script = compileScript(descriptor, { id: 'platform-interactions' });
  const result = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: `${src}/views/config/overview` },
    bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
    plugins: [{ name: 'platform-boundaries', setup(b) {
      b.onResolve({ filter: /^(vue|vue-i18n|vue-router|ant-design-vue|@ant-design\/icons-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
        path === 'vue' ? `export const {${Object.keys(vue).filter(k => !['onMounted','onUnmounted'].includes(k)).join(',')}}=host.vue;export const onMounted=()=>{};export const onUnmounted=()=>{};` :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
        path === 'vue-router' ? 'export const useRoute=()=>host.route,useRouter=()=>({push:target=>host.navigation.push(target)});' :
        path === '@ant-design/icons-vue' ? 'export const ArrowLeftOutlined={},RightOutlined={},SettingOutlined={},TagOutlined={},TeamOutlined={},DollarOutlined={},CreditCardOutlined={},SyncOutlined={},CloseCircleOutlined={},BellOutlined={},MailOutlined={},MessageOutlined={},ThunderboltOutlined={},LinkOutlined={},GlobalOutlined={},ApiOutlined={},ToolOutlined={},NotificationOutlined={},EnvironmentOutlined={},LockOutlined={},ReloadOutlined={},SaveOutlined={},MenuOutlined={};' :
        'export const message={success(){},warning:key=>host.warnings.push(key),info(){},error(){}};',
      }));
      b.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {};' }));
      b.onLoad({ filter: /\/stores\/user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>host.user;' }));
      b.onLoad({ filter: /\/locales\/menuI18n\.ts$/ }, () => ({ contents: 'export const menuTitle=node=>node.menu_name;' }));
      b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=(...args)=>host.request("get",...args),post=(...args)=>host.request("post",...args);' }));
    } }],
  });
  return result.outputFiles[0].text;
}
const settingsCode = await compile(`${src}/views/config/overview/PlatformSettings.vue`);
const overviewCode = await compile(`${src}/views/config/overview/index.vue`);
const templateCode = await compile(`${src}/views/config/overview/TemplateList.vue`);
const sideMenuCode = await compile(`${src}/layouts/components/SideMenu.vue`);
const base = [
  ['platform_name', 'mTrip'], ['platform_logo', ''], ['default_currency', 'MMK'],
  ['default_language', 'en-US'], ['default_timezone', 'Asia/Yangon'], ['customer_service_email', 'support@example.com'],
].map(([config_key, config_value]) => ({ config_key, config_value, value_type: 1 }));
function fixture(code, props = {}) {
  const host = {
    vue, navigation: [], calls: [], warnings: [], permitted: true,
    route: vue.reactive({ path: '/config/overview', query: {} }),
    user: vue.reactive({ menus: [], hasPerm: () => host.permitted }),
    request: async (method, path, data) => {
      host.calls.push({ method, path, data });
      if (host.fail) throw new Error('request failed');
      if (path.endsWith('/kyc-templates') || path.endsWith('/notification/templates')) return [];
      return method === 'get' ? { base } : { updated: 1 };
    },
  };
  const context = vm.createContext({ host, console, Intl, URL });
  vm.runInContext(code, context);
  return { host, s: context.subject.default.setup(props, { expose() {} }) };
}
let count = 0;
async function test(name, run) { await run(); console.log('PASS', name); count++; }
await test('platform settings load actual saved values and save only changed base keys', async () => {
  const { host, s } = fixture(settingsCode);
  await s.load();
  assert.equal(s.form.default_currency, 'MMK');
  s.form.platform_name = 'New platform';
  await s.save();
  const posts = host.calls.filter(c => c.method === 'post');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, '/admin/sys/config/save');
  assert.deepEqual(JSON.parse(JSON.stringify(posts[0].data)), { configs: [{ key: 'platform_name', value: 'New platform' }] });
});
await test('unchanged values and unavailable configuration keys never write', async () => {
  const { host, s } = fixture(settingsCode);
  await s.load(); await s.save();
  s.form.max_hotel_stays = '4'; await s.save();
  assert.equal(host.calls.filter(c => c.method === 'post').length, 0);
});
await test('invalid name, currency, email, logo and timezone stop before any request', async () => {
  for (const [key, value] of [['platform_name', ' '], ['default_currency', 'bad'], ['customer_service_email', 'invalid'], ['platform_logo', 'javascript:alert(1)'], ['default_timezone', 'Unknown/Zone']]) {
    const { host, s } = fixture(settingsCode); await s.load();
    s.form[key] = value; await s.save();
    assert.equal(host.calls.filter(c => c.method === 'post').length, 0, key);
    assert.ok(host.warnings.length, key);
  }
});
await test('permission and failed initial load prevent writes', async () => {
  const { host, s } = fixture(settingsCode); await s.load();
  host.permitted = false; s.form.platform_name = 'Unauthorized'; await s.save();
  assert.equal(host.calls.filter(c => c.method === 'post').length, 0);
  const failed = fixture(settingsCode); failed.host.fail = true; await failed.s.load();
  assert.equal(failed.s.failed.value, true);
  failed.host.fail = false; failed.s.form.platform_name = 'Unknown original'; await failed.s.save();
  assert.equal(failed.host.calls.filter(c => c.method === 'post').length, 0);
});
await test('failed save retains the draft and unlocks retry', async () => {
  const { host, s } = fixture(settingsCode); await s.load();
  s.form.platform_name = 'Retained draft'; host.fail = true; await s.save();
  assert.equal(s.form.platform_name, 'Retained draft'); assert.equal(s.saving.value, false);
  host.fail = false; await s.save();
  assert.equal(host.calls.filter(c => c.method === 'post').length, 2);
});
await test('overview navigation supports section links, return and unknown-section fallback', async () => {
  const { host, s } = fixture(overviewCode);
  assert.equal(s.sectionGroups[0].sections.length, 17);
  s.open(s.sectionGroups[0].sections.find(x => x.key === 'pms'));
  assert.equal(host.navigation[0].query.section, 'pms');
  host.route.query.section = 'pms'; assert.equal(s.selected.value.key, 'pms');
  s.open(); assert.equal(Object.keys(host.navigation[1].query).length, 0);
  host.route.query.section = 'missing'; assert.equal(s.selected.value, undefined);
});
await test('existing configurations retain their read permissions and pending sections never claim connectivity', async () => {
  const { host, s } = fixture(overviewCode); host.permitted = false;
  for (const section of s.sectionGroups[0].sections.filter(x => x.component)) assert.equal(s.allowed(section), false, section.key);
  assert.equal(s.allowed(s.sectionGroups[0].sections.find(x => x.key === 'onboarding')), false);
  assert.equal(s.allowed(s.sectionGroups[0].sections.find(x => x.key === 'notifications')), false);
  for (const key of ['categories', 'pms', 'channel', 'maintenance']) assert.equal(s.state(s.sectionGroups[0].sections.find(x => x.key === key)), 'pending');
});
await test('public KYC card uses its own read permission and connected management page', async () => {
  const { host, s } = fixture(overviewCode); host.permitted = false;
  const section = s.allSections.find(item => item.key === 'onboarding');
  host.user.menus = [{ menu_type: 2, perm_key: 'merchant:onboarding:list' }];
  assert.equal(s.allowed(section), false);
  host.user.menus = [{ menu_type: 2, perm_key: 'config:kyc:list' }];
  assert.equal(s.allowed(section), true); assert.equal(section.component, 'kyc'); assert.equal(s.state(section), 'connected');
  s.open(section); assert.equal(host.navigation.at(-1).query.section, 'onboarding');
  assert.equal(s.state(s.allSections.find(item => item.key === 'notifications')), 'partial');
});
await test('template read failure remains distinguishable from an empty list and retry recovers', async () => {
  const { host, s } = fixture(templateCode, { kind: 'onboarding' });
  await vue.nextTick(); host.fail = true; await s.load();
  assert.equal(s.failed.value, true); assert.equal(s.rows.value.length, 0);
  host.request = async (method, path) => { host.calls.push({ method, path }); return []; };
  await s.load(); assert.equal(s.failed.value, false); assert.equal(s.rows.value.length, 0);
  assert.equal(host.calls.some(c => c.method === 'post'), false);
  assert.equal(s.documents({ docs: '[{"name":"License","required":true}]' })[0].name, 'License');
});
await test('public template display includes only the current site and platform templates for a scoped user', async () => {
  const { host, s } = fixture(templateCode, { kind: 'onboarding' }); await vue.nextTick();
  host.user.profile = { isSuper: false, siteId: 7 };
  host.request = async () => [{ id: 1, site_id: 0 }, { id: 2, site_id: 7 }, { id: 3, site_id: 4 }];
  await s.load(); assert.equal(JSON.stringify(s.rows.value.map(row => row.id)), '[1,2]');
  host.user.profile.isSuper = true; await s.load(); assert.equal(s.rows.value.length, 3);
});
await test('moved system configuration functions are reachable inside platform configuration', async () => {
  const { host, s } = fixture(overviewCode);
  for (const key of ['advanced', 'sites', 'storage', 'payment', 'paymentAccounts', 'permissions', 'filters', 'tax']) {
    const section = (s.allSections ?? []).find(item => item.key === key);
    assert.ok(section, `missing platform entry: ${key}`);
    s.open(section); host.route.query.section = key;
    assert.equal(s.selected.value.key, key);
    assert.equal(host.navigation.at(-1).query.section, key);
  }
  assert.equal(s.sectionGroups[0].sections.find(item => item.key === 'email').component, 'email');
  assert.equal(s.state(s.sectionGroups[0].sections.find(item => item.key === 'email')), 'partial');
  assert.equal(s.state(s.allSections.find(item => item.key === 'tax')), 'pending');
});
await test('read access comes from authorized page menus without granting write or unrelated page access', async () => {
  const { host, s } = fixture(overviewCode); host.permitted = false;
  host.user.menus = [{ id: 1314, menu_type: 2, perm_key: 'config:overview:list', children: [
    { id: 1301, menu_type: 2, perm_key: 'config:global:list' },
    { id: 1305, menu_type: 2, perm_key: 'config:sms:list' },
  ] }];
  assert.equal(s.allowed(s.sectionGroups[0].sections.find(item => item.key === 'platform')), true);
  assert.equal(s.allowed(s.sectionGroups[0].sections.find(item => item.key === 'sms')), true);
  assert.equal(s.allowed(s.sectionGroups[0].sections.find(item => item.key === 'api')), false);
  assert.equal(host.user.hasPerm('config:global:edit'), false);
});
await test('legacy configuration routes highlight the platform root without adding a second sidebar submenu', async () => {
  const { host, s } = fixture(sideMenuCode);
  host.user.menus = [{ id: 1314, menu_type: 2, menu_name: 'Platform Configuration', route_path: '/config/overview', children: [
    { id: 1305, menu_type: 2, route_path: '/config/sms' },
  ] }];
  host.route.path = '/config/sms'; await vue.nextTick();
  const root = s.groups.value[0];
  assert.equal(root.children.length, 0);
  assert.equal(s.isGroupActive(root), true);
  s.onGroupClick(root);
  assert.equal(host.navigation.at(-1), '/config/overview');
});
console.log(`Platform configuration interactions: ${count} tests passed`);
