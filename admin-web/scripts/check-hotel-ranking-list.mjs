import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { compileScript, parse } from '@vue/compiler-sfc';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const vue = require('vue');
const file = new URL('../src/views/merchant/ranking/HotelRanking.vue', import.meta.url);
const markets = ['yangon', 'mandalay'].map(city_key => ({ site_id: 2, country_code: 'MM', city_key }));
const listings = Array.from({ length: 23 }, (_, index) => ({
  id: index + 1, property_id: index + 100, property_name: 'Hotel ' + (index + 1),
  pinned: index === 0 ? 1 : 0, featured: index === 1 ? 1 : 0, rank: Math.max(index - 1, 1),
  eligible: index !== 3, status: index === 2 ? 2 : 1,
}));
const data = (list = listings, version = 7) => ({ list, market: { version, published_version: 5 }, published_config: [] });
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function fixture({ api = {}, account = 10, locale = 'en-US', storage = new Map(), options = markets } = {}) {
  assert.ok(existsSync(file), 'hotel tab must provide the simplified ranking workflow');
  const { descriptor } = parse(readFileSync(file, 'utf8'));
  const { content } = compileScript(descriptor, { id: 'ranking-list' });
  const reads = [], writes = [], mounted = [];
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, val) => storage.set(key, val) };
  const deps = {
    vue: { ...vue, onMounted: cb => mounted.push(cb), onBeforeUnmount() {} },
    'vue-i18n': { useI18n: () => ({ t: key => key, locale: vue.ref(locale) }) },
    'vue-router': { useRouter: () => ({ push() {} }) },
    'ant-design-vue': { message: { success() {}, warning() {} } },
    '@/stores/user': { useUserStore: () => ({ isSuper: true, hasPerm: () => true, profile: { id: account } }) },
    '@/api/site': { apiSiteTree: async () => [{ id: 2, site_name: 'Site B', currency: 'MMK' }] },
    '@/api/marketplace': {
      readMarkets: async () => ({ list: options }),
      readMarket: async scope => { reads.push({ ...scope }); return data(); },
      writeMarket: async (...args) => { writes.push(args); }, ...api,
    },
  };
  function execute(source) {
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs' });
    const mod = { exports: {} };
    Function('module', 'require', code)(mod, key => {
      if (key in deps) return deps[key];
      if (key.endsWith('.vue')) return {};
      if (key === '@/composables/useTable') return execute(readFileSync(new URL('../src/composables/useTable.ts', import.meta.url), 'utf8'));
      if (key.startsWith('./')) return execute(readFileSync(new URL(key + '.ts', file), 'utf8'));
      return require(key);
    });
    return mod.exports;
  }
  const state = execute(content).default.setup({}, { expose() {}, emit() {} });
  for (const fn of mounted) fn();
  await settle();
  return { state, reads, writes, storage };
}

test('chooses only an authorized saved market for this account, or the sole market', async () => {
  const { state, storage, reads } = await fixture();
  assert.deepEqual(reads, []);
  await state.selectMarket(state.options.value[1].value);
  assert.equal(reads[0].cityKey, 'mandalay');
  assert.equal((await fixture({ storage })).reads[0].cityKey, 'mandalay');
  assert.deepEqual((await fixture({ account: 11, storage })).reads, []);
  assert.equal((await fixture({ storage, options: markets.slice(0, 1) })).reads[0].cityKey, 'yangon');
});

test('late city responses cannot replace the current list', async () => {
  const old = deferred();
  const { state } = await fixture({ api: { readMarket: scope => scope.cityKey === 'yangon' ? old.promise : data([listings[1]]) } });
  const previous = state.selectMarket(state.options.value[0].value);
  await state.selectMarket(state.options.value[1].value);
  old.resolve(data());
  await previous;
  assert.deepEqual(state.rows.value.map(item => item.id), [2]);
});

test('city rank skips hidden and ineligible rows and survives search, paging and focus', async () => {
  const { state, writes } = await fixture({ options: [markets[0]] });
  assert.deepEqual(state.rows.value.slice(0, 5).map(item => item.cityRank), [1, 2, null, null, 3]);
  state.keyword.value = 'Hotel 23';
  assert.equal(state.filtered.value[0].cityRank, 21);
  assert.equal(state.canDrag.value, false);
  await state.focusHotel(state.rows.value[22]);
  assert.equal(state.filtered.value.length, 23);
  assert.equal(state.focusId.value, 23);
  assert.equal(state.canDrag.value, true);
  await state.reorder(23, 3);
  assert.deepEqual(writes[0][4].ids, [23, ...Array.from({ length: 20 }, (_, i) => i + 3)]);
  await state.reorder(23, 1);
  assert.equal(writes.length, 1);
});

