import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'admin-web/package.json'));
const esbuild = require('esbuild');
const realAxios = require('axios');
let passed = 0;
const token = (realm, changes = {}) => 'header.' + Buffer.from(JSON.stringify({ aud: realm, admin_id: 1, site_id: 1,
  sid: 'session-id', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 1800, ...changes })).toString('base64url') + '.signature';

function locks() {
  let queue = Promise.resolve();
  return { request: (_name, run) => { const next = queue.then(run); queue = next.catch(() => {}); return next; } };
}

async function bundle(app) {
  const realm = app === 'admin-web' ? 'admin' : 'merchant';
  const source = `export * from './src/utils/http'; export * from './src/utils/session'; export * from './src/utils/auth'; export * from './src/router/guard';`;
  const result = await esbuild.build({ stdin: { contents: source, resolveDir: path.join(root, app), loader: 'ts' }, bundle: true,
    format: 'iife', globalName: 'subject', write: false, platform: 'browser', define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE: '/api/v1' }) },
    plugins: [{ name: 'harness', setup(build) {
      build.onResolve({ filter: /^(axios|vue|ant-design-vue|@\/stores\/user|@\/api\/auth|@\/locales.*)$/ }, (args) => ({ path: args.path, namespace: 'mock' }));
      build.onResolve({ filter: /^\.\/dynamic$/ }, () => ({ path: 'dynamic', namespace: 'mock' }));
      build.onResolve({ filter: /^@\// }, (args) => ({ path: path.join(root, app, 'src', args.path.slice(2) + '.ts') }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => {
        const contents = {
          axios: 'export default globalThis.harness.axios;',
          vue: 'export const reactive=x=>x; export const watch=()=>{};',
          'ant-design-vue': 'export const message=globalThis.harness.message;',
          '@/stores/user': 'export const useUserStore=()=>globalThis.harness.user;',
          '@/api/auth': `export const apiMe=()=>globalThis.harness.subject.get('/${realm}/auth/me');`,
          '@/locales/menuI18n': 'export const resolveMenuTitle=()=>"";',
          '@/locales': 'export const i18n={global:{locale:{value:"en-US"}}};',
          dynamic: 'export const installDynamicRoutes=()=>{};',
        }[args.path];
        if (!contents) throw new Error(args.path);
        return { contents, loader: 'js' };
      });
    } }],
  });
  return result.outputFiles[0].text;
}

function context(code, realm, storage = new Map(), lockManager = locks()) {
  const events = new EventTarget();
  const h = { dispatch: async () => ({ code: 0, data: {} }), messages: [], redirects: [], intervals: [], user: null };
  h.message = Object.fromEntries(['warning', 'error'].map((key) => [key, (value) => h.messages.push(value)]));
  h.axios = realAxios.create({ adapter: async (config) => {
    const response = { status: 200, statusText: 'OK', headers: {}, config, data: await h.dispatch(config) };
    if (response.data?.httpStatus) {
      response.status = response.data.httpStatus;
      response.data = response.data.body;
      throw new realAxios.AxiosError('HTTP failure', 'ERR_BAD_RESPONSE', config, null, response);
    }
    return response;
  } });
  h.axios.isCancel = realAxios.isCancel;
  const store = (map) => ({ getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) });
  const window = { parent: null, addEventListener: events.addEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events),
    setInterval: (callback) => h.intervals.push(callback), location: { origin: 'http://127.0.0.1', search: '', pathname: '/editor',
      replace: (url) => h.redirects.push(url), reload: () => h.redirects.push('reload') } };
  window.parent = window;
  const globals = { harness: h, window, document: { hidden: false, addEventListener() {} }, navigator: { locks: lockManager },
    localStorage: store(storage), sessionStorage: store(new Map()), CustomEvent, Blob, URLSearchParams, setTimeout,
    atob: (value) => Buffer.from(value, 'base64').toString('binary'), console };
  vm.createContext(globals);
  vm.runInContext(code, globals);
  const subject = globals.subject;
  h.subject = subject;
  h.user = { profile: null, routesLoaded: false, token: '', isLogin: true, $reset: () => { throw new Error('Must not clear login on temporary failure'); },
    loadMenus: () => subject.get(`/${realm}/auth/menus`), selectProperty() {} };
  return { ...h, globals, subject, h };
}

