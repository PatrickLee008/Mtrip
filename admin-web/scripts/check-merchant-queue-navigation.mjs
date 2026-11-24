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
  const script = compileScript(descriptor, { id: 'merchant-queue-navigation' });
  const { outputFiles } = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: src },
    bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
    plugins: [{ name: 'navigation-boundaries', setup(b) {
      b.onResolve({ filter: /^(vue|vue-i18n|vue-router|@ant-design\/icons-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
        path === 'vue' ? `export const {${Object.keys(vue).filter(k => !['onMounted', 'onUnmounted'].includes(k)).join(',')}}=host.vue; export const onMounted=()=>{},onUnmounted=()=>{};` :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
        path === 'vue-router' ? 'export const useRoute=()=>host.route,useRouter=()=>({push:path=>host.navigation.push(path)});' : 'export const EmptyIcon={};',
      }));
      b.onLoad({ filter: /\/stores\/user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>host.user;' }));
      b.onLoad({ filter: /\/api\/merchant\.ts$/ }, () => ({ contents: 'export const apiVerifyQueues=async()=>host.counts;' }));
      b.onLoad({ filter: /\/locales\/menuI18n\.ts$/ }, () => ({ contents: 'export const menuTitle=node=>node.menu_name;' }));
    } }],
  });
  return outputFiles[0].text;
}

const codes = await Promise.all([
  compile(`${src}/components/MerchantVerifyNav.vue`),
  compile(`${src}/layouts/components/SideMenu.vue`),
]);
const queues = ['onboarding', 'pending', 'resubmission', 'approved', 'rejected'];
function fixture(allowed = queues, active = 'onboarding') {
  const host = {
    vue, counts: { onboarding: 7, pending: 4, resubmission: 3, approved: 2, rejected: 1 }, navigation: [],
    route: vue.reactive({ path: `/merchant-verify/${active}` }),
    user: vue.reactive({ menus: [{ id: 200, menu_type: 1, route_path: '/merchant-verify', children: allowed.map(key => ({
      id: queues.indexOf(key) + 201, menu_type: 2, route_path: `/merchant-verify/${key}`, menu_name: key,
    })) }] }),
  };
  const setup = code => {
    const context = vm.createContext({ host, console });
    vm.runInContext(code, context);
    return context.subject.default.setup({ active }, { expose() {} });
  };
  const nav = setup(codes[0]);
  nav.counts.value = host.counts;
  const side = setup(codes[1]);
  side.queueCounts.value = host.counts;
  return { host, nav, side };
}
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0;
async function test(name, run) { await run(); console.log('PASS', name); passed++; }

await test('routine cards and sidebar hide legacy queues without mutating authorized menus', () => {
  const { host, nav, side } = fixture();
  assert.deepEqual(plain(nav.CARDS.value.map(c => c.key)), ['onboarding', 'approved', 'rejected']);
  assert.deepEqual(plain(side.groups.value[0].children.map(c => c.key)), ['/merchant-verify/onboarding', '/merchant-verify/approved', '/merchant-verify/rejected']);
  assert.equal(host.user.menus[0].children.length, 5);
});
await test('hidden queue counts do not inflate normal card totals or sidebar badges', () => {
  const { nav, side } = fixture();
  assert.equal(nav.total.value, 10);
  assert.equal(side.groupBadge(side.groups.value[0]), 7);
});
await test('history links preserve pending and resubmission access only when authorized and nonempty', () => {
  const { nav, host } = fixture(['onboarding', 'pending']);
  assert.deepEqual(plain(nav.legacyQueues.value.map(c => c.key)), ['pending']);
  nav.go('pending'); assert.equal(host.navigation[0], '/merchant-verify/pending');
  nav.counts.value = { pending: 0, resubmission: 8 };
  assert.equal(nav.legacyQueues.value.length, 0);
});
await test('direct legacy routes keep the merchant group active and expanded', () => {
  for (const active of ['pending', 'resubmission']) {
    const { side } = fixture(queues, active);
    assert.equal(side.isGroupActive(side.groups.value[0]), true);
    assert.equal(side.expandedKeys.value.has('/merchant-verify'), true);
  }
});
await test('roles without onboarding cannot see its sidebar count', () => {
  const { side } = fixture(['approved', 'pending']);
  assert.equal(side.groupBadge(side.groups.value[0]), undefined);
});
await test('legacy-only roles can discover authorized old tasks without routine queue menus', () => {
  const { side, host } = fixture(['pending', 'resubmission']);
  const group = side.groups.value[0];
  assert.ok(group);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].label, 'merchant.verifyPage.legacyQueueTasks');
  assert.equal(side.childBadge(group.children[0]), 7);
  assert.equal(side.groupBadge(group), 7);
  side.onChildClick(group.children[0].key);
  assert.equal(host.navigation[0], '/merchant-verify/pending');
  side.queueCounts.value = { pending: 0, resubmission: 0 };
  assert.equal(side.groups.value.length, 0);
});
console.log(`${passed} merchant queue navigation checks passed.`);
