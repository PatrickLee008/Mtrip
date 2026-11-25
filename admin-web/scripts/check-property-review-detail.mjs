import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileScript, parse } from '@vue/compiler-sfc';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const vue = require('vue');
const page = fileURLToPath(new URL('../src/views/merchant/property-review/PropertyReviewDetail.vue', import.meta.url));
const settle = () => new Promise(done => setImmediate(done));
function response(id, payload, baseline, status = 1) {
  return { revision: { id, status, version: 2, payload }, baseline, effective: { store_name: 'Unrelated current projection' } };
}

async function fixture(fetchDetail, audit = async () => {}) {
  assert.ok(existsSync(page), 'full-page property revision review must be available');
  const { descriptor } = parse(readFileSync(page, 'utf8'));
  const { content } = compileScript(descriptor, { id: 'property-review' });
  const { code } = transformSync(content, { loader: 'ts', format: 'cjs' });
  const events = [];
  const module = { exports: {} };
  const dependencies = {
    vue, 'vue-i18n': { useI18n: () => ({ t: key => key }) },
    'ant-design-vue': { message: { success() {}, warning() {} } },
    '@/api/merchant': { apiMerchantPropertyContentDetail: fetchDetail, apiMerchantPropertyContentAudit: audit },
  };
  Function('module', 'require', code)(module, name => dependencies[name] ?? (name.endsWith('.vue') ? {} : require(name)));
  const props = vue.reactive({ revisionId: 21 });
  const state = module.exports.default.setup(props, { expose() {}, emit: name => events.push(name) });
  await settle();
  return { state, props, events };
}

test('first submission never compares the draft projection as approved', async () => {
  const { state } = await fixture(id => response(id, { store_name: 'New Hotel' }, null));
  assert.equal(state.rows.value.find(row => row.field === 'store_name').before, undefined);
  assert.equal(state.changeCount.value, 0);
});

test('uses the historical baseline for field counts, including cleared and nested values', async () => {
  const { state } = await fixture(id => response(id,
    { store_name: 'Hotel', website: '', hotel_policies: { booking: { payAtHotel: true } },
      amenities: [{ enabled: true, name: 'Pool' }] },
    { store_name: 'Hotel', website: 'https://example.test', hotel_policies: { booking: { payAtHotel: false } },
      amenities: [{ name: 'Pool', enabled: true }] }));
  assert.deepEqual(state.rows.value.filter(row => row.changed).map(row => row.field).sort(), ['booking', 'website']);
});

test('correction needs a reason and applies once to the entire revision', async () => {
  const writes = [];
  const { state, events } = await fixture(id => response(id, {}, null), async data => { writes.push(data); await settle(); });
  state.reason.value = '   ';
  await state.audit(2);
  assert.equal(writes.length, 0);
  state.reason.value = '  Correct the address  ';
  await Promise.all([state.audit(2), state.audit(2)]);
  assert.deepEqual(writes, [{ id: 21, auditStatus: 2, auditRemark: 'Correct the address' }]);
  assert.deepEqual(events, ['reviewed']);
});

test('approval ignores correction notes and historical versions are read-only', async () => {
  for (const status of [0, 1, 2, 3]) {
    const writes = [];
    const { state } = await fixture(id => response(id, {}, null, status), data => writes.push(data));
    state.reason.value = 'unused correction draft';
    await state.audit(1);
    assert.deepEqual(writes, status === 1 ? [{ id: 21, auditStatus: 1, auditRemark: '' }] : []);
  }
});

test('a failed audit refreshes the revision before allowing a second decision', async () => {
  let status = 1;
  const writes = [];
  const { state, events } = await fixture(id => response(id, {}, null, status), async data => {
    writes.push(data); status = 2; throw Error('Already reviewed');
  });
  await state.audit(1);
  await state.audit(1);
  assert.equal(writes.length, 1);
  assert.equal(state.detail.value.revision.status, 2);
  assert.equal(events.length, 0);
});

test('switching revision clears prior review and ignores an outdated detail response', async () => {
  const pending = new Map();
  const { state, props } = await fixture(id => new Promise(resolve => pending.set(id, resolve)));
  props.revisionId = 33;
  await settle();
  pending.get(33)(response(33, { store_name: 'Current request' }, null));
  pending.get(21)(response(21, { store_name: 'Old request' }, null));
  await settle();
  assert.equal(state.detail.value.revision.id, 33);
});

test('a failed detail load can be retried', async () => {
  let failed = true;
  const { state } = await fixture(async id => {
    if (failed) throw Error('Unavailable');
    return response(id, {}, null);
  });
  assert.equal(state.failed.value, true);
  assert.equal(state.detail.value, null);
  failed = false;
  await state.load();
  assert.equal(state.failed.value, false);
  assert.equal(state.detail.value.revision.id, 21);
});

test('complex content renders nested details and previewable media', async () => {
  const file = new URL('../src/views/merchant/property-review/ReviewValue.vue', import.meta.url);
  assert.ok(existsSync(file), 'structured comparison values must be available');
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file.pathname });
  const { content } = compileScript(descriptor, { id: 'value', inlineTemplate: true });
  const { code } = transformSync(content, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} };
  Function('module', 'require', code)(module, name => name === 'vue-i18n'
    ? { useI18n: () => ({ t: key => key.split('.').pop(), te: () => true }) } : require(name));
  const value = [{ id: 'hidden-id', name: 'Stay a week', discount: 12, status: false, image: '/uploads/hotel.jpg' }];
  const app = vue.createSSRApp(module.exports.default, { value, field: 'promotions' });
  app.component('a-image', { props: ['src'], setup: props => () => vue.h('img', { src: props.src }) });
  const html = await require('vue/server-renderer').renderToString(app);
  for (const text of ['Stay a week', '12%', 'no', 'src="/uploads/hotel.jpg"']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /hidden-id|\[object Object\]/);
});

test('legacy decimal strings compare as coordinates while a cleared coordinate is a change', async () => {
  const { state } = await fixture(id => response(id,
    { latitude: 16.8, longitude: null, star_level: 4 },
    { latitude: '16.8000000', longitude: '0.0000000', star_level: '4' }));
  assert.deepEqual(state.rows.value.filter(row => row.changed).map(row => row.field), ['longitude']);
});
