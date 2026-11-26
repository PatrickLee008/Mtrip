import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const { build } = require('esbuild');
const { createI18n } = require('vue-i18n');
const src = fileURLToPath(new URL('../src', import.meta.url));
async function compile(filename) {
  const { descriptor } = parse(readFileSync(`${src}/${filename}`, 'utf8'));
  const script = compileScript(descriptor, { id: 'merchant-detail' });
  const { outputFiles } = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: `${src}/views/merchant/list` },
    bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
    plugins: [{ name: 'merchant-detail-boundaries', setup(b) {
      b.onResolve({ filter: /^(vue|vue-i18n|vue-router|ant-design-vue|@ant-design\/icons-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
        path === 'vue' ? `export const {${Object.keys(vue).filter(key => key !== 'onMounted').join(',')}}=fixtureHost.vue; export const onMounted=()=>{};` :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:(key,params)=>params ? key+JSON.stringify(params) : key});' :
        path === 'vue-router' ? 'export const useRoute=()=>fixtureHost.route, useRouter=()=>fixtureHost.router;' :
        path === '@ant-design/icons-vue' ? 'export const BellOutlined={},LoginOutlined={},EyeOutlined={},DownloadOutlined={},ExclamationCircleOutlined={},CloseOutlined={},CheckCircleOutlined={},ClockCircleOutlined={},CloseCircleOutlined={},FileSearchOutlined={},ReloadOutlined={},SearchOutlined={};' :
        'export const message={success(){},warning(){}}; export const Modal={confirm:options=>fixtureHost.confirm=options};',
      }));
      b.onResolve({ filter: /\.vue$/ }, ({ path }) => ({ path, namespace: 'component' }));
      b.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {};' }));
      b.onLoad({ filter: /\/stores\/user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>fixtureHost.user;' }));
      b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=(...args)=>fixtureHost.request("get",...args),post=(...args)=>fixtureHost.request("post",...args);' }));
    } }],
  });
  return outputFiles[0].text;
}
const page = await compile('views/merchant/list/index.vue');
const security = await compile('components/merchant/AccountSecurityPanel.vue');
const property = await compile('components/merchant/MerchantPropertyPanel.vue');
const reviewQueue = await compile('views/merchant/property-review/index.vue');
function fixture(code, props = {}, query = {}) {
  const host = { vue, calls: [], user: { profile: { isSuper: true } },
    route: vue.reactive({ path: '/merchant/property-review', query }),
    router: { push: target => host.navigation = target, replace: target => host.navigation = target },
    response: [], request: async (method, path, data) => {
      host.calls.push({ method, path, data });
      return host.response;
    } };
  const context = vm.createContext({ fixtureHost: host, console, navigator: {}, crypto: globalThis.crypto });
  vm.runInContext(code, context);
  const state = context.subject.default.setup(props, { expose() {} });
  return { host, state };
}
let passed = 0;
async function test(name, run) { await run(); console.log('PASS', name); passed++; }
function detail(id) {
  return { merchant: { id, merchant_name: `Merchant ${id}` }, accounts: [], admins: [], applications: [], businesses: [], properties: [], group: null, modules: [] };
}