async function test(label, run) {
  await run(); ++passed; console.log('PASS', label);
}

for (const [app, realm] of [['admin-web', 'admin'], ['merchant-web', 'merchant']]) {
  const code = await bundle(app);
  await test(realm + ': concurrent expired requests share one refresh', async () => {
    const { subject: s, h } = context(code, realm);
    s.setToken(token(realm, { exp: Math.floor(Date.now() / 1000) - 1 }));
    let refreshes = 0; let writes = 0;
    h.dispatch = async (config) => {
      if (config.url.endsWith('/auth/refresh')) {
        ++refreshes; await new Promise((resolve) => setTimeout(resolve, 5));
        return { code: 0, data: { token: token(realm), admin: { permissions: [] } } };
      }
      ++writes; return { code: 0, data: 'saved' };
    };
    await Promise.all(Array.from({ length: 8 }, () => s.post(`/${realm}/order/save`, { text: 'draft' })));
    assert.equal(refreshes, 1); assert.equal(writes, 8); assert.equal(s.sessionState.expired, false);
  });
  await test(realm + ': response-time expiry retries a write once after authentication', async () => {
    const { subject: s, h } = context(code, realm);
    const old = token(realm); s.setToken(old);
    let refreshes = 0; let attempts = 0; let committed = 0;
    h.dispatch = async (config) => {
      if (config.url.endsWith('/auth/refresh')) {
        ++refreshes; return { code: 0, data: { token: token(realm, { jti: 'new' }), admin: { permissions: [] } } };
      }
      ++attempts;
      if (config.headers.Authorization === 'Bearer ' + old) return { httpStatus: 401, body: { code: 40102, message: 'expired' } };
      ++committed; return { code: 0, data: true };
    };
    await s.post(`/${realm}/order/save`, { text: 'draft' });
    assert.equal(refreshes, 1); assert.equal(attempts, 2); assert.equal(committed, 1);
  });
  await test(realm + ': downloads use the same refresh and replay handling', async () => {
    const { subject: s, h } = context(code, realm); const old = token(realm); s.setToken(old);
    h.dispatch = async (config) => {
      if (config.url.endsWith('/auth/refresh')) return { code: 0, data: { token: token(realm, { jti: 'download' }), admin: { permissions: [] } } };
      if (config.headers.Authorization === 'Bearer ' + old) return new Blob([JSON.stringify({ code: 40102, message: 'expired' })], { type: 'application/json' });
      return new Blob(['csv'], { type: 'text/csv' });
    };
    const response = await s.requestBlob({ url: `/${realm}/order/export`, method: 'GET' });
    assert.equal(await response.data.text(), 'csv');
  });
  for (const code of [42901, 50001, 40301]) {
    await test(realm + ': business error ' + code + ' preserves login', async () => {
      const { subject: s, h } = context(await bundle(app), realm); const original = token(realm); s.setToken(original);
      h.dispatch = async () => ({ code, message: 'temporary or forbidden' });
      await assert.rejects(() => s.get(`/${realm}/order/list`));
      assert.equal(s.getToken(), original); assert.equal(s.sessionState.expired, false); assert.equal(h.redirects.length, 0);
    });
  }
  await test(realm + ': temporary bootstrap failure retains route and authentication', async () => {
    const { subject: s, h } = context(code, realm); const original = token(realm); s.setToken(original);
    h.dispatch = async () => ({ httpStatus: 500, body: { code: 50001, message: 'temporary' } });
    let before;
    s.setupRouterGuard({ beforeEach: (fn) => { before = fn; }, afterEach() {} });
    assert.equal(await before({ meta: {}, path: '/editor', fullPath: '/editor?draft=7' }), false);
    assert.equal(s.sessionState.recoveryFailed, true); assert.equal(s.sessionState.recoveryPath, '/editor?draft=7');
    assert.equal(s.getToken(), original); assert.equal(h.redirects.length, 0);
  });
  await test(realm + ': refresh network failure retains the token and the page', async () => {
    const { subject: s, h } = context(code, realm); const original = token(realm, { exp: 1 }); s.setToken(original);
    h.dispatch = async () => { throw new Error('Network Error'); };
    await assert.rejects(() => s.ensureSession());
    assert.equal(s.getToken(), original); assert.equal(s.sessionState.expired, false); assert.equal(h.redirects.length, 0);
  });
  await test(realm + ': revoked refresh opens reauthentication without unloading the page', async () => {
    const { subject: s, h } = context(code, realm); s.setToken(token(realm, { exp: 1 }));
    h.dispatch = async () => ({ httpStatus: 401, body: { code: 40101, message: 'revoked' } });
    await assert.rejects(() => s.ensureSession());
    assert.equal(s.sessionState.expired, true); assert.equal(h.redirects.length, 0);
  });
  await test(realm + ': login credential errors do not expire an existing page', async () => {
    const { subject: s, h } = context(code, realm); s.setToken(token(realm));
    h.dispatch = async () => ({ httpStatus: 401, body: { code: 40101, message: 'wrong password' } });
    await assert.rejects(() => s.post(`/${realm}/auth/login`, {})); assert.equal(s.sessionState.expired, false);
  });
  await test(realm + ': refresh cannot switch the page to a different account', async () => {
    const { subject: s, h } = context(code, realm); const original = token(realm, { exp: 1 }); s.setToken(original);
    h.dispatch = async () => ({ code: 0, data: { token: token(realm, { admin_id: 2 }), admin: { permissions: [] } } });
    await assert.rejects(() => s.ensureSession()); assert.equal(s.getToken(), original); assert.equal(s.sessionState.expired, true);
  });
  await test(realm + ': logout during refresh cannot resurrect local credentials', async () => {
    const { subject: s, h } = context(code, realm); s.setToken(token(realm, { exp: 1 }));
    h.dispatch = async () => { s.clearAuth(); return { code: 0, data: { token: token(realm), admin: { permissions: [] } } }; };
    await s.ensureSession(); assert.equal(s.getToken(), '');
  });
  await test(realm + ': tabs coordinate refresh through Web Locks and shared storage', async () => {
    const storage = new Map(); const lock = locks();
    const first = context(code, realm, storage, lock); const second = context(code, realm, storage, lock);
    first.subject.setToken(token(realm, { exp: 1 })); let count = 0;
    first.h.dispatch = second.h.dispatch = async () => {
      ++count; await new Promise((resolve) => setTimeout(resolve, 5));
      return { code: 0, data: { token: token(realm), admin: { permissions: [] } } };
    };
    await Promise.all([first.subject.ensureSession(), second.subject.ensureSession()]); assert.equal(count, 1);
  });
  await test(realm + ': iframe login is allowed even while a stale token exists', async () => {
    const { subject: s } = context(code, realm); let before;
    s.setupRouterGuard({ beforeEach: (fn) => { before = fn; }, afterEach() {} });
    assert.equal(await before({ meta: { public: true }, path: '/login', query: { reauth: '1' } }), true);
  });
  if (realm === 'merchant') await test('support: expiry never refreshes or clears the ordinary merchant session', async () => {
    const { subject: s, h, globals } = context(code, realm); const ordinary = token(realm); s.setToken(ordinary);
    globals.sessionStorage.setItem('mtrip_merchant_support_token', token(realm, { impersonation_session_id: 1, sid: undefined, exp: 1 }));
    let refreshes = 0; h.dispatch = async () => { ++refreshes; return { code: 0 }; };
    await s.ensureSession(true); s.expireSession();
    assert.equal(refreshes, 0); assert.equal(globals.localStorage.getItem('mtrip_merchant_token'), ordinary);
    assert.equal(h.redirects[0], '/support-session');
  });
}
console.log('PASS_COUNT=' + passed);
