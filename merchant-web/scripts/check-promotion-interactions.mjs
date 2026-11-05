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
const apiNames = ['Add', 'Delete', 'Detail', 'Duplicate', 'End', 'List', 'Options', 'Publish', 'Summary', 'ToggleStatus', 'Update'];

async function compile(file) {
  const filename = `${src}/views/promotions/${file}`;
  const { descriptor } = parse(readFileSync(filename, 'utf8'));
  const script = compileScript(descriptor, { id: 'promotion-interactions' });
  const { outputFiles } = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: filename.slice(0, filename.lastIndexOf('/')) },
    bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
    plugins: [{ name: 'isolated-promotion', setup(b) {
      b.onResolve({ filter: /^(vue|vue-i18n|ant-design-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
        path === 'vue' ? 'export const {defineComponent,computed,reactive,ref,watch,nextTick}=h.vue; export const onMounted=fn=>h.mounted.push(fn),onBeforeUnmount=()=>{};' :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
        'export const message=h.message; export const Modal={confirm:options=>h.confirm=options};',
      }));
      b.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {};' }));
      b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=()=>{},post=()=>{};' }));
      b.onLoad({ filter: /\/api\/promotions\.ts$/ }, () => ({ contents:
        'export const PROMOTION_KIND={percentage:1,fixedAmount:2,promoCode:3,longStay:4},DISCOUNT_UNIT={percent:1,amount:2};\n'
        + apiNames.map(name => `export const apiPromotion${name}=(...args)=>h.call('${name}',args);`).join('\n'),
      }));
    } }],
  });
  return outputFiles[0].text;
}
const drawerCode = await compile('components/PromoDrawer.vue');
const pageCode = await compile('index.vue');
const options = () => ({ currency: 'MMK', policy: { configured: true, maxPercent: 80, maxAmount: 80000, minPayablePercent: 20, timezone: 'Asia/Yangon' },
  properties: [{ id: 1, merchant_id: 9, commission_rate: 30 }, { id: 2, merchant_id: 10, commission_rate: 10 }],
  roomTypes: [{ id: 11, property_id: 1, base_price: 100000 }, { id: 22, property_id: 2, base_price: 100000 }] });
