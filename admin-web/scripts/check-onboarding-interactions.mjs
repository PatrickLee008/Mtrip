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
async function compileSetup(filename) {
  const { descriptor } = parse(readFileSync(filename, 'utf8'));
  const script = compileScript(descriptor, { id: 'onboarding-interactions' });
  const { outputFiles } = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: `${src}/views/merchant/onboarding` },
    bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
    plugins: [{ name: 'onboarding-boundaries', setup(b) {
      b.onResolve({ filter: /^(vue|vue-i18n|vue-router|ant-design-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
        path === 'vue' ? `export const {${Object.keys(vue).filter(key => !['onMounted', 'onBeforeUnmount'].includes(key)).join(',')}}=fixtureHost.vue; export const onMounted=()=>{}; export const onBeforeUnmount=fn=>{fixtureHost.unmount=fn;};` :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
        path === 'vue-router' ? 'export const useRoute=()=>fixtureHost.route,useRouter=()=>({push(){}});' :
        'export const message={success(){},warning(){},info(){}}; export const Modal={confirm:options=>fixtureHost.confirm=options};',
      }));
      b.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {};' }));
      b.onLoad({ filter: /\/stores\/user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>fixtureHost.user;' }));
      b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=(...args)=>fixtureHost.request("get",...args),post=(...args)=>fixtureHost.request("post",...args);' }));
    } }],
  });

  return outputFiles[0].text;
}
const pageCode = await compileSetup(`${src}/views/merchant/onboarding/index.vue`);
const documentCode = await compileSetup(`${src}/views/merchant/onboarding/components/KycScopeDocuments.vue`);
const previewCode = await compileSetup(`${src}/views/merchant/onboarding/components/MerchantDocumentPreview.vue`);
const filterCode = await compileSetup(`${src}/components/SearchFilterBar.vue`);
const verifyCode = await compileSetup(`${src}/views/merchant/verify/index.vue`);

function fixture() {
  const fixtureHost = { vue, calls: [], user: vue.reactive({ profile: { isSuper: true } }), confirm: null,
    detail: { application: { id: 7, state_model_version: 1, registration_status: 3, merchant_id: 0, account_status: 0 },
      businesses: [], documents: [], timeline: [], notes: [], kyc: null, finalApproval: null },
    request: async (method, path, data) => {
      fixtureHost.calls.push({ method, path, data });
      if (path.endsWith('/detail')) return fixtureHost.detail;
      if (path.endsWith('/kyc-templates')) return [];
      return { list: [], total: 0 };
    },
  };
  const context = vm.createContext({ fixtureHost, console, FormData, Blob, URL, crypto: globalThis.crypto });
  vm.runInContext(pageCode, context);
  const s = context.subject.default.setup({}, { expose() {} });
  s.app.value = { ...fixtureHost.detail.application };
  s.kyc.value = { merchantKyc: { status: 'draft', documents: [] },
    initialProperties: [{ applicationBusinessId: 11, businessName: 'First', kycStatus: 'draft', documents: [] },
      { applicationBusinessId: 12, businessName: 'Second', kycStatus: 'draft', documents: [] }],
    agreement: { satisfied: false }, finalApproval: { ready: false, reasons: ['current_agreement_not_signed'] } };
  return { fixtureHost, s };
}

let passed = 0;
async function test(name, run) { await run(); console.log('PASS', name); passed++; }

await test('approved list displays a date and the assigned operator name instead of reviewer ID', () => {
  const fixtureHost = { vue, route: vue.reactive({ path: '/merchant-verify/approved' }) };
  const context = vm.createContext({ fixtureHost });
  vm.runInContext(verifyCode, context);
  const s = context.subject.default.setup({}, { expose() {} });
  assert.equal(s.submittedDate({ application_submitted_at: '2026-11-15 09:20:00', created_at: '2026-11-16 10:00:00' }), '2026-11-15');
  assert.equal(s.submittedDate({ created_at: '2026-11-16 10:00:00' }), '2026-11-16');
  assert.equal(s.assignedOpsName({ audit_by: 1 }), '-');
  assert.equal(s.assignedOpsName({ audit_by: 1, assigned_ops_name: '  ' }), '-');
  assert.equal(s.assignedOpsName({ audit_by: 1, assigned_ops_name: 'Amy' }), 'Amy');
  assert.equal(s.columns.value.find(column => column.dataIndex === 'created_at').title, 'merchant.verifyPage.colSubmittedDate');
});

