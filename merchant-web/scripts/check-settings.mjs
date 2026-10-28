import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const esbuild = require('esbuild');
const filename = fileURLToPath(new URL('../src/views/settings/index.vue', import.meta.url));
const { descriptor } = parse(readFileSync(filename, 'utf8'));
const script = compileScript(descriptor, { id: 'settings-test' });
const apiNames = ['apiUpdatePassword', 'apiContacts', 'apiContactSend', 'apiContactVerify', 'apiRebindStart', 'apiRebindNew', 'apiRebindFinish'];
const { outputFiles } = await esbuild.build({
  stdin: { contents: script.content, loader: 'ts', resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'subject',
  plugins: [{ name: 'isolated-settings', setup(build) {
    build.onResolve({ filter: /.*/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents:
      path === 'vue' ? 'export const {defineComponent,computed,reactive,ref,watch}=h.vue; export const onMounted=fn=>h.mounted.push(fn);' :
      path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key,locale:h.locale});' :
      path === 'ant-design-vue' ? 'export const message=h.message; export const Modal={confirm:options=>h.confirm=options};' :
      path === '@ant-design/icons-vue' ? 'export const BellOutlined={},CheckCircleOutlined={},DesktopOutlined={},GlobalOutlined={},LockOutlined={},SafetyCertificateOutlined={},UserOutlined={};' :
      path === '@/api/auth' ? apiNames.map(name => `export const ${name}=(...args)=>h.call('${name}',args);`).join('\n') :
      path === '@/stores/user' ? 'export const useUserStore=()=>h.user;' :
      path === '@/utils/auth' ? 'export const clearAuth=()=>h.cleared=true;' :
      path === '@/locales/preferences' ? 'export const LOCALE_KEY="mtrip_merchant_locale";' :
      path === '@/locales' ? 'export const SUPPORTED_LOCALES=[{key:"en-US",label:"English"},{key:"zh-CN",label:"中文"}];' :
      path === '@/components/PageContainer.vue' ? 'export default {};' : (() => { throw new Error(path); })(),
    }));
  } }],
});

