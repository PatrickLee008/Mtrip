const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const compile = (file) => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const validation = { exports: {} };
vm.runInNewContext(compile('src/utils/validate.ts'), validation);
const { normalizeMobile, isMobileNumber, isEmail } = validation.exports;

for (const [raw, country, normalized] of [
  ['137 6861 5461', '86', '+8613768615461'],
  ['+86 137-6861-5461', '86', '+8613768615461'],
  ['09 123 456 789', '95', '+959123456789'],
  ['+95 9 123 456 789', '95', '+959123456789'],
]) {
  assert.equal(normalizeMobile(raw, country), normalized);
  assert.equal(isMobileNumber(normalized, country), true);
}
for (const [raw, country] of [
  ['', '86'], ['12345678', '86'], ['1376861546', '86'], ['137686154611', '86'],
  ['01234567890', '86'], ['013768615461', '86'], ['abc13768615461', '86'],
  ['13768+615461', '86'], ['+959123456789', '86'], ['123456789', '95'],
  ['91234', '95'], ['912345678901', '95'], ['abc9123456789', '95'],
]) assert.equal(isMobileNumber(normalizeMobile(raw, country), country), false, `${country}:${raw}`);
for (const mail of ['229041307@qq.com', ' name+tag@example.com ', 'first.last@example.co.uk']) assert.equal(isEmail(mail), true);
for (const mail of ['', 'name', 'name@', '@example.com', 'a@@example.com', 'a@example',
  'a b@example.com', '.a@example.com', 'a..b@example.com', 'a.@example.com',
  'a@-example.com', 'a@example..com', 'a@example.com.', 'a@example.c', 'a'.repeat(65) + '@example.com']) {
  assert.equal(isEmail(mail), false, mail);
}

// Run the actual Contact Info handler with mocked UI/store; no network requests.
function contactCase(phone, email) {
  const messages = [], contacts = [], routes = [];
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const store = { registrationPhone: phone, registrationEmail: email, setContacts: (...args) => contacts.push(args) };
  const modules = {
    react: { default: React, useState: (initial) => [initial, () => {}] },
    'react-native': { StyleSheet: { create: (style) => style }, View: 'View' },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (route) => routes.push(route) }) },
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '@/components/common/PrimaryButton': { default: 'PrimaryButton' },
    '@/components/onboarding/RegistrationForm': { FieldInput: 'FieldInput', FloatingField: 'FloatingField', RegistrationScaffold: 'RegistrationScaffold', PhoneField: 'PhoneField' },
    '@/store/commonStore': { useCommonStore: (select) => select({ showToast: (message) => messages.push(message) }) },
    '@/store/registrationStore': { useRegistrationStore: (select) => select(store) },
    '@/utils/validate': validation.exports,
  };
  const context = { exports: {}, require: (name) => { assert.ok(modules[name], name); return modules[name]; } };
  vm.runInNewContext(compile('src/screens/auth/RegisterContactScreen.tsx'), context);
  context.exports.default().props.footer.props.onPress();
  return { messages, contacts, routes };
}
for (const [phone, mail, error] of [
  ['', 'valid@example.com', 'phoneRequired'], ['+86123456789', 'valid@example.com', 'invalidPhone'],
  ['+8613768615461', '', 'emailRequired'], ['+8613768615461', 'a@@example.com', 'invalidEmail'],
]) {
  const result = contactCase(phone, mail);
  assert.deepEqual(result.messages, [`validation.${error}`]);
  assert.deepEqual(result.contacts, []);
  assert.deepEqual(result.routes, []);
}
const valid = contactCase('+8613768615461', ' OWNER@EXAMPLE.COM ');
assert.deepEqual(valid.messages, []);
assert.deepEqual(valid.contacts, [['+8613768615461', 'owner@example.com']]);
assert.deepEqual(valid.routes, ['RegisterVerification']);
for (const lang of ['en-US', 'zh-CN']) {
  const locale = JSON.parse(fs.readFileSync(path.join(root, `assets/i18n/${lang}.json`), 'utf8'));
  for (const key of ['phoneRequired', 'invalidPhone', 'emailRequired', 'invalidEmail']) assert.ok(locale.validation[key]);
  assert.ok(locale.register.businessDetails.invalidPhone && locale.register.businessDetails.invalidEmail);
}

async function requestGuards() {
  const screen = fs.readFileSync(path.join(root, 'src/screens/auth/RegisterBusinessDetailsScreen.tsx'), 'utf8');
  const saveHandler = screen.slice(screen.indexOf('  const save = async'), screen.indexOf('\n  return (\n    <RegistrationScaffold', screen.indexOf('  const save = async')));
  const goodCard = { businessName: 'Test', businessType: 'restaurant', contactName: 'Test', contactPhone: '+8613768615461', contactEmail: 'test@example.com', city: 'Yangon' };
  for (const [patch, error, submit] of [
    [{ contactPhone: '+86123' }, 'invalidPhone', true],
    [{ contactEmail: 'a@@example.com' }, 'invalidEmail', true],
    [{ contactEmail: 'invalid' }, 'invalidEmail', false],
    [{ contactPhone: '', contactEmail: '' }, null, false],
  ]) {
    const messages = [], calls = [];
    const registration = { companyName: 'Test', registrationToken: 'mock', setApplicationDetail() {} };
    const context = { registration, cards: [{ ...goodCard, ...patch }], ...validation.exports, ONBOARDING_PROTOTYPE: false,
      t: (key, args) => `${key}:${args?.index}`, showToast: (message) => messages.push(message), setSubmitting() {},
      apiApplicationSave: async () => { calls.push('save'); return {}; }, submit };
    await vm.runInNewContext(ts.transpileModule(saveHandler + '\nsave(submit);', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
    assert.deepEqual(messages, error ? [`register.businessDetails.${error}:1`] : ['register.businessDetails.draftSaved:undefined']);
    assert.deepEqual(calls, error ? [] : ['save']);
  }
  const flow = fs.readFileSync(path.join(root, 'src/screens/onboarding/MerchantFlowScreens.tsx'), 'utf8');
  const sendHandler = flow.slice(flow.indexOf('  const send = async'), flow.indexOf('\n  return <WhiteStepScaffold', flow.indexOf('  const send = async')));
  for (const [phone, email, error] of [
    ['+86123', 'test@example.com', 'invalidPhone'], ['+8613768615461', 'a@@example.com', 'invalidEmail'],
  ]) {
    const messages = [], calls = [];
    const context = { channelAvailable: true, sending: false, ONBOARDING_PROTOTYPE: false, ...validation.exports,
      registration: { registrationPhone: phone, registrationEmail: email }, t: (key) => key,
      showToast: (message) => messages.push(message), setSending() {}, apiRegistrationOtpSend: () => calls.push('send') };
    await vm.runInNewContext(ts.transpileModule(sendHandler + '\nsend();', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
    assert.deepEqual(messages, [`validation.${error}`]);
    assert.deepEqual(calls, []);
  }
  console.log('Phone/email formats, field-specific alerts, navigation, draft and OTP request guards passed (mocked APIs).');
}
requestGuards().catch((error) => { console.error(error); process.exitCode = 1; });
