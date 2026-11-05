import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src', import.meta.url));
const { outputFiles } = await build({
  entryPoints: [`${root}/views/promotions/helpers.ts`], bundle: true, write: false,
  format: 'esm', alias: { '@': root },
  plugins: [{ name: 'no-http', setup(b) {
    b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=()=>{},post=()=>{};' }));
  } }],
});
const h = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS', name); }
const valid = () => ({ ...h.defaultForm(), couponName: 'Weekend', propertyIds: [1],
  validStart: '2027-01-01 09:00:00', validEnd: '2027-01-02 18:30:00' });

test('reversed and equal schedule timestamps cannot be saved', () => {
  for (const validEnd of ['2026-12-31 18:30:00', '2027-01-01 08:59:00', '2027-01-01 09:00:00']) {
    assert.equal(h.validateForm({ ...valid(), validEnd }), 'promotions.validation.dateRange');
  }
  assert.equal(h.validateForm(valid()), '');
});
test('NaN and infinite discounts cannot be saved', () => {
  for (const discountValue of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.equal(h.validateForm({ ...valid(), discountValue }), 'promotions.validation.discount');
  }
});
test('long stay upper bound and usage limit are validated', () => {
  assert.equal(h.validateForm({ ...valid(), promotionKind: 4, minNights: 5, maxNights: 3 }), 'promotions.validation.maxNights');
  for (const totalCount of [0, -1, 1.5]) {
    assert.equal(h.validateForm({ ...valid(), totalCount }), 'promotions.validation.usageLimit');
  }
  assert.equal(h.validateForm({ ...valid(), limitTotal: false, totalCount: 0 }), '');
});
test('editing retains timestamp precision, financial rules and relative validity', () => {
  const row = { id: 1, merchant_id: 2, promotion_kind: 3, coupon_type: 2, discount_percent_off: 15,
    coupon_name: 'Code', promo_code: 'CODE', valid_type: 2, valid_days: 14,
    valid_start: null, valid_end: null, property_ids: [1], room_type_ids: [2], total_count: 100,
    min_amount: 50000, max_discount: 20000, per_user_limit: 2 };
  const payload = h.formToPayload(h.formFromDetail(row));
  assert.equal(payload.validType, 2); assert.equal(payload.validDays, 14);
  assert.equal(payload.maxDiscount, 20000); assert.equal(payload.minAmount, 50000);
  assert.equal(h.formToPayload(valid()).validEnd, '2027-01-02 18:30:00');
});
test('lifecycle separates drafts, enabled schedules, pauses and expiry', () => {
  const now = new Date(2027, 0, 1, 12).getTime();
  const row = { status: 1, valid_type: 1, valid_start: '2027-01-02 00:00:00', valid_end: '2027-01-03 00:00:00' };
  assert.equal(h.lifecycleKey({ ...row, status: 0 }, now), 'draft');
  assert.equal(h.lifecycleKey(row, now), 'upcoming');
  assert.equal(h.lifecycleKey({ ...row, valid_start: '2027-01-01 00:00:00' }, now), 'active');
  assert.equal(h.lifecycleKey({ ...row, status: 2 }, now), 'paused');
  assert.equal(h.lifecycleKey({ ...row, status: 3 }, now), 'ended');
  assert.equal(h.lifecycleKey({ ...row, valid_end: '2026-12-31 23:59:59' }, now), 'expired');
});
test('multiple property targets show names instead of database IDs', () => {
  assert.equal(h.targetText({ property_ids: [7, 8], room_type_ids: [] }, { 7: 'Hotel A', 8: 'Hotel B' }, {}), 'Hotel A +1');
});
test('new saves require explicit dates and reject lifetime and relative schedules', () => {
  assert.equal(h.validateForm({ ...valid(), noExpiry: true }), 'promotions.validation.fixedSchedule');
  assert.equal(h.validateForm({ ...valid(), validType: 2 }), 'promotions.validation.fixedSchedule');
  assert.equal(h.validateForm({ ...valid(), validEnd: '' }), 'promotions.validation.end');
});
test('server lifecycle remains authoritative across browser timezones', () => {
  assert.equal(h.lifecycleKey({ status: 1, valid_type: 1, valid_start: '2027-01-02 00:00:00', valid_end: null, lifecycle_status: 'active' }, 0), 'active');
});
test('fixed long stay roundtrip preserves amount and minimum nights', () => {
  const payload = h.formToPayload(h.formFromDetail({ promotion_kind: 4, coupon_type: 1,
    discount_value: 5000, min_nights: 3, coupon_name: 'Long stay', property_ids: [1], room_type_ids: [],
    status: 2, valid_type: 1, valid_start: '2027-01-01 00:00:00', valid_end: '2027-01-31 23:59:59' }));
  assert.equal(payload.discountUnit, 2); assert.equal(payload.discountValue, 5000); assert.equal(payload.minNights, 3);
});
console.log(`Promotion rules: ${passed} tests passed`);