function fixture(profile = {}) {
  const h = { vue, mounted: [], calls: [], messages: [], storage: new Map(), locale: vue.ref('en-US'), cleared: false,
    user: vue.reactive({ isOwner: true, accountType: 2, profile: { subjectName: 'Fixture company', ...profile }, logout: async () => h.calls.push(['logout', []]) }),
    response: async name => name === 'apiContacts' || name === 'apiContactVerify' ? { contacts: [{channel:'email',recipient:'f***@example.com',status:'verified'}], testMode:false } : { challengeToken:'fixture-token' },
    call: async (name, args) => { h.calls.push([name, args]); return h.response(name, args); },
  };
  h.message = Object.fromEntries(['success', 'warning'].map(type => [type, key => h.messages.push([type, key])]));
  const context = vm.createContext({ h, console, Intl, window: { location: { href: '/settings' } }, localStorage: { setItem: (key, value) => h.storage.set(key, value) } });
  vm.runInContext(outputFiles[0].text, context);
  const s = context.subject.default.setup({}, { expose() {} });
  return { h, s, location: context.window.location };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS', name); }

await test('only a merchant owner loads login contacts', async () => {
  for (const changes of [{isOwner:false}, {accountType:1}, {accountType:3}, {profile:{impersonation:{}}}]) {
    const {h,s} = fixture(); Object.assign(h.user, changes); await s.loadContacts(); assert.equal(h.calls.length, 0);
  }
  const {h,s} = fixture(); await h.mounted[0](); assert.equal(h.calls[0][0], 'apiContacts'); assert.equal(s.contactValue('email'), 'f***@example.com');
});
await test('contact loading failure can be retried without a false success', async () => {
  const {h,s} = fixture(); h.response = async () => { throw new Error('unavailable'); }; await s.loadContacts();
  assert.equal(s.contactsFailed.value, true); assert.equal(s.contactsLoading.value, false);
  h.response = async () => ({contacts:[],testMode:false}); await s.loadContacts(); assert.equal(s.contactsFailed.value, false);
});
await test('language drafts reset without applying or storing a change', () => {
  const {h,s} = fixture(); s.languageDraft.value = 'zh-CN'; assert.equal(h.locale.value, 'en-US'); s.resetLanguage();
  assert.equal(s.languageDraft.value, 'en-US'); assert.equal(h.storage.size, 0); assert.equal(h.calls.length, 0);
});
await test('saving language uses the existing browser key and no business API', async () => {
  const {h,s} = fixture(); s.languageDraft.value = 'zh-CN'; s.saveLanguage();
  assert.equal(h.locale.value, 'zh-CN'); assert.equal(h.storage.get('mtrip_merchant_locale'), 'zh-CN'); assert.equal(h.calls.length, 0);
  await vue.nextTick();
  h.locale.value = 'en-US'; await vue.nextTick(); assert.equal(s.languageDraft.value, 'en-US');
});
await test('invalid passwords never reach the password endpoint', async () => {
  const {h,s} = fixture();
  for (const form of [{}, {oldPassword:'old',newPassword:'short1',confirmPassword:'short1'}, {oldPassword:'old',newPassword:'abcdefgh',confirmPassword:'abcdefgh'}, {oldPassword:'old',newPassword:'ValidPass1',confirmPassword:'different'}]) {
    Object.assign(s.passwordForm, {oldPassword:'',newPassword:'',confirmPassword:''}, form); await s.submitPassword();
  }
  assert.equal(h.calls.length, 0);
});
await test('password request is single flight and failed changes preserve login and draft', async () => {
  const {h,s,location} = fixture(); let reject;
  h.response = () => new Promise((_, fail) => { reject = fail; });
  Object.assign(s.passwordForm, {oldPassword:'old',newPassword:'ValidPass1',confirmPassword:'ValidPass1'});
  const pending = s.submitPassword(); await s.submitPassword(); assert.equal(h.calls.length, 1);
  reject(new Error('wrong old password')); await assert.rejects(pending);
  assert.equal(s.passwordSaving.value, false); assert.equal(location.href, '/settings'); assert.equal(s.passwordForm.newPassword, 'ValidPass1');
});
await test('successful password change signs out before returning to login', async () => {
  const {h,s,location} = fixture(); Object.assign(s.passwordForm, {oldPassword:'old',newPassword:'ValidPass1',confirmPassword:'ValidPass1'});
  await s.submitPassword(); assert.deepEqual(h.calls.map(([name])=>name), ['apiUpdatePassword','logout']); assert.equal(location.href, '/login');
});
await test('verification validates the code then refreshes returned contact state', async () => {
  const {h,s} = fixture(); await s.openContact('sms','verify'); assert.equal(s.contactDialog.value, true);
  s.contactForm.code='123'; await s.submitContact(); assert.equal(h.calls.length, 1);
  s.contactForm.code='123456'; await s.submitContact();
  assert.deepEqual(Array.from(h.calls[1][1]), ['fixture-token','123456']); assert.equal(s.contactDialog.value, false); assert.equal(s.verifiedContacts.value.length, 1);
});
await test('contact rebinding keeps TOTP, old OTP and new OTP as separate steps', async () => {
  const {h,s,location} = fixture(); await s.openContact('sms','rebind'); s.contactForm.totp='123456'; await s.submitContact();
  assert.equal(s.contactForm.step, 1); s.contactForm.code='234567'; s.contactForm.value='+959123456789'; await s.submitContact();
  assert.equal(s.contactForm.step, 2); assert.equal(s.contactForm.code, ''); s.contactForm.code='345678'; await s.submitContact();
  assert.deepEqual(h.calls.map(([name])=>name), ['apiRebindStart','apiRebindNew','apiRebindFinish']);
  assert.deepEqual(Array.from(h.calls[1][1]), ['fixture-token','234567','sms','+959123456789']); assert.equal(h.cleared, true); assert.equal(location.href, '/login');
});
await test('opening logout confirmation does not log out until confirmed', async () => {
  const {h,s,location} = fixture(); s.confirmLogout(); assert.equal(h.calls.length, 0); assert.equal(location.href, '/settings');
  await h.confirm.onOk(); assert.equal(h.calls[0][0], 'logout'); assert.equal(location.href, '/login');
});
console.log(`Settings: ${passed} tests passed`);