await test('approved document groups separate shared merchant files and the selected application business', () => {
  const fixtureHost = { vue, route: vue.reactive({ path: '/merchant-verify/approved' }) };
  const context = vm.createContext({ fixtureHost }); vm.runInContext(verifyCode, context);
  const s = context.subject.default.setup({}, { expose() {} });
  s.businesses.value = [{ id: 11, business_name: 'First' }, { id: 12, business_name: 'Second' }];
  s.verifyBizId.value = 12;
  s.documents.value = [{ id: 1, scope_model_version: 1, scope_type: 'merchant', application_business_id: 0 }, { id: 2, scope_model_version: 1, scope_type: 'property', application_business_id: 11 }, { id: 3, scope_model_version: 1, scope_type: 'property', application_business_id: 12 }, { id: 4, scope_type: 'merchant', biz_unit: '12', scope_model_version: 1, application_business_id: 12 }];
  assert.deepEqual(Array.from(s.approvedDocumentGroups.value[0].documents, d => d.id), [1]);
  assert.deepEqual(Array.from(s.approvedDocumentGroups.value[1].documents, d => d.id), [3, 4]);
  assert.equal(s.approvedDocumentGroups.value[1].title, 'Second');
  s.businesses.value[1].kyc_template_docs = [{ doc_type: 'custom_license', name: 'Business License' }];
  assert.equal(s.approvedDocumentName({ doc_type: 'custom_license', name: 'scan.jpg' }), 'Business License');
  assert.equal(s.approvedDocumentName({ doc_type: 'historical_type', name: 'Historical Certificate' }), 'Historical Certificate');
  s.detail.value = { approval_account_status: 1 };
  assert.equal(s.approvedAccountLabel.value, 'merchant.onboardingPage.pendingActivation');
  s.detail.value.approval_account_status = 2;
  assert.equal(s.approvedAccountLabel.value, 'merchant.onboardingPage.accountActivated');
});

await test('approved summary uses actual account and delivery states without assuming activation or successful delivery', () => {
  const fixtureHost = { vue, route: vue.reactive({ path: '/merchant-verify/approved' }) };
  const context = vm.createContext({ fixtureHost }); vm.runInContext(verifyCode, context);
  const s = context.subject.default.setup({}, { expose() {} });
  s.detail.value = { approval_account_status: 3, access_status: 1 };
  assert.equal(s.approvedAccountLabel.value, 'merchant.verifyPage.statusSuspended');
  s.detail.value.approval_account_status = 4;
  assert.equal(s.approvedAccountLabel.value, 'merchant.verifyPage.statusClosed');
  s.detail.value = {};
  assert.equal(s.approvedAccountLabel.value, '-');
  assert.equal(s.approvedKycComplete.value, false);
  s.detail.value.final_approved_at = '2026-11-16 10:00:00';
  s.documents.value = [{ id: 7, status: 0, file_url: '' }];
  assert.equal(s.approvedKycComplete.value, true);
  s.accessGrant.value = { receipts: [{ channel: 'email', status: 'delivered' }, { channel: 'sms', status: 'accepted' }] };
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliverySubmitted');
  s.accessGrant.value.receipts[1].status = 'delivered';
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.credentialsDelivered');
  s.accessGrant.value.receipts = [];
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.accessGenerated');
  s.accessGrant.value = { delivery_status: 'sent' };
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.accessGeneratedSent');
  s.documents.value = [{ id: 1, scope_type: 'merchant', scope_model_version: 0, biz_unit: '' }, { id: 2, scope_model_version: 0, biz_unit: '', scope_type: '' }];
  assert.deepEqual(Array.from(s.approvedDocumentGroups.value, g => g.documents.length), [1, 1]);
});

