const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create } = require('zustand');

function load(relative, modules) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, { exports, Date, Error, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    require: name => { assert.ok(name in modules, `Unexpected module: ${name}`); return modules[name]; } });
  return exports;
}

const rejected = {
  applicationId: 7, appNo: 'APP-7', stage: 6, testMode: false, registrationStatus: 'rejected',
  merchantKycStatus: 'locked', accountStatus: 'not_created', currentStep: 4, completionPercent: 100,
  canEdit: false, canSubmit: false, canReapply: true, reviewReason: 'Please correct the company details', initialProperties: [],
};
const reopened = {
  ...rejected, stage: 1, registrationStatus: 'resubmit_required', canEdit: true, canSubmit: true, canReapply: false,
  application: { merchantName: 'Original Hotel', companyName: 'Original Company', companyGroupName: '', regNumber: 'CERT-7',
    country: 'Myanmar', city: 'Yangon', address: '', registrationPhone: '+959123456789', registrationEmail: 'owner@example.test' },
  businesses: [{ applicationBusinessId: 17, clientRef: 'original-business', businessName: 'Original Hotel', businessType: 'hotel',
    countryCode: 'MM', city: 'Yangon', cityKey: 'yangon', address: 'Original Road', contactName: 'Owner',
    contactPhone: '+959123456789', contactEmail: 'owner@example.test' }],
};