await test('opening another merchant clears the prior profile while loading', async () => {
  const { host, state: s } = fixture(page);
  s.detail.value = { id: 1, merchant_name: 'Previous merchant' };
  let resolve;
  host.request = () => new Promise(done => { resolve = done; });
  const loading = s.openDetail({ id: 2 });
  assert.equal(s.detail.value, null);
  assert.equal(s.detailLoading.value, true);
  resolve(detail(2)); await loading;
  assert.equal(s.detail.value.id, 2);
});
await test('an earlier response cannot replace the latest merchant profile', async () => {
  const { host, state: s } = fixture(page);
  const pending = [];
  host.request = () => new Promise(resolve => pending.push(resolve));
  const first = s.openDetail({ id: 1 }); const second = s.openDetail({ id: 2 });
  pending[1](detail(2)); await second;
  pending[0](detail(1)); await first;
  assert.equal(s.detail.value.id, 2);
});
await test('profile cards use merchant fields and default bank account rather than property data', () => {
  const { state: s } = fixture(page);
  s.detail.value = { id: 9, merchant_name: 'Parent Company', merchant_code: 'MCH-0009', commission_plan: null, commission_rate: 0, contact_email: 'company@example.test' };
  s.detailAccounts.value = [{ bank_name: 'Bank A', account_no: '****1234' }];
  s.detailProperties.value = [{ id: 1, store_name: 'Hotel One' }, { id: 2, store_name: 'Hotel Two' }];
  const fields = s.profileFields.value;
  assert.equal(fields.find(f => f.key === 'merchantId').value, 'MCH-0009');
  assert.equal(fields.find(f => f.key === 'commissionPlan').value, 'merchantDirectory.unconfigured (0%)');
  assert.equal(fields.find(f => f.key === 'bankAccount').value, '****1234');
  assert.equal(fields.find(f => f.key === 'owner').value, '—');
  assert.ok(!fields.some(f => String(f.value).includes('Hotel One')));
});
await test('monthly values preserve zero and distinguish unavailable data', () => {
  const { state: s } = fixture(page);
  assert.equal(s.performanceValue(0, true), '¥0');
  assert.equal(s.performanceValue(0), '0');
  assert.equal(s.performanceValue(null, true), '—');
  assert.equal(s.performanceValue(undefined), '—');
});
await test('security card selection resets only the selected account with its own version', async () => {
  const props = vue.reactive({ merchantId: 9, accessConfigured: true });
  const { host, state: s } = fixture(security, props);
  host.response = [{ id: 1, username: 'owner', account_type: 2, two_fa_status: 1, auth_version: 3 },
    { id: 2, username: 'staff', account_type: 3, two_fa_status: 2, auth_version: 8 }];
  await s.load(); s.selectedId.value = 2;
  assert.equal(s.selectedAccount.value.username, 'staff');
  const loadAccounts = host.request;
  host.request = async (method, path, data) => path.endsWith('/reset-2fa') ? (host.calls.push({ method, path, data }), null) : loadAccounts(method, path, data);
  s.openReset(s.selectedAccount.value); s.reason.value = 'Support request'; s.confirm();
  await host.confirm.onOk();
  const call = host.calls.find(c => c.path.endsWith('/reset-2fa'));
  assert.equal(call.data.merchantId, 9); assert.equal(call.data.accountId, 2); assert.equal(call.data.expectedVersion, 8);
  assert.equal(s.target.value, null);
});
await test('merchant profile cannot initiate a reset for a shared group account', async () => {
  const { host, state: s } = fixture(security, { merchantId: 9, accessConfigured: true });
  host.response = [{ id: 1, username: 'group', account_type: 1, auth_version: 1 }];
  await s.load();
  s.openReset(s.selectedAccount.value);
  assert.equal(s.target.value, null);
});
await test('non-super administrators do not request account security details', async () => {
  const { host, state: s } = fixture(security, { merchantId: 9, accessConfigured: true });
  host.calls = []; host.user.profile.isSuper = false; await s.load();
  assert.equal(host.calls.length, 0); assert.equal(s.selectedAccount.value, undefined);
});
await test('property KYC distinguishes new and legacy application status models', () => {
  const { state: s } = fixture(property, { merchant: { id: 9 }, properties: [], businesses: [], applications: [{ id: 1, state_model_version: 1 }, { id: 2, state_model_version: 0 }] });
  assert.equal(s.businessKycBadge({ application_id: 1, kyc_status: 1 }).text, 'merchant.onboardingPage.kycDraft');
  assert.equal(s.businessKycBadge({ application_id: 1, kyc_status: 5 }).text, 'merchant.onboardingPage.kycVerified');
  assert.equal(s.businessKycBadge({ application_id: 2, kyc_status: 1 }).text, 'merchantDirectory.kyc1');
  assert.equal(s.businessKycBadge({ application_id: 2, kyc_status: 99 }).text, 'merchantDirectory.unknown');
});
await test('queue opens the revision URL and refreshes its filter on return', async () => {
  const { host, state } = fixture(reviewQueue);
  state.reviews.query.keyword = 'Jade';
  await state.openDetail({ id: 83, property_id: 7 });
  assert.equal(host.navigation?.query.revisionId, '83');
  host.route.query = { revisionId: '83' };
  await vue.nextTick();
  assert.equal(state.revisionId.value, 83);
  host.calls = [];
  host.route.query = {};
  await vue.nextTick();
  assert.ok(host.calls.some(call => call.data?.keyword === 'Jade' && call.data?.status === 1));
});
await test('direct review link returns to the selected merchant and business', async () => {
  const { host, state } = fixture(reviewQueue, {}, { revisionId: '83', merchantId: '16', businessId: '45' });
  assert.equal(host.calls.length, 0);
  await state.closeDetail();
  assert.equal(host.navigation.path, '/merchant-verify/approved');
  assert.equal(host.navigation.query.merchantId, '16');
  assert.equal(host.navigation.query.businessId, '45');
});
await test('property review title resolves in both supported languages', async () => {
  const expected = { 'zh-CN': '物业资料审核', 'en-US': 'Property Profile Review' };
  const messages = {};
  for (const locale of Object.keys(expected)) {
    const { outputFiles } = await build({
      entryPoints: [`${src}/locales/${locale}.ts`], bundle: true, write: false, format: 'cjs', alias: { '@': src },
    });
    const module = { exports: {} };
    vm.runInNewContext(outputFiles[0].text, { module });
    messages[locale] = module.exports.default;
  }
  const { global } = createI18n({ legacy: false, fallbackLocale: false, missingWarn: false, messages });
  for (const [locale, title] of Object.entries(expected)) {
    global.locale.value = locale;
    assert.equal(global.t('merchant.propertyReviewPage.title'), title);
  }
});
console.log(`${passed} merchant detail interaction checks passed`);