test('draft writes serialize and recover the server version after a conflict', async () => {
  const wait = deferred(), writes = [];
  let version = 7;
  const { state } = await fixture({ options: [markets[0]], api: {
    readMarket: async () => data(listings, version),
    writeMarket: async (...args) => { writes.push(args); if (writes.length === 1) { await wait.promise; version = 12; throw Error('conflict'); } },
  } });
  const first = state.flag(state.rows.value[0], 'pinned');
  await state.flag(state.rows.value[1], 'featured');
  assert.equal(writes.length, 1);
  wait.resolve();
  await first;
  await state.flag(state.rows.value[1], 'featured');
  assert.deepEqual(writes.map(args => [args[2], args[3]]), [[7, ''], [12, '']]);
});

test('add filters out ranked or ineligible properties and live changes require a separate reason', async () => {
  const properties = [{ id: 32, eligible: true, already_ranked: false, display_enabled: 1, mapping_version: 4 },
    { id: 33, eligible: false, already_ranked: false }, { id: 34, eligible: true, already_ranked: true }];
  const { state, writes } = await fixture({ options: [markets[0]], api: { readCandidates: async () => ({ properties }) } });
  await state.openProperties('add');
  assert.deepEqual(state.available.value.map(row => row.id), [32]);
  state.propertyId.value = 32;
  await state.submitProperty();
  await state.openProperties('eligibility');
  assert.deepEqual(state.available.value.map(row => row.id), [32, 33, 34]);
  state.propertyId.value = 32;
  await state.submitProperty();
  assert.equal(writes.length, 1);
  state.reason.value = '  closed for repairs  ';
  await state.submitProperty();
  assert.deepEqual(writes.map(args => [args[0], args[3], args[4]]), [
    ['listing/add', '', { propertyId: 32 }],
    ['property-display', 'closed for repairs', { propertyId: 32, expectedPropertyVersion: 4, displayEnabled: 0 }],
  ]);
});

test('prices use the currency of the cheapest room, including when it differs from the site', async () => {
  const { state } = await fixture({ options: [markets[0]] });
  assert.equal(state.price({ min_price: '125.50', min_price_currency: 'USD' }), 'USD 125.5');
  assert.equal(state.price({ min_price: null }), '—');
});

test('focus from the second page opens all rows and marks the original hotel', async () => {
  const { state } = await fixture({ options: [markets[0]] });
  state.tablePagination.value.onChange(2, 20);
  await settle();
  assert.deepEqual(state.paged.value.map(row => row.cityRank), [19, 20, 21]);
  assert.equal(state.canDrag.value, false);
  await state.focusHotel(state.paged.value[1]);
  assert.equal(state.focusId.value, 22);
  assert.equal(state.fullList.value, true);
});

test('Chinese markets can be found by the localized city or the original city key', async () => {
  const { state } = await fixture({ locale: 'zh-CN' });
  assert.equal(state.options.value[0].city, '仰光');
  assert.equal(state.matchMarket('Yangon', state.options.value[0]), true);
  assert.equal(state.matchMarket('仰光', state.options.value[0]), true);
});

test('list ratings use the same ten-point scale as consumer cards and omit unrated hotels', async () => {
  const { state } = await fixture({ options: markets.slice(0, 1) });
  assert.equal(state.score({ rating: '4.35', review_count: 2 }), '8.7 / 10');
  assert.equal(state.score({ rating: 0, review_count: 0 }), '—');
});

test('changing the live eligibility target requires its own reason', async () => {
  const properties = [5, 6].map(id => ({ id, display_enabled: 1, eligible: true }));
  const { state } = await fixture({ options: [markets[0]], api: { readCandidates: async () => ({ properties }) } });
  await state.openProperties('eligibility');
  state.propertyId.value = 5;
  state.reason.value = 'Hotel five is closed';
  state.propertyId.value = 6;
  assert.equal(state.readyProperty.value, false);
});

test('ranking management buttons share the 50px search bar height', () => {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /class="ranking-management-actions"/);
  assert.match(source, /\.ranking-management-actions[^}]*height:\s*50px/);
  assert.match(source, /\.ranking-management-actions[^}]*\.ant-btn[^}]*height:\s*50px/);
});