function setup({ status = rejected, token = 'original-token', expiresAt = Date.now() + 60000, isLogin = false } = {}) {
  const calls = [], navigation = [], toasts = [], effects = [], savedSessions = [];
  let pendingReopen = async () => reopened;
  let pendingStatus = async () => status;
  let pendingDetail = async () => reopened;
  let pendingRemove = async () => {};
  let focused = true, committedEffects = [];
  let nonce = 0, cursor = 0, slots = [], lastScreen = '';
  const useState = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const common = { getState: () => ({ siteId: 7, setSiteId: async () => {} }), showToast: value => toasts.push(value) };
  const useCommonStore = selector => selector(common);
  useCommonStore.getState = common.getState;
  class ApiError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const apiTypes = load('api/types.ts', {});
  const request = {
    ApiError,
    get: async url => url.endsWith('/status') ? pendingStatus() : pendingDetail(),
    post: async (url, data) => {
      calls.push({ url, data });
      if (url.endsWith('/reopen')) return pendingReopen();
      if (url.endsWith('/otp-verify')) return { registrationToken: 'renewed-token', applicationId: 7, expiresIn: 600 };
      if (url.endsWith('/save')) return { ...reopened, application: { ...reopened.application, ...data.application } };
      if (url.endsWith('/submit')) return { ...rejected, registrationStatus: 'submitted', canReapply: false };
      throw new Error(`Unexpected request ${url}`);
    },
  };
  const modules = {
    react: { ...React, useState, useRef: initial => { const [ref] = useState(() => ({ current: initial })); return ref; },
      useEffect: (effect, deps) => effects.push(Object.assign(effect, { deps })), useCallback: fn => fn },
    'react/jsx-runtime': require('react/jsx-runtime'), zustand: { create },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', StyleSheet: { create: value => value }, Platform: { OS: 'web', select: value => value.web } },
    '@react-navigation/native': { useIsFocused: () => focused, useNavigation: () => ({ navigate: (name, params) => navigation.push({ name, params }), reset: value => navigation.push(value) }), useFocusEffect() {} },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'react-native-safe-area-context': {}, 'expo-status-bar': {}, 'expo-document-picker': {}, 'expo-clipboard': {}, 'expo-camera': {}, 'expo-local-authentication': {}, 'react-native-qrcode-svg': {},
    '@/components/common/PrimaryButton': { __esModule: true, default: 'PrimaryButton' },
    '@/components/onboarding/MerchantFlowComponents': { ResultStatusScreen: 'ResultStatusScreen', WhiteStepScaffold: 'WhiteStepScaffold', AnimatedPopIcon: 'AnimatedPopIcon', IconBubble: 'IconBubble', SimpleIcon: 'SimpleIcon', SelectSheet: 'SelectSheet' },
    '@/components/onboarding/RegistrationForm': Object.fromEntries(['FieldInput', 'FloatingField', 'RegistrationScaffold', 'SelectField', 'PhoneField'].map(name => [name, name])),
    '@/config/theme': { colors: {} }, '@/config/typography': { fonts: {} }, '@/config/env': { ONBOARDING_PROTOTYPE: false, MERCHANT_REGISTRATION_SITE_ID: 7 },
    '@/config/onboardingOptions': { ONBOARDING_BUSINESS_COUNTS: [1], ONBOARDING_BUSINESS_TYPES: ['hotel'], ONBOARDING_CITIES: ['Yangon'] },
    '@/api/request': request, '@/api/types': apiTypes, '@/store/commonStore': { useCommonStore },
    '@/store/merchantStore': { useMerchantStore: selector => selector({ isLogin }) },
    '@/utils/onboardingSession': { readOnboardingSession: async () => null, removeOnboardingSession: () => pendingRemove(), writeOnboardingSession: async value => savedSessions.push(value) },
    '@/utils/sign': { genNonce: () => `business-${++nonce}` }, '@/utils/merchantSession': {}, '@/utils/storage': { storage: { getString: async () => '1' } },
    '@/utils/validate': load('utils/validate.ts', {}),
  };
  modules['@/api/merchant'] = load('api/merchant.ts', modules);
  const { useRegistrationStore: store } = load('store/registrationStore.ts', modules);
  store.setState({ registrationPhone: '+959123456789', registrationEmail: 'owner@example.test', channel: 'email',
    registrationToken: token, tokenExpiresAt: expiresAt, applicationId: 7, status, pinLength: 6 });
  const useRegistrationStore = selector => selector ? selector(store.getState()) : store.getState();
  useRegistrationStore.getState = store.getState;
  modules['@/store/registrationStore'] = { useRegistrationStore };
  const screens = load('screens/onboarding/MerchantFlowScreens.tsx', modules);
  const render = (name = 'RegistrationReviewScreen') => {
    if (lastScreen !== name) { slots = []; lastScreen = name; }
    cursor = 0; effects.length = 0;
    const tree = screens[name]();
    return name.endsWith('ReviewScreen') ? tree.type(tree.props) : tree;
  };
  const renderForm = name => { cursor = 0; slots = []; return load(`screens/auth/${name}.tsx`, modules).default(); };
  const commitEffects = () => {
    committedEffects = effects.map((effect, index) => {
      const previous = committedEffects[index];
      if (previous && effect.deps && effect.deps.length === previous.deps.length && effect.deps.every((value, position) => Object.is(value, previous.deps[position]))) return previous;
      previous?.cleanup?.();
      return { deps: effect.deps, cleanup: effect() };
    });
  };
  const unmount = () => { committedEffects.forEach(effect => effect.cleanup?.()); committedEffects = []; slots = []; lastScreen = ''; };
  return { render, renderForm, effects, calls, navigation, toasts, store, savedSessions, ApiError,
    commitEffects, unmount, setFocused: value => { focused = value; }, removeWith: fn => { pendingRemove = fn; },
    reopenWith: fn => { pendingReopen = fn; }, statusWith: fn => { pendingStatus = fn; }, detailWith: fn => { pendingDetail = fn; } };
}
const flush = () => new Promise(setImmediate);

