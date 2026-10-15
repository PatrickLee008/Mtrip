const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

let state;
let nonce = 0;
const modules = {
  zustand: { create: (initialize) => {
    const set = (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
    state = initialize(set);
    return { getState: () => state };
  } },
  '@/api/merchant': { apiApplicationDetail: () => { throw new Error('Unexpected network request'); } },
  '@/api/request': { ApiError: class extends Error {} },
  '@/api/types': { API_CODE: {} },
  '@/store/commonStore': {},
  '@/utils/onboardingSession': { removeOnboardingSession: async () => {} },
  '@/utils/sign': { genNonce: () => `business-${++nonce}` },
};
const source = fs.readFileSync(path.join(__dirname, '../src/store/registrationStore.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compiled, { exports: {}, require: (name) => {
  assert.ok(modules[name], `Unexpected module: ${name}`);
  return modules[name];
}, Date });

state.setContacts('+8613768615461', '229041307@qq.com');
state.setBusinessCount(3);
state.setBusiness(1, { contactPhone: '+959123456789' });
state.setBusiness(2, { contactEmail: 'business@example.com' });
state.prefillBusinessContacts();
assert.equal(state.businesses[0].contactPhone, '+8613768615461');
assert.equal(state.businesses[0].contactEmail, '229041307@qq.com');
assert.equal(state.businesses[1].contactPhone, '+959123456789');
assert.equal(state.businesses[1].contactEmail, '229041307@qq.com');
assert.equal(state.businesses[2].contactPhone, '+8613768615461');
assert.equal(state.businesses[2].contactEmail, 'business@example.com');

// Manual edits survive revisiting the screen; clearing remains possible while editing.
state.setBusiness(0, { contactPhone: '+8613900000000', contactEmail: 'edited@example.com' });
state.prefillBusinessContacts();
assert.equal(state.businesses[0].contactPhone, '+8613900000000');
assert.equal(state.businesses[0].contactEmail, 'edited@example.com');
state.setBusiness(0, { contactEmail: '' });
assert.equal(state.businesses[0].contactEmail, '');

// Company Info saves/restored drafts can replace the cards before screen entry.
state.setApplicationDetail({
  application: { companyName: 'Example', regNumber: '', country: 'Myanmar', address: '' },
  businesses: [{ ...state.businesses[0], contactPhone: '', contactEmail: 'saved@example.com' }],
});
state.prefillBusinessContacts();
assert.equal(state.businesses[0].contactPhone, '+8613768615461');
assert.equal(state.businesses[0].contactEmail, 'saved@example.com');
state.setBusinessCount(2);
state.prefillBusinessContacts();
assert.equal(state.businesses[1].contactPhone, '+8613768615461');
assert.equal(state.businesses[1].contactEmail, '229041307@qq.com');

state.clear();
state.prefillBusinessContacts();
assert.equal(state.businesses[0].contactPhone, '');
assert.equal(state.businesses[0].contactEmail, '');
state.setContacts('+959123456789', 'new@example.com');
state.prefillBusinessContacts();
assert.equal(state.businesses[0].contactPhone, '+959123456789');
assert.equal(state.businesses[0].contactEmail, 'new@example.com');

console.log('Registration business contact autofill tests passed.');
