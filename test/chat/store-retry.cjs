const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const requireWeb = createRequire(path.resolve(__dirname, '../../merchant-web/package.json'));
const ts = requireWeb('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../merchant-web/src/stores/chat.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
class BizError extends Error { constructor(code) { super('Denied'); this.code = code; } }
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };

function setup(failures = {}) {
  const timers = new Map();
  const sockets = [];
  const calls = { ticket: 0 };
  let nextTimer = 0;
  const result = (key, value) => failures[key] instanceof Promise ? failures[key]
    : failures[key] ? Promise.reject(failures[key]) : Promise.resolve(value);
  const modules = {
    pinia: { defineStore: (_, factory) => factory },
    vue: { ref: value => ({ value }) },
    '@/utils/http': { BizError },
    '@/stores/user': { useUserStore: () => ({ profile: { id: 1 } }) },
    'ant-design-vue': { message: { info() {} } },
    '@/locales': { i18n: { global: { t: key => key } } },
    '@/api/chat': {
      chatSummary: () => result('summary', { unread: 1 }),
      chatPreferences: () => result('preferences', { inapp_enabled: true, sound_enabled: false }),
      chatAction: () => { calls.ticket++; return result('ticket', { ticket: 'fixture' }); },
      chatUrl: () => 'http://localhost/socket',
    },
  };
  const context = {
    exports: {}, require: name => { assert.ok(modules[name], name); return modules[name]; },
    setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval() {},
    WebSocket: class { constructor() { sockets.push(this); } close() { this.onclose?.({ code: 1000 }); } },
  };
  vm.runInNewContext(compiled, context);
  return { store: context.exports.useChatStore(), timers, sockets, calls, failures };
}

(async () => {
  for (const code of [40101, 40102, 40301, 40302]) {
    const qa = setup({ ticket: new BizError(code) });
    qa.store.start(); await flush();
    assert.equal(qa.timers.size, 0, `terminal ${code} must not retry`);
    console.log('PASS terminal ticket error stops retries', code);
  }
  for (const endpoint of ['summary', 'preferences']) {
    const qa = setup({ [endpoint]: new BizError(40302) });
    qa.store.start(); await flush();
    assert.equal(qa.timers.size, 0);
    assert.equal(qa.store.connected.value, false);
    assert.equal(qa.sockets.length, 0);
    console.log('PASS authorization failure cancels chat startup', endpoint);
  }
  const transient = setup({ ticket: new Error('Network Error') });
  transient.store.start(); await flush();
  assert.equal(transient.timers.size, 1);
  const retry = transient.timers.values().next().value;
  transient.timers.clear(); delete transient.failures.ticket; retry(); await flush();
  assert.equal(transient.calls.ticket, 2);
  assert.equal(transient.sockets.length, 1);
  console.log('PASS transient failure retries and recovers');
  const stopped = setup({ ticket: new Error('Network Error') });
  stopped.store.start(); await flush();
  const cancelledRetry = stopped.timers.values().next().value;
  stopped.store.stop(); cancelledRetry(); await flush();
  assert.equal(stopped.timers.size, 0);
  assert.equal(stopped.calls.ticket, 1);
  console.log('PASS stopping chat clears pending reconnect');
  const recovered = setup({ ticket: new BizError(40302) });
  recovered.store.start(); await flush();
  delete recovered.failures.ticket; recovered.store.start(); await flush();
  assert.equal(recovered.sockets.length, 1);
  console.log('PASS switching context can restart chat after access denial');
  let denyOldRequest;
  const stale = setup({ ticket: new Promise((_, reject) => { denyOldRequest = reject; }) });
  stale.store.start(); await flush();
  delete stale.failures.ticket; stale.store.start(); await flush();
  denyOldRequest(new BizError(40302)); await flush();
  assert.equal(stale.sockets.length, 1);
  assert.equal(typeof stale.sockets[0].onclose, 'function');
  assert.equal(stale.timers.size, 0);
  console.log('PASS old context denial does not stop current connection');
})().catch(error => { console.error(error); process.exitCode = 1; });