function fixture(code = drawerCode, overrides = {}) {
  const h = { vue, mounted: [], calls: [], messages: [], events: [],
    response: async name => name === 'List' ? { list: [], total: 0 } : name === 'Options' ? options() : {},
    call: async (name, args) => { h.calls.push([name, args]); return h.response(name, args); },
  };
  h.message = Object.fromEntries(['success', 'warning'].map(type => [type, key => h.messages.push([type, key])]));
  const props = vue.reactive({ open: true, detail: null, kind: 1, options: options(), saving: false, ...overrides });
  const context = vm.createContext({ h, console, Intl });
  vm.runInContext(code, context);
  const s = context.subject.default.setup(props, { expose() {}, emit: (...args) => h.events.push(args) });
  return { h, s, props };
}
function valid(s) {
  Object.assign(s.form, { couponName: 'Fixture', propertyIds: [1], discountValue: 15,
    validStart: '2027-01-01 09:00:00', validEnd: '2027-02-01 18:30:59' });
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS', name); }

await test('fixed long stay retains amount when moving between type and condition', () => {
  const { s } = fixture(); valid(s);
  s.pickKind(2); s.pickCondition(true); s.form.discountValue = 5000;
  assert.equal(s.form.promotionKind, 4); assert.equal(s.isPercentUnit.value, false);
  s.pickCondition(false); assert.equal(s.form.promotionKind, 2);
  s.pickCondition(true); s.pickKind(1);
  assert.equal(s.form.promotionKind, 4); assert.equal(s.isPercentUnit.value, true);
  s.pickKind(3); assert.equal(s.form.promotionKind, 3);
});
await test('changing a date preserves seconds while changing time preserves the date', () => {
  const { s } = fixture(); valid(s); s.endDate.value = '2027-02-02';
  assert.equal(s.form.validEnd, '2027-02-02 18:30:59');
  s.startTime.value = '10:15'; assert.equal(s.form.validStart, '2027-01-01 10:15:00');
});
await test('invalid schedule and absent policy never emit a save', () => {
  const { h, s, props } = fixture(); valid(s); s.form.validEnd = s.form.validStart; s.submit();
  assert.equal(h.events.length, 0); assert.equal(h.messages.at(-1)[1], 'promotions.validation.dateRange');
  s.form.validEnd = '2027-02-01 18:30:00'; props.options.policy.configured = false; s.submit();
  assert.equal(h.events.length, 0); assert.equal(h.messages.at(-1)[1], 'promotions.validation.policyMissing');
});
await test('merchant commission floor blocks a discount allowed by the percentage cap', () => {
  const { h, s } = fixture(); valid(s); s.form.discountValue = 75; s.submit();
  assert.equal(h.events.length, 0); assert.equal(h.messages.at(-1)[1], 'promotions.validation.limitExceeded');
  s.form.discountValue = 70; s.submit(); assert.equal(h.events[0][0], 'save');
});
await test('protected floor uses official price rather than the minimum-spend threshold', () => {
  const { h, s } = fixture(); valid(s); s.form.discountValue = 75; s.form.minAmount = 200000;
  s.submit(); assert.equal(h.events[0][0], 'save');
});
await test('property changes remove room types outside the selected property', async () => {
  const { s } = fixture(); valid(s); s.form.roomTypeIds = [11]; await vue.nextTick();
  s.form.propertyIds = [2]; await vue.nextTick(); assert.equal(s.form.roomTypeIds.length, 0);
});
await test('saving blocks duplicate emits, type changes and dismissal', () => {
  const { h, s, props } = fixture(); valid(s); props.saving = true;
  s.submit(); s.pickKind(2); s.close(); assert.equal(h.events.length, 0); assert.equal(s.form.promotionKind, 1);
});
await test('list failure is retryable and does not silently look like an empty result', async () => {
  const { h, s } = fixture(pageCode); h.response = async () => { throw new Error('offline'); };
  await s.refreshAll(); assert.equal(s.loadFailed.value, true); assert.equal(s.loading.value, false);
  h.response = async name => name === 'List' ? { list: [{ id: 1 }], total: 1 } : {};
  await s.refreshAll(); assert.equal(s.loadFailed.value, false); assert.equal(s.list.value[0].id, 1);
});
await test('failed saves preserve drawer and draft; only one request is sent', async () => {
  const { h, s } = fixture(pageCode); let fail;
  h.response = () => new Promise((_, reject) => { fail = reject; });
  s.drawerOpen.value = true; const pending = s.persist({ couponName: 'Draft', promotionKind: 1 });
  await s.persist({ couponName: 'Duplicate', promotionKind: 1 }); assert.equal(h.calls.length, 1);
  fail(new Error('policy changed')); await assert.rejects(pending);
  assert.equal(s.saving.value, false); assert.equal(s.drawerOpen.value, true);
});
await test('active edits require claim-protection confirmation before writing', async () => {
  const { h, s } = fixture(pageCode); s.drawerDetail.value = { id: 1, status: 1 }; s.drawerOpen.value = true;
  s.save({ id: 1, promotionKind: 2 }); assert.equal(h.calls.length, 0);
  assert.equal(h.confirm.content, 'promotions.drawer.claimProtection'); await h.confirm.onOk();
  assert.equal(h.calls[0][0], 'Update'); assert.equal(s.drawerOpen.value, false); assert.equal(s.activeKind.value, 2);
});
await test('disable and enable confirmations describe the correct impact', async () => {
  const { h, s } = fixture(pageCode);
  await s.toggle({ id: 1, coupon_name: 'Fixture', status: 1 }); assert.match(h.confirm.content, /confirm.claimImpact/);
  await s.toggle({ id: 1, coupon_name: 'Fixture', status: 2 }); assert.match(h.confirm.content, /drawer.claimProtection/);
  assert.equal(h.calls.length, 0);
});
console.log(`Promotion interactions: ${passed} tests passed`);