async function reviewLifecycleRace() {
  // An old Review instance must not write after OTP recovery creates a new Review instance.
  const oldReview = setup();
  let finishOldPoll;
  oldReview.statusWith(() => new Promise(resolve => { finishOldPoll = resolve; }));
  oldReview.render(); oldReview.commitEffects();
  oldReview.unmount();
  oldReview.store.setState({ registrationToken: '' });
  oldReview.detailWith(async () => ({ ...reopened, ...rejected }));
  await oldReview.render('RegisterOtpScreen').props.footer.props.onPress();
  await oldReview.render().props.onButtonPress();
  assert.equal(oldReview.store.getState().status.registrationStatus, 'resubmit_required');
  finishOldPoll(rejected); await flush();
  assert.equal(oldReview.store.getState().status.registrationStatus, 'resubmit_required', 'unmounted Review poll must not overwrite a new instance reopened through OTP');
  assert.equal(oldReview.store.getState().registrationToken, 'renewed-token');

  for (const transition of ['unmount', 'blur', 'token change', 'application change']) {
    const page = setup();
    let finishPoll, pollCalls = 0;
    page.statusWith(() => { pollCalls++; return new Promise(resolve => { finishPoll = resolve; }); });
    page.render(); page.commitEffects();
    const stalePoll = finishPoll;
    if (transition === 'unmount') page.unmount();
    if (transition === 'blur') page.setFocused(false);
    if (transition === 'token change') page.store.setState({ registrationToken: 'renewed-token' });
    if (transition === 'application change') page.store.setState({ applicationId: 8 });
    const currentDetail = { ...reopened, applicationId: transition === 'application change' ? 8 : 7 };
    page.statusWith(async () => { pollCalls++; return currentDetail; });
    if (transition !== 'unmount') { page.render(); page.commitEffects(); }
    if (transition === 'blur') assert.equal(pollCalls, 1, 'an unfocused Review must not start another poll');
    page.store.getState().setApplicationDetail(currentDetail);
    stalePoll(rejected); await flush();
    assert.equal(page.store.getState().status.registrationStatus, 'resubmit_required', `${transition} must invalidate a pending poll`);
    assert.equal(page.store.getState().applicationId, currentDetail.applicationId, `${transition} must preserve the current application`);
  }
  for (const patch of [{ registrationToken: 'renewed-token' }, { applicationId: 8 }]) {
    const page = setup();
    let finishPoll;
    page.statusWith(() => new Promise(resolve => { finishPoll = resolve; }));
    page.render(); page.commitEffects();
    page.store.setState(patch);
    page.store.getState().setApplicationDetail(reopened);
    finishPoll(rejected); await flush();
    assert.equal(page.store.getState().status.registrationStatus, 'resubmit_required', 'identity changes must invalidate a poll before effect cleanup runs');
  }
}

async function competingActionsRace() {
  const page = setup();
  let finishRemoval, removalCalls = 0;
  page.removeWith(() => ++removalCalls === 1 ? new Promise(resolve => { finishRemoval = resolve; }) : Promise.resolve());
  const tree = page.render();
  tree.props.onSecondaryPress();
  await tree.props.onButtonPress();
  tree.props.onSecondaryPress();
  assert.equal(page.calls.length, 0, 'starting another registration must synchronously exclude reopen before session removal resolves');
  assert.equal(removalCalls, 1, 'the secondary action must also exclude duplicate taps');
  assert.equal(page.render().props.buttonDisabled, true, 'session removal disables the primary action');
  finishRemoval(); await flush();
  assert.equal(page.store.getState().registrationToken, '');
  assert.equal(page.store.getState().applicationId, 0);
  assert.equal(page.store.getState().status, null);
  assert.equal(page.navigation.length, 1);
  assert.equal(page.navigation[0].routes[0].name, 'Onboarding');
}

