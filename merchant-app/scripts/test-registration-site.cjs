const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const zustand = require('zustand');

function load(relative, modules, environment = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, { exports, process: { env: environment }, require: (name) => {
    assert.ok(name in modules, `Unexpected module: ${name}`);
    return modules[name];
  } });
  return exports;
}

(async () => {
  const config = load('config/env.ts', {}, { EXPO_PUBLIC_DEFAULT_SITE_ID: '6' });
  const global = load('config/global.ts', {});
  const common = load('store/commonStore.ts', { zustand, '@/config/env': config, '@/config/global': global,
    '@/utils/storage': { storage: { getString: async () => null, setString: async () => {} } } });
  const calls = [];
  const send = async (url) => { calls.push({ url, site: common.useCommonStore.getState().siteId }); return {}; };
  const api = load('api/merchant.ts', { '@/api/request': { get: send, post: send }, '@/config/env': config, '@/store/commonStore': common });
  for (const operation of [() => api.apiRegistrationChannels(), () => api.apiRegistrationOtpSend('phone', 'email', 'sms'),
    () => api.apiRegistrationOtpVerify('phone', 'email', 'sms', '123456')]) {
    await common.useCommonStore.getState().setSiteId(1);
    await operation();
    assert.equal(calls.at(-1).site, 7, 'Registration must use site 7 even with an old cached site or another configured default');
  }
  await common.useCommonStore.getState().setSiteId(6);
  await api.apiMe();
  assert.equal(calls.at(-1).site, 6, 'Existing merchant reads retain their selected site');
  console.log('Registration site routing tests passed (4 scenarios).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
