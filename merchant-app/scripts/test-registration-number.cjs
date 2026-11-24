const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const React = require('react');

const calls = [];
const navigation = [];
const registration = {
  companyName: 'Example Company', regNumber: 'CERT-123', businessCount: 1, applicationId: 7,
  registrationToken: 'fixture-token', status: { canEdit: true }, removedBusinessIds: [],
  businesses: [{ businessName: 'Example Hotel', businessType: 'hotel', contactName: 'Owner', contactPhone: '+959123456789',
    contactEmail: 'owner@example.test', city: 'Yangon', countryCode: 'MM', cityKey: 'yangon', address: 'Example Road' }],
  setCompany(patch) { Object.assign(this, patch); }, setApplicationDetail() {}, setApplication() {}, prefillBusinessContacts() {},
};
const elementTypes = ['FieldInput', 'FloatingField', 'RegistrationScaffold', 'SelectField', 'PhoneField'];
const modules = {
  react: { ...React, useState: value => [value, () => {}], useCallback: fn => fn },
  'react/jsx-runtime': require('react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x }, Platform: { select: x => x.web } },
  '@react-navigation/native': { useNavigation: () => ({ navigate: x => navigation.push(x), reset: () => navigation.push('reset') }), useFocusEffect() {} },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  '@/components/common/PrimaryButton': { default: 'PrimaryButton', __esModule: true },
  '@/components/onboarding/MerchantFlowComponents': { SelectSheet: 'SelectSheet' },
  '@/components/onboarding/RegistrationForm': Object.fromEntries(elementTypes.map(x => [x, x])),
  '@/config/onboardingOptions': { ONBOARDING_BUSINESS_COUNTS: [1], ONBOARDING_BUSINESS_TYPES: ['hotel'], ONBOARDING_CITIES: ['Yangon'] },
  '@/config/env': { ONBOARDING_PROTOTYPE: false }, '@/config/theme': { colors: {} }, '@/config/typography': { fonts: {} },
  '@/store/commonStore': { useCommonStore: selector => selector({ showToast() {} }) },
  '@/store/registrationStore': { useRegistrationStore: () => registration },
  '@/api/merchant': { apiApplicationSave: async (token, data) => { calls.push(data); return { applicationId: 7 }; }, apiApplicationSubmit: async () => { calls.push('submit'); return {}; } },
  '@/utils/validate': { isEmail: x => x.includes('@'), isMobileNumber: x => x.startsWith('+') },
};
function load(screen) {
  const source = fs.readFileSync(path.join(__dirname, `../src/screens/auth/${screen}.tsx`), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const context = { exports: {}, require: name => { assert.ok(modules[name], name); return modules[name]; } };
  vm.runInNewContext(compiled, context);
  return context.exports.default;
}
function walk(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(walk)];
}
const Company = load('RegisterScreen');
const Business = load('RegisterBusinessDetailsScreen');

(async () => {
  let tree = Company();
  const input = walk(tree).find(x => x.type === 'FieldInput' && x.props.value === 'CERT-123');
  assert.ok(input, 'company screen restores the saved registration number into an input');
  assert.equal(input.props.maxLength, 50);
  input.props.onChangeText('  CERT-456  ');
  tree = Company(); tree.props.footer.props.onPress(); await new Promise(setImmediate);
  assert.equal(calls[0].regNumber, 'CERT-456', 'company step saves a trimmed registration number');
  registration.regNumber = '';
  tree = Company(); tree.props.footer.props.onPress(); await new Promise(setImmediate);
  assert.equal(calls[1].regNumber, '', 'empty registration number can continue');
  registration.regNumber = 'CERT-789';
  tree = Business(); tree.props.footer.props.onPress(); await new Promise(setImmediate);
  assert.equal(calls[2].regNumber, 'CERT-789', 'business step preserves the registration number on final save');
  assert.equal(calls[3], 'submit');
  console.log('Registration number input, restore, optional save and final submit checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