(async () => {
  const raceFailures = [];
  for (const test of [reviewLifecycleRace, competingActionsRace]) {
    try { await test(); } catch (error) { raceFailures.push(test.name); console.error(`${test.name}: ${error.message}`); }
  }
  assert.deepEqual(raceFailures, [], 'review lifecycle and mutually exclusive action regressions');
  // Missing explicit action, wrong payload, dropped original data, or repeated POST must fail this interaction.
  const app = setup();
  let tree = app.render();
  assert.equal(tree.props.buttonLabel, 'flow.review.reapply');
  assert.equal(tree.props.buttonDisabled, false);
  app.effects[0](); await flush();
  assert.equal(app.calls.length, 0, 'reading or refreshing a rejected application must not reopen it');
  let finish;
  app.reopenWith(() => new Promise(resolve => { finish = resolve; }));
  const first = tree.props.onButtonPress();
  const repeated = tree.props.onButtonPress();
  assert.equal(app.calls.length, 1, 'double tap must issue one reopening request');
  assert.equal(app.calls[0].url, '/api/v1/app/merchant/application/reopen');
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls[0].data)), { registrationToken: 'original-token', applicationId: 7 });
  tree = app.render();
  assert.equal(tree.props.buttonDisabled, true, 'reopen disables the main action while pending');
  if (tree.props.onSecondaryPress) await tree.props.onSecondaryPress();
  assert.equal(app.store.getState().registrationToken, 'original-token', 'another-phone action cannot clear an in-flight session');
  finish(reopened); await Promise.all([first, repeated]);
  assert.equal(app.navigation.length, 1);
  assert.equal(app.navigation[0].name, 'Register');
  assert.equal(app.store.getState().companyName, 'Original Company');
  assert.equal(app.store.getState().regNumber, 'CERT-7');
  assert.equal(app.store.getState().businesses[0].applicationBusinessId, 17);
  assert.equal(app.store.getState().registrationToken, 'original-token');
  assert.equal(app.store.getState().applicationId, 7);
  assert.equal(app.store.getState().status.registrationStatus, 'resubmit_required');
  app.store.getState().setCompany({ companyName: 'Corrected Company' });
  await app.renderForm('RegisterScreen').props.footer.props.onPress(); await flush();
  await app.renderForm('RegisterBusinessDetailsScreen').props.footer.props.onPress(); await flush();
  const saves = app.calls.filter(call => call.url.endsWith('/save'));
  assert.equal(saves.length, 2);
  assert.equal(saves[1].data.application.applicationId, 7, 'resubmission keeps the original application');
  assert.equal(saves[1].data.application.companyName, 'Corrected Company');
  assert.equal(saves[1].data.application.businesses[0].applicationBusinessId, 17);
  assert.equal(app.calls.at(-1).url, '/api/v1/app/merchant/application/submit');
  assert.equal(app.store.getState().status.registrationStatus, 'submitted', 'reapplication returns to the existing approval flow');

  // The server capability must be strictly true, and KYC/accounts must retain their original gates.
  for (const [label, options] of [
    ['missing capability', { status: { ...rejected, canReapply: undefined } }],
    ['false capability', { status: { ...rejected, canReapply: false } }],
    ['nonboolean capability', { status: { ...rejected, canReapply: 1 } }],
    ['merchant KYC rejected', { status: { ...rejected, registrationStatus: 'approved', merchantKycStatus: 'rejected' } }],
    ['property KYC rejected', { status: { ...rejected, initialProperties: [{ applicationBusinessId: 17, businessType: 'hotel', kycStatus: 'rejected' }] } }],
    ...['pending_activation', 'active', 'suspended', 'disabled'].map(accountStatus => [accountStatus, { status: { ...rejected, accountStatus } }]),
    ['signed-in account', { isLogin: true }],
  ]) {
    const blocked = setup(options);
    const page = blocked.render();
    assert.notEqual(page.props.buttonLabel, 'flow.review.reapply', label);
    assert.equal(page.props.buttonDisabled, true, label);
    await page.props.onButtonPress();
    assert.equal(blocked.calls.length, 0, label);
  }
  const kyc = setup();
  assert.notEqual(kyc.render('KycReviewScreen').props.buttonLabel, 'flow.review.reapply');
  const pending = setup({ status: { ...rejected, registrationStatus: 'under_review', canReapply: false } });
  assert.equal(pending.render().props.buttonDisabled, true, 'reviewing registration must not enter KYC');
  const approved = setup({ status: { ...rejected, registrationStatus: 'approved', merchantKycStatus: 'draft', canReapply: false } });
  await approved.render().props.onButtonPress();
  assert.equal(approved.navigation[0].name, 'KycDocuments', 'KYC still requires registration approval');

  // Expired/missing OTP sessions recover the original identity, and recovery itself is read-only.
  for (const options of [{ expiresAt: Date.now() - 1 }, { token: '' }]) {
    const expired = setup(options);
    await expired.render().props.onButtonPress();
    assert.equal(expired.calls.length, 0);
    assert.equal(expired.navigation[0].name, 'RegisterVerification');
    assert.equal(expired.store.getState().registrationEmail, 'owner@example.test');
    assert.ok(expired.toasts.includes('flow.review.reverifyIdentity'));
  }
  const missingIdentity = setup({ token: '' });
  missingIdentity.store.setState({ registrationPhone: '', registrationEmail: '' });
  await missingIdentity.render().props.onButtonPress();
  assert.equal(missingIdentity.navigation[0].name, 'RegisterContact');

  const retry = setup();
  retry.reopenWith(async () => { throw new Error('Reopen temporarily unavailable'); });
  await retry.render().props.onButtonPress();
  assert.equal(retry.render().props.buttonDisabled, false);
  assert.equal(retry.navigation.length, 0);
  assert.equal(retry.store.getState().status.registrationStatus, 'rejected');
  assert.ok(retry.toasts.includes('Reopen temporarily unavailable'));
  retry.reopenWith(async () => reopened);
  await retry.render().props.onButtonPress();
  assert.equal(retry.navigation[0].name, 'Register');

  const revoked = setup();
  revoked.reopenWith(async () => { throw new revoked.ApiError(40102, 'Expired'); });
  await revoked.render().props.onButtonPress();
  assert.equal(revoked.navigation[0].name, 'RegisterVerification');

  const otp = setup({ token: '' });
  await otp.render('RegisterOtpScreen').props.footer.props.onPress();
  assert.equal(otp.calls.length, 1);
  assert.equal(otp.calls[0].url, '/api/v1/app/merchant/register/otp-verify');
  assert.equal(otp.savedSessions[0].applicationId, 7);
  assert.equal(otp.store.getState().status.registrationStatus, 'resubmit_required');
  // A rejected detail must go back to review without automatically reopening.
  const recovered = setup({ token: '' });
  recovered.detailWith(async () => ({ ...reopened, ...rejected }));
  await recovered.render('RegisterOtpScreen').props.footer.props.onPress();
  assert.equal(recovered.calls.length, 1);
  assert.equal(recovered.store.getState().status.registrationStatus, 'rejected');
  assert.equal(recovered.navigation[0].routes[0].name, 'RegistrationReview');
  assert.equal(recovered.render().props.buttonLabel, 'flow.review.reapply');
  await recovered.render().props.onButtonPress();
  assert.equal(recovered.calls[1].url, '/api/v1/app/merchant/application/reopen', 'renewed OTP only permits a later explicit reapply');
  assert.equal(recovered.calls[1].data.registrationToken, 'renewed-token');

  const racing = setup();
  let finishRefresh;
  racing.statusWith(() => new Promise(resolve => { finishRefresh = resolve; }));
  tree = racing.render(); racing.effects[0]();
  await tree.props.onButtonPress();
  finishRefresh(rejected); await flush();
  assert.equal(racing.store.getState().status.registrationStatus, 'resubmit_required', 'a stale poll must not overwrite the reopened detail');
  for (const lang of ['en-US', 'zh-CN']) {
    const review = require(`../assets/i18n/${lang}.json`).flow.review;
    for (const key of ['reapply', 'reopening', 'reverifyIdentity', 'reapplyFailed']) assert.ok(review[key], `${lang}: ${key}`);
  }
  console.log('Registration reapply component interactions passed (explicit reopen, original-data resubmit, busy/retry, OTP recovery, KYC/account gates).');
})().catch(error => { console.error(error); process.exitCode = 1; });