await test('delivery summary distinguishes accepted mail, failures, queued channels and test mode without inferring delivery from activation', () => {
  const fixtureHost = { vue, route: vue.reactive({ path: '/merchant-verify/approved' }) };
  const context = vm.createContext({ fixtureHost }); vm.runInContext(verifyCode, context);
  const s = context.subject.default.setup({}, { expose() {} });
  s.detail.value = { approval_account_status: 2, access_status: 1 };
  s.accessGrant.value = { receipts: [{ channel: 'email', status: 'accepted', attempts: 1 }, { channel: 'inapp', status: 'delivered', attempts: 1 }] };
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliverySubmitted');
  assert.equal(s.approvedDeliveryTone.value, 'success');
  assert.equal(s.deliveryReceiptLabel(s.accessGrant.value.receipts[0]), 'merchant.verifyPage.deliveryChannelAccepted');
  s.accessGrant.value.receipts[0].status = 'failed';
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryPartiallyFailed');
  assert.equal(s.approvedDeliveryTone.value, 'error');
  s.accessGrant.value.receipts = [{ channel: 'email', status: 'failed' }];
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryFailed');
  s.accessGrant.value.receipts[0].status = 'pending';
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryPending');
  assert.equal(s.approvedDeliveryTone.value, 'warning');
  s.accessGrant.value.receipts[0].status = 'processing';
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryProcessing');
  s.accessGrant.value.receipts = [{ channel: 'email', status: 'pending', attempts: 0 }, { channel: 'inapp', status: 'delivered', attempts: 1 }];
  s.accessGrant.value.delivery_test_mode = true;
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryTestPaused');
  assert.equal(s.deliveryReceiptLabel(s.accessGrant.value.receipts[0]), 'merchant.verifyPage.deliveryTestPaused');
  s.accessGrant.value.receipts[0].status = 'accepted';
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliverySubmitted');
  s.accessGrant.value.receipts[0].status = 'pending';
  s.accessGrant.value.receipts[0].attempts = 1;
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryPartiallyPending');
  s.accessGrant.value.receipts[0].status = 'unknown';
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryUnknown');
  s.accessGrant.value.receipts = [{ channel: 'inapp', status: 'pending', attempts: 0 }];
  assert.equal(s.approvedDeliveryLabel.value, 'merchant.verifyPage.deliveryPending');
});

function reviewFixture() {
  const f = fixture();
  const doc = { id: 23, name: 'Business Registration', hasFile: true, status: 'pending_review', documentVersion: 4 };
  f.s.kyc.value.merchantKyc = { status: 'submitted', documents: [doc] };
  f.fixtureHost.detail.kyc = f.s.kyc.value;
  return { ...f, doc };
}

await test('onboarding review only allows pending files in submitted scopes before final approval', () => {
  const { s, doc } = reviewFixture();
  assert.equal(s.canReviewScopedDoc('submitted', doc), true);
  assert.equal(s.canReviewScopedDoc('under_review', doc), true);
  for (const status of ['draft', 'locked', 'approved', 'resubmit_required', 'rejected']) assert.equal(s.canReviewScopedDoc(status, doc), false);
  assert.equal(s.canReviewScopedDoc('submitted', { ...doc, status: 'approved' }), false);
  assert.equal(s.canReviewScopedDoc('submitted', { ...doc, hasFile: false }), false);
  s.scopedKycBusy.value = true;
  assert.equal(s.canReviewScopedDoc('submitted', doc), false);
  s.scopedKycBusy.value = false;
  s.app.value.merchant_id = 19;
  assert.equal(s.canReviewScopedDoc('submitted', doc), false);
});

await test('verifying a document confirms before using the existing versioned review endpoint and refreshing detail', async () => {
  const { s, doc, fixtureHost } = reviewFixture();
  s.openKycReview(doc, 'verify');
  assert.equal(fixtureHost.calls.length, 0);
  assert.equal(typeof fixtureHost.confirm?.onOk, 'function');
  await fixtureHost.confirm.onOk();
  assert.deepEqual(JSON.parse(JSON.stringify(fixtureHost.calls[0])), {
    method: 'post', path: '/admin/merchant/verify/doc-review', data: { docId: 23, action: 'verify', expectedVersion: 4 },
  });
  assert.equal(fixtureHost.calls[1].path, '/admin/merchant/onboarding/detail');
  assert.equal(s.scopedKycBusy.value, false);
});

await test('rejecting requires a trimmed reason and cannot review a stale file or a different application', async () => {
  const { s, doc, fixtureHost } = reviewFixture();
  s.openKycReview(doc, 'reject');
  assert.equal(s.kycRejectOpen.value, true);
  s.kycRejectReason.value = '   ';
  await s.rejectScopedDocument();
  assert.equal(fixtureHost.calls.length, 0);
  s.kycRejectReason.value = '  File is unreadable  ';
  await s.rejectScopedDocument();
  assert.equal(fixtureHost.calls[0].data.reason, 'File is unreadable');
  assert.equal(fixtureHost.calls[0].data.action, 'reject');
  assert.equal(fixtureHost.calls[0].data.expectedVersion, 4);
  assert.equal(s.kycRejectOpen.value, false);
  fixtureHost.calls.length = 0;
  s.openKycReview(doc, 'verify');
  s.kyc.value.merchantKyc.documents[0].documentVersion = 5;
  await fixtureHost.confirm.onOk();
  assert.equal(fixtureHost.calls.length, 0);
  s.openKycReview({ ...doc, documentVersion: 5 }, 'verify');
  s.app.value.id = 8;
  await fixtureHost.confirm.onOk();
  assert.equal(fixtureHost.calls.length, 0);
});

