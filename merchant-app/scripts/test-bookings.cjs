const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/screens/bookings/bookingHelpers.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, Intl, Date, Number };
vm.runInNewContext(compiled, context);
const { paymentLabel, bookingNights, bookingDate, bookingMoney, remainingSeconds, hasBookingPermission } = context.exports;

for (const [status, method, label] of [[1, 3, 'unpaid'], [2, 3, 'paid'], [3, 3, 'partial'], [4, 3, 'refunded'], [5, 3, 'failed'], [1, 4, 'hotel'], [5, 4, 'hotel'], [2, 4, 'paid'], [0, 0, 'unknown']]) {
  assert.equal(paymentLabel({ payment_status: status, pay_method: method }), label);
}
assert.equal(bookingNights('2026-12-31', '2027-01-02'), 2);
assert.equal(bookingNights(null, '2027-01-02'), 0);
assert.equal(bookingNights('invalid', '2027-01-02'), 0);
assert.equal(bookingNights('2026-03-07', '2026-03-09'), 2);
assert.equal(bookingDate('2026-10-08', 'en-US'), 'Oct 8, 2026');
assert.equal(bookingMoney('1234.56', 'MMK', 'en-US'), 'MMK 1,234.56');
assert.equal(remainingSeconds('2026-10-08T10:00:00+06:30', Date.parse('2026-10-08T03:29:50Z')), 10);
assert.equal(remainingSeconds('2026-10-08T10:00:00+06:30', Date.parse('2026-10-08T03:31:00Z')), 0);
assert.equal(remainingSeconds(null, Date.now()), null);
assert.equal(remainingSeconds('invalid', Date.now()), null);
assert.equal(hasBookingPermission(null, 'check-out'), false);
assert.equal(hasBookingPermission({ isOwner: true, permissions: [] }, 'check-out'), true);
assert.equal(hasBookingPermission({ isOwner: false, permissions: ['mch:order:detail'] }, 'check-out'), false);

const readLocale = (name) => JSON.parse(fs.readFileSync(path.join(root, `assets/i18n/${name}.json`), 'utf8'));
const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
const en = readLocale('en-US');
const zh = readLocale('zh-CN');
assert.deepEqual(flatten(en).sort(), flatten(zh).sort());
for (const action of ['check-in', 'check-out', 'mark-paid', 'cancel', 'no-show']) {
  assert.ok(en.bookings.action[action]); assert.ok(zh.bookings.confirm[action]);
}
for (const status of [1, 2, 3, 4, 5, 6]) assert.ok(en.bookings.status[status] && zh.bookings.status[status]);
assert.equal(en.bookings.method[1], 'Stripe');
assert.equal(en.bookings.method[2], 'PayPal');
assert.equal(en.bookings.method[3], 'mTrip Wallet');
console.log('Bookings helpers, payment labels, time zones, permissions and bilingual resources passed.');