await test('reviewing the selected business preserves its scope and refreshes the visible list progress', async () => {
  const { s, fixtureHost } = reviewFixture();
  const doc = { id: 31, name: 'Hotel License', hasFile: true, status: 'pending_review', documentVersion: 2 };
  s.kyc.value.initialProperties[1] = { applicationBusinessId: 12, businessName: 'Second', kycStatus: 'submitted', documents: [doc] };
  s.kycBizId.value = 12;
  s.openBizId.value = 12;
  s.list.value = [{ ...s.app.value }];
  s.openKycReview(doc, 'verify');
  assert.match(fixtureHost.confirm.content, /Second/);
  fixtureHost.detail.businesses = [{ id: 11, kyc_status: 2 }, { id: 12, kyc_status: 5 }];
  await fixtureHost.confirm.onOk();
  assert.equal(fixtureHost.calls[0].data.docId, 31);
  assert.equal(fixtureHost.calls[0].data.expectedVersion, 2);
  assert.equal(s.kycBizId.value, 12);
  assert.equal(s.openBizId.value, 12);
  assert.deepEqual(Array.from(s.list.value[0].initial_property_kyc_statuses), [2, 5]);
});

await test('a failed review refreshes current server state and releases the busy gate', async () => {
  const { s, doc, fixtureHost } = reviewFixture();
  const request = fixtureHost.request;
  fixtureHost.request = async (...args) => {
    if (args[0] === 'post') throw new Error('version conflict');
    return request(...args);
  };
  s.openKycReview(doc, 'reject');
  s.kycRejectReason.value = 'Unreadable';
  await assert.rejects(s.rejectScopedDocument(), /version conflict/);
  assert.equal(s.scopedKycBusy.value, false);
  assert.equal(s.kycRejectOpen.value, true);
  assert.equal(fixtureHost.calls[0].path, '/admin/merchant/onboarding/detail');
});

await test('viewing a KYC file requests an in-system preview without starting a download', () => {
  const events = [];
  const fixtureHost = { vue };
  const context = vm.createContext({ fixtureHost });
  vm.runInContext(documentCode, context);
  const s = context.subject.default.setup({ documents: [] }, { expose() {}, emit: (...args) => events.push(args) });
  assert.equal(typeof s.viewDocument, 'function');
  s.viewDocument({ id: 23, hasFile: true });
  assert.deepEqual(events, [['preview', 23]]);
});

function previewFixture() {
  const pending = [];
  const revoked = [];
  const downloads = [];
  const fixtureHost = { vue, request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  const context = vm.createContext({ fixtureHost, Blob, atob,
    URL: { createObjectURL: () => `blob:preview-${pending.length}`, revokeObjectURL: url => revoked.push(url) },
    document: { createElement: () => { const link = { click: () => downloads.push({ href: link.href, name: link.download }) }; return link; } },
  });
  vm.runInContext(previewCode, context);
  const s = context.subject.default.setup({}, { expose() {} });
  const file = (name, mime) => ({ name, mime, content: btoa('fixture file') });
  return { s, fixtureHost, pending, revoked, downloads, file };
}

await test('image and PDF previews only download on explicit action and release URLs on close', async () => {
  const { s, fixtureHost, pending, revoked, downloads, file } = previewFixture();
  for (const mime of ['image/png', 'application/pdf']) {
    const task = s.show(23);
    assert.equal(s.open.value, true);
    assert.equal(s.loading.value, true);
    pending.at(-1).resolve(file('kyc-file', mime));
    await task;
    assert.equal(s.mime.value, mime);
    assert.equal(downloads.length, mime === 'image/png' ? 0 : 1);
    const url = s.url.value;
    s.download();
    assert.deepEqual(downloads.at(-1), { href: url, name: 'kyc-file' });
    s.close();
    assert.equal(s.url.value, '');
    assert.equal(revoked.at(-1), url);
  }
  fixtureHost.unmount();
});

await test('closing or switching files ignores stale preview responses', async () => {
  const { s, pending, revoked, file } = previewFixture();
  const closed = s.show(1);
  s.close();
  pending[0].resolve(file('closed.png', 'image/png'));
  await closed;
  assert.equal(s.open.value, false);
  assert.equal(s.url.value, '');
  const first = s.show(2);
  const second = s.show(3);
  pending[2].resolve(file('new.pdf', 'application/pdf'));
  await second;
  pending[1].resolve(file('old.png', 'image/png'));
  await first;
  assert.equal(s.name.value, 'new.pdf');
  const url = s.url.value;
  const replacement = s.show(4);
  assert.deepEqual(revoked, [url]);
  pending[3].reject(new Error('not authorized'));
  await replacement;
  assert.equal(s.failed.value, true);
  assert.equal(s.loading.value, false);
  assert.equal(s.url.value, '');
});

await test('new property draft and approval never use the legacy KYC badges', () => {
  const { s } = fixture();
  for (const [status, key] of [[1, 'kycDraft'], [0, 'kycLocked'], [2, 'kycSubmitted'], [3, 'kycUnderReview'], [4, 'kycResubmitRequired'], [5, 'kycVerified'], [6, 'kycRejected']]) {
    const badge = s.businessKycBadge({ kyc_status: status });
    assert.equal(badge.text, `merchant.onboardingPage.${key}`);
  }
  s.app.value.state_model_version = 0;
  assert.equal(s.businessKycBadge({ kyc_status: 1 }).text, 'merchant.onboardingPage.kycVerified');
  assert.equal(s.businessKycBadge({ kyc_status: 4 }).text, 'merchant.onboardingPage.kycRejected');
});

await test('progress follows registration, every property, and final approval without writing states', () => {
  const { fixtureHost, s } = fixture();
  for (const status of [0, 1, 2, 4, 5]) {
    s.app.value.registration_status = status;
    assert.equal(s.registrationProgress.value, 1);
  }
  s.app.value.registration_status = 3;
  assert.equal(s.registrationProgress.value, 2);
  s.kyc.value.merchantKyc.status = 'approved';
  s.kyc.value.initialProperties[0].kycStatus = 'approved';
  assert.equal(s.registrationProgress.value, 2, 'an unsubmitted second property still needs documents');
  s.kyc.value.initialProperties[1].kycStatus = 'submitted';
  assert.equal(s.registrationProgress.value, 3);
  s.kyc.value.initialProperties[1].kycStatus = 'resubmit_required';
  assert.equal(s.registrationProgress.value, 2);
  s.kyc.value.initialProperties[1].kycStatus = 'approved';
  assert.equal(s.registrationProgress.value, 4);
  assert.equal(s.kyc.value.finalApproval.ready, false, 'the agreement gate still blocks final approval');
  s.finalApprovalResult.value = { accountStatus: 'pending_activation' };
  assert.equal(s.registrationProgress.value, 5);
  assert.equal(fixtureHost.calls.length, 0);
});

await test('list progress follows all scopes after base approval and matches the detail step', () => {
  const { fixtureHost, s } = fixture();
  const row = { ...s.app.value, merchant_kyc_status: 1, initial_property_kyc_statuses: [1, 1] };
  const cases = [
    [1, [1, 1], 2, 'progressPreparingDocuments'],
    [2, [2, 2], 3, 'progressReviewing'],
    [5, [5, 3], 3, 'progressReviewing'],
    [5, [5, 4], 2, 'progressCorrection'],
    [5, [5, 6], 3, 'progressRejected'],
    [5, [5, 1], 2, 'progressPreparingDocuments'],
    [5, [5, 5], 4, 'progressAwaitingFinal'],
  ];
  const names = ['locked', 'draft', 'submitted', 'under_review', 'resubmit_required', 'approved', 'rejected'];
  for (const [merchant, properties, step, key] of cases) {
    row.merchant_kyc_status = merchant;
    row.initial_property_kyc_statuses = properties;
    s.kyc.value.merchantKyc.status = names[merchant];
    properties.forEach((status, i) => s.kyc.value.initialProperties[i].kycStatus = names[status]);
    const display = s.onboardingProgress(row);
    assert.equal(display.step, step);
    assert.equal(display.status.text, `merchant.onboardingPage.${key}`);
    assert.equal(s.registrationProgress.value, display.step);
    assert.equal(row.registration_status, 3, 'base approval remains unchanged');
  }
  row.merchant_id = 19;
  row.account_status = 1;
  assert.equal(s.onboardingProgress(row).step, 5);
  assert.equal(s.onboardingProgress(row).status.text, 'merchant.onboardingPage.progressPendingActivation');
  row.account_status = 2;
  assert.equal(s.onboardingProgress(row).status.text, 'merchant.onboardingPage.progressActivated');
  for (const accountStatus of [3, 4]) {
    row.account_status = accountStatus;
    assert.equal(s.onboardingProgress(row).status.text, 'merchant.onboardingPage.progressApproved');
    assert.equal(s.onboardingProgress(row, undefined, { accountStatus: 'active' }).status.text,
      'merchant.onboardingPage.progressApproved', 'current account state takes priority over approval history');
  }
  row.state_model_version = 0;
  row.stage = 4;
  assert.equal(s.onboardingProgress(row).status.text, 'merchant.onboardingPage.stageKycInProgress');
  assert.equal(fixtureHost.calls.length, 0);
});

await test('opening a fresh detail updates only the matching list progress snapshot', async () => {
  const { fixtureHost, s } = fixture();
  s.list.value = [{ ...s.app.value, merchant_kyc_status: 1, initial_property_kyc_statuses: [1, 1] },
    { id: 9, merchant_kyc_status: 1 }];
  fixtureHost.detail.application.merchant_kyc_status = 5;
  fixtureHost.detail.businesses = [{ id: 11, kyc_status: 5 }, { id: 12, kyc_status: 3 }];
  await s.loadDetail(7);
  assert.equal(s.onboardingProgress(s.list.value[0]).step, 3);
  assert.deepEqual(Array.from(s.list.value[0].initial_property_kyc_statuses), [5, 3]);
  assert.equal(s.list.value[1].merchant_kyc_status, 1);
  assert.equal(fixtureHost.calls.length, 1, 'detail sync needs no extra list or per-row requests');
  assert.equal(fixtureHost.calls[0].method, 'get');
});

await test('opening details expands the first business and resets the shared merchant card', async () => {
  const { fixtureHost, s } = fixture();
  fixtureHost.detail.businesses = [{ id: 11, business_name: 'First' }, { id: 12, business_name: 'Second' }];
  fixtureHost.detail.kyc = s.kyc.value;
  await s.openDetail({ id: 7 });
  assert.equal(s.openBizId.value, 11);
  assert.equal(s.currentProperty.value.businessName, 'First');
  assert.equal(s.merchantKycOpen.value, false);
  s.merchantKycOpen.value = true;
  s.selectBusinessId(12);
  assert.equal(s.openBizId.value, 12);
  assert.equal(s.currentProperty.value.businessName, 'Second');
  assert.equal(s.kyc.value.merchantKyc.status, 'draft', 'business selection does not alter shared merchant KYC');
  s.openScopedAssist();
  assert.equal(s.currentProperty.value.businessName, 'Second', 'assistance keeps the selected business');
  await s.openDetail({ id: 7 });
  assert.equal(s.openBizId.value, 11);
  assert.equal(s.merchantKycOpen.value, false);
  assert.equal(s.scopedAssistOpen.value, false);
  fixtureHost.detail.businesses = [];
  await s.openDetail({ id: 7 });
  assert.equal(s.openBizId.value, 0);
  assert.equal(s.currentBiz.value, null);
  assert.ok(fixtureHost.calls.every(call => call.method === 'get'), 'selection and opening never write');
});

await test('switching the selected property keeps its own documents without loading legacy templates', async () => {
  const { fixtureHost, s } = fixture();
  await s.selectBiz({ id: 12 });
  assert.equal(s.currentProperty.value.applicationBusinessId, 12);
  assert.equal(fixtureHost.calls.length, 0);
  await s.selectBiz({ id: 11 });
  assert.equal(s.currentProperty.value.businessName, 'First');
});

await test('opening assistance never submits and existing signature and correction upload gates remain', () => {
  const { fixtureHost, s } = fixture();
  s.openScopedAssist();
  assert.equal(s.scopedAssistOpen.value, true);
  assert.equal(fixtureHost.calls.length, 0);
  assert.equal(s.canSubmitNewKyc.value, false);
  s.kyc.value.agreement.satisfied = true;
  assert.equal(s.canSubmitNewKyc.value, true);
  assert.equal(s.canUploadScopedDoc('approved', { status: 'approved' }), false);
  assert.equal(s.canUploadScopedDoc('resubmit_required', { status: 'approved' }), false);
  assert.equal(s.canUploadScopedDoc('resubmit_required', { status: 'rejected' }), true);
  s.app.value.merchant_id = 19;
  assert.equal(s.canSubmitNewKyc.value, false);
  assert.equal(s.canUploadScopedDoc('draft', { status: 'missing' }), false);
});

await test('assisted submit still confirms and posts only the application to the existing endpoint', async () => {
  const { fixtureHost, s } = fixture();
  s.kyc.value.agreement.satisfied = true;
  s.submitNewKyc();
  assert.equal(fixtureHost.calls.length, 0);
  assert.ok(fixtureHost.confirm.zIndex > 1100, 'confirmation must appear above the assistance drawer');
  await fixtureHost.confirm.onOk();
  const writes = fixtureHost.calls.filter(call => call.method === 'post');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/admin/merchant/onboarding/submit-verification');
  assert.equal(writes[0].data.id, 7);
  assert.equal(writes[0].data.businessId, undefined);
});

await test('filter replacement events retain all fields and query zero-valued draft status', () => {
  const { fixtureHost, s } = fixture();
  const context = vm.createContext({ fixtureHost, console });
  vm.runInContext(filterCode, context);
  const filter = context.subject.default.setup({ filterValues: {} }, { expose() {}, emit(event, values) {
    if (event === 'update:filterValues') Object.assign(s.sfbFilters, values);
    if (event === 'search') s.handleSfbSearch();
  } });
  filter.handleFilterChange('country', 'Myanmar');
  filter.handleFilterChange('category', 'hotel');
  filter.handleFilterChange('registrationStatus', 0);
  const last = fixtureHost.calls.at(-1);
  assert.equal(last.path, '/admin/merchant/onboarding/list');
  assert.equal(last.data.registrationStatus, 0);
  assert.equal(last.data.country, 'Myanmar');
  assert.equal(last.data.category, 'hotel');
});

await test('document upload events preserve property ownership and obey correction and busy gates', () => {
  const { fixtureHost, s } = fixture();
  const emitted = [];
  const props = vue.reactive({ status: 'resubmit_required', scopeType: 'property', businessId: 12,
    documents: [], busy: false, canUpload: s.canUploadScopedDoc });
  const context = vm.createContext({ fixtureHost, console });
  vm.runInContext(documentCode, context);
  const document = context.subject.default.setup(props, { expose() {}, emit: (...args) => emitted.push(args) });
  const file = new Blob(['test'], { type: 'application/pdf' });
  const doc = { docType: 'license', status: 'approved' };
  document.uploadHandler(doc)(file);
  assert.equal(emitted.length, 0, 'approved documents are immutable during correction');
  doc.status = 'rejected';
  props.busy = true;
  document.uploadHandler(doc)(file);
  assert.equal(emitted.length, 0);
  props.busy = false;
  assert.equal(document.uploadHandler(doc)(file), false);
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0], ['upload', file, 'property', 12, doc]);
  props.scopeType = 'merchant';
  props.businessId = 0;
  document.uploadHandler(doc)(file);
  assert.deepEqual(emitted[1], ['upload', file, 'merchant', 0, doc]);
});

await test('scoped upload keeps the original multipart endpoint and owner fields', async () => {
  const { fixtureHost, s } = fixture();
  for (const [scope, businessId] of [['merchant', 0], ['property', 12]]) {
    s.uploadScopedDoc(new Blob(['test'], { type: 'application/pdf' }), scope, businessId, { docType: 'license' });
    await new Promise(resolve => setImmediate(resolve));
    const write = fixtureHost.calls.filter(call => call.method === 'post').at(-1);
    assert.equal(write.path, '/admin/merchant/onboarding/kyc-upload');
    assert.equal(write.data.get('id'), '7');
    assert.equal(write.data.get('scopeType'), scope);
    assert.equal(write.data.get('applicationBusinessId'), String(businessId));
    assert.equal(write.data.get('docType'), 'license');
    assert.equal(write.data.has('bizUnit'), false);
    assert.equal(s.scopedKycBusy.value, false);
  }
});

console.log(`Onboarding interactions: ${passed} tests passed`);
