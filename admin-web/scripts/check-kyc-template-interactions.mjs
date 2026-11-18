import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const AForm = require('ant-design-vue/lib/form').default;
const { build } = require('esbuild');
const src = fileURLToPath(new URL('../src', import.meta.url));
const filename = `${src}/views/config/kyc-template/index.vue`;
assert.ok(existsSync(filename), 'Public KYC template management page is missing');
const { descriptor } = parse(readFileSync(filename, 'utf8'));
const script = compileScript(descriptor, { id: 'kyc-template-interactions' });
const result = await build({
  stdin: { contents: script.content, loader: 'ts', resolveDir: `${src}/views/config/kyc-template` },
  bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
  plugins: [{ name: 'kyc-boundaries', setup(b) {
    b.onResolve({ filter: /^(vue|vue-i18n|ant-design-vue|@ant-design\/icons-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
      path === 'vue' ? `export const {${Object.keys(vue).filter(k => !['onMounted','onBeforeUnmount'].includes(k)).join(',')}}=host.vue;export const onMounted=()=>{};export const onBeforeUnmount=()=>{};` :
      path === 'vue-i18n' ? 'export const useI18n=()=>({t:(key,args)=>args?`${key}:${JSON.stringify(args)}`:key});' :
      path === '@ant-design/icons-vue' ? 'export const PlusOutlined={},DeleteOutlined={},ArrowUpOutlined={},ArrowDownOutlined={};' :
      'export const message={success:key=>host.success.push(key),warning:key=>host.warnings.push(key)};',
    }));
    b.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {};' }));
    b.onLoad({ filter: /\/stores\/user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>host.user;' }));
    b.onLoad({ filter: /\/utils\/uuid\.ts$/ }, () => ({ contents: 'export const genUUID=()=>`00000000-0000-4000-8000-${++host.uuid}`;' }));
    b.onLoad({ filter: /\/utils\/http\.ts$/ }, () => ({ contents: 'export const get=(...args)=>host.request("get",...args),post=(...args)=>host.request("post",...args);' }));
  } }],
});
const row = () => ({ id: 31, site_id: 7, scope_type: 'property', business_type: 'hotel', name: 'Hotel files', status: 1, sort: 4,
  template_group_id: 12, template_version: 3, is_current: true, created_by: 9, created_by_name: 'Operator',
  change_action: 'edit', change_reason: 'Updated requirements', created_at: '2026-11-18 10:00:00',
  documents: [{ docType: 'license', name: 'Business license', required: true }], can_manage: true });
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const host = { vue, calls: [], warnings: [], success: [], uuid: 0, fail: false, rows: [row()], history: [row()],
    user: vue.reactive({ profile: { isSuper: true, siteId: 0 }, menus: [], hasPerm: perm => !host.denied?.includes(perm) }),
    request: async (method, path, data) => {
      host.calls.push({ method, path, data: plain(data ?? {}) });
      if (host.fail) throw new Error('request failed');
      if (path.endsWith('/tree')) return [{ id: 7, site_name: 'Myanmar', children: [], status: 1 }];
      if (method === 'get') return { list: path.endsWith('/history') ? host.history : host.rows, total: 1, page: 1, pageSize: 20 };
      return { ...row(), id: 32, template_version: 4 };
    },
  };
  const context = vm.createContext({ host, console }); vm.runInContext(result.outputFiles[0].text, context);
  return { host, s: context.subject.default.setup({}, { expose() {} }) };
}
const posts = host => host.calls.filter(call => call.method === 'post');
let count = 0;
async function test(name, run) { await run(); console.log('PASS', name); count++; }
function valid(s) { s.form.name = 'New template'; s.form.documents = [{ docType: 'license', name: 'License', required: true }]; }

// Exercise the real Ant Form submit contract; calling load() alone misses a broken query button.
function findFilterForm(node) {
  if (node.tag === 'a-form') return node;
  for (const child of node.children ?? []) {
    const found = findFilterForm(child);
    if (found) return found;
  }
}
const filterTemplate = compileTemplate({ source: findFilterForm(descriptor.template.ast).loc.source,
  filename, id: 'kyc-filter-submit', compilerOptions: { bindingMetadata: script.bindings } });
assert.deepEqual(filterTemplate.errors, []);
const filterBuild = await build({ stdin: { contents: filterTemplate.code, loader: 'js' }, bundle: true,
  write: false, format: 'iife', globalName: 'filterView', plugins: [{ name: 'filter-vue', setup(b) {
    b.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const {${Object.keys(vue).join(',')}}=host.vue;` }));
  } }],
});
function mountFilters(s) {
  const node = tag => ({ tag, props: {}, children: [], parent: null });
  const renderer = vue.createRenderer({
    createElement: node, createText: text => Object.assign(node('#text'), { text }), createComment: () => node('#comment'),
    setText: (el, text) => { el.text = text; }, setElementText: (el, text) => { el.text = text; },
    patchProp: (el, key, _old, value) => { el.props[key] = value; }, parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
    insert(el, parent, anchor) { el.parent = parent; const index = parent.children.indexOf(anchor); parent.children.splice(index < 0 ? parent.children.length : index, 0, el); },
    remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); },
  });
  const context = vm.createContext({ host: { vue } }); vm.runInContext(filterBuild.outputFiles[0].text, context);
  const app = renderer.createApp({ render() { return context.filterView.render(this, [], {}, vue.proxyRefs(s)); } });
  app.component('a-form', AForm);
  for (const tag of ['a-form-item', 'a-space']) app.component(tag, { setup(_props, { slots }) { return () => vue.h('div', slots.default?.()); } });
  for (const tag of ['a-input', 'a-select', 'a-button']) app.component(tag, {
    props: ['value', 'htmlType'], setup(props, { slots, attrs }) { return () => vue.h(tag === 'a-button' ? 'button' : 'input',
      { ...attrs, value: props.value, type: props.htmlType }, slots.default?.()); },
  });
  const root = node('root'); app.mount(root);
  const find = (el, tag) => el.tag === tag ? el : el.children.map(child => find(child, tag)).find(Boolean);
  return { app, form: find(root, 'form') };
}
await test('submitting the query form sends all filters once and returns to page one', async () => {
  const { host, s } = fixture();
  s.pagination.value.onChange(3, 20); await new Promise(setImmediate); host.calls.length = 0;
  Object.assign(s.query, { keyword: 'Hotel', scopeType: 'property', businessType: 'hotel', status: 2, siteId: 0 });
  const mounted = mountFilters(s);
  try {
    mounted.form.props.onSubmit({ preventDefault() {}, stopPropagation() {} });
    await new Promise(setImmediate);
    assert.equal(host.calls.length, 1, 'submitting the visible query form must trigger a request');
    assert.deepEqual(host.calls[0], { method: 'get', path: '/admin/merchant/kyc-template/list', data: {
      page: 1, pageSize: 20, keyword: 'Hotel', scopeType: 'property', businessType: 'hotel', status: 2, siteId: 0,
    } });
  } finally { mounted.app.unmount(); }
});

await test('list filters preserve omitted site versus public site zero', async () => {
  const { host, s } = fixture(); await s.load();
  assert.equal('siteId' in host.calls.at(-1).data, false);
  Object.assign(s.query, { keyword: 'hotel', scopeType: 'property', businessType: 'hotel', status: 2, siteId: 0 });
  await s.load();
  assert.deepEqual(host.calls.at(-1).data, { page: 1, pageSize: 20, keyword: 'hotel', scopeType: 'property', businessType: 'hotel', status: 2, siteId: 0 });
});
await test('create sends selected scope and initial status with trimmed document names', async () => {
  const { host, s } = fixture(); s.openCreate(); valid(s);
  Object.assign(s.form, { siteId: 7, scopeType: 'property', businessType: 'hotel', status: 2, sort: 5, reason: ' Initial policy ' });
  s.form.documents[0].name = ' License '; await s.save();
  assert.deepEqual(posts(host)[0], { method: 'post', path: '/admin/merchant/kyc-template/create', data: {
    name: 'New template', siteId: 7, scopeType: 'property', businessType: 'hotel', status: 2, sort: 5,
    reason: 'Initial policy', documents: [{ docType: 'license', name: 'License', required: true }],
  } });
  assert.equal(s.editorOpen.value, false);
  assert.equal(host.calls.at(-1).path, '/admin/merchant/kyc-template/list');
});
await test('copy public templates creates an independent local template without mutating source', async () => {
  const { host, s } = fixture(); host.user.profile = { isSuper: false, siteId: 7 };
  const original = { ...row(), site_id: 0, can_manage: false }; s.openCopy(original);
  assert.equal(s.form.siteId, 7); s.form.name = 'Local hotel files'; s.form.documents[0].name = 'Local license';
  await s.save(); const call = posts(host)[0];
  assert.equal(call.path, '/admin/merchant/kyc-template/create');
  assert.equal(call.data.copyFromId, 31); assert.equal(call.data.siteId, 7);
  assert.equal(original.documents[0].name, 'Business license');
});
await test('legacy merchant business templates copy into a valid new identity while retaining checklist', async () => {
  const { host, s } = fixture();
  const legacy = { ...row(), scope_type: 'merchant', business_type: 'hotel', can_manage: false, is_legacy: true };
  s.openCopy(legacy);
  assert.equal(s.form.scopeType, 'merchant'); assert.equal(s.form.businessType, 'unified');
  await s.save(); assert.equal(posts(host)[0].data.copyFromId, 31);
  assert.equal(posts(host)[0].data.documents[0].docType, 'license');
});
await test('editing sends expected version and omits immutable targeting and status', async () => {
  const { host, s } = fixture(); const original = row(); s.openEdit(original);
  s.form.name = 'Revised'; s.form.reason = 'New requirement'; s.form.siteId = 999; s.form.status = 2;
  await s.save();
  assert.deepEqual(posts(host)[0], { method: 'post', path: '/admin/merchant/kyc-template/update', data: {
    id: 31, expectedVersion: 3, name: 'Revised', sort: 4, reason: 'New requirement',
    documents: [{ docType: 'license', name: 'Business license', required: true }],
  } });
  assert.equal(original.id, 31); assert.equal(original.template_version, 3);
});
await test('scope change normalizes merchant unified and property hotel', async () => {
  const { s } = fixture(); s.openCreate(); s.form.scopeType = 'property'; s.changeScope();
  assert.equal(s.form.businessType, 'hotel'); s.form.scopeType = 'merchant'; s.changeScope();
  assert.equal(s.form.businessType, 'unified');
});
await test('new document types stay unique and stable when labels and order change', async () => {
  const { host, s } = fixture(); s.openCreate(); valid(s); s.addDocument(); s.addDocument();
  const a = s.form.documents[1].docType, b = s.form.documents[2].docType;
  assert.ok(a.startsWith('custom_')); assert.notEqual(a, b);
  s.form.documents[1].name = 'Tax file'; s.form.documents[2].name = 'Photo'; s.moveDocument(2, -1);
  await s.save(); assert.equal(posts(host)[0].data.documents[1].docType, b);
  assert.equal(posts(host)[0].data.documents[2].docType, a);
});
await test('invalid drafts never write, including duplicate document types and no required documents', async () => {
  for (const mutate of [s => { s.form.name = ' '; }, s => { s.form.documents = []; },
    s => { s.form.documents[0].name = ' '; }, s => { s.form.documents[0].required = false; },
    s => { s.form.documents.push({ ...s.form.documents[0] }); }, s => { s.form.businessType = 'hotel'; },
    s => { s.form.sort = -1; }, s => { s.form.sort = 10000; }, s => { s.form.siteId = undefined; }]) {
    const { host, s } = fixture(); s.openCreate(); valid(s); mutate(s); await s.save();
    assert.equal(posts(host).length, 0); assert.ok(host.warnings.length);
  }
});
await test('canceling either editor or status confirmation never writes', async () => {
  const { host, s } = fixture(); s.openCreate(); valid(s); s.cancelEditor(); await s.save();
  s.requestStatus(row()); s.cancelStatus(); await s.confirmStatus(); assert.equal(posts(host).length, 0);
});
await test('read permissions accept page menus but do not grant write actions', async () => {
  const { host, s } = fixture(); host.denied = ['config:kyc:list', 'config:kyc:add', 'config:kyc:edit', 'config:kyc:status'];
  await s.load(); assert.equal(host.calls.length, 0);
  host.user.menus = [{ menu_type: 2, perm_key: 'config:kyc:list' }]; await s.load();
  assert.equal(host.calls[0].path, '/admin/merchant/kyc-template/list');
  s.openCreate(); s.openCopy(row()); s.openEdit(row()); s.requestStatus(row());
  assert.equal(s.editorOpen.value, false); assert.equal(s.statusOpen.value, false);
});
await test('read-only and other-site rows cannot edit or change status; local copy is permitted', async () => {
  const { host, s } = fixture(); host.user.profile = { isSuper: false, siteId: 7 };
  for (const source of [{ ...row(), can_manage: false }, { ...row(), site_id: 9 }, { ...row(), site_id: 0 }]) {
    s.openEdit(source); s.requestStatus(source); assert.equal(s.editorOpen.value, false); assert.equal(s.statusOpen.value, false);
  }
  s.openCopy({ ...row(), site_id: 0, can_manage: false }); assert.equal(s.editorOpen.value, true);
  valid(s); s.form.siteId = 0; await s.save(); assert.equal(posts(host).length, 0);
});
await test('permission revoked during an open editor prevents saving', async () => {
  const { host, s } = fixture(); s.openEdit(row()); host.denied = ['config:kyc:edit']; await s.save();
  assert.equal(posts(host).length, 0);
});
await test('failed list shows failure and successful retry clears it', async () => {
  const { host, s } = fixture(); await s.load(); host.fail = true; await s.load();
  assert.equal(s.failed.value, true); assert.equal(s.list.value.length, 0); assert.equal(s.loading.value, false);
  s.openCreate(); assert.equal(s.editorOpen.value, false);
  host.fail = false; await s.load(); assert.equal(s.failed.value, false); assert.equal(s.list.value.length, 1);
});
await test('failed save keeps draft available for correction and retry', async () => {
  const { host, s } = fixture(); s.openCreate(); valid(s); host.fail = true; await s.save();
  assert.equal(s.editorOpen.value, true); assert.equal(s.saving.value, false); assert.equal(s.form.name, 'New template');
  host.fail = false; await s.save(); assert.equal(s.editorOpen.value, false);
});
await test('history reads selected current ID and preserves snapshot metadata and document preview', async () => {
  const { host, s } = fixture(); await s.openHistory(row());
  assert.deepEqual(host.calls[0], { method: 'get', path: '/admin/merchant/kyc-template/history', data: { id: 31, page: 1, pageSize: 10 } });
  assert.equal(s.historyRows.value[0].created_by_name, 'Operator'); assert.equal(s.historyRows.value[0].change_reason, 'Updated requirements');
  assert.equal(s.historyRows.value[0].documents[0].name, 'Business license');
  host.fail = true; await s.loadHistory(2); assert.equal(s.historyFailed.value, true); assert.equal(s.historyRows.value.length, 0);
});
await test('status writes only after explicit confirmation and uses the selected current version', async () => {
  const { host, s } = fixture(); s.requestStatus(row()); assert.equal(posts(host).length, 0);
  s.statusReason.value = 'Retired policy'; await s.confirmStatus();
  assert.deepEqual(posts(host)[0], { method: 'post', path: '/admin/merchant/kyc-template/status', data: { id: 31, expectedVersion: 3, status: 2, reason: 'Retired policy' } });
  assert.equal(s.statusOpen.value, false); assert.equal(host.calls.at(-1).path, '/admin/merchant/kyc-template/list');
});
await test('status permission revoked before confirmation prevents writes', async () => {
  const { host, s } = fixture(); s.requestStatus(row()); host.denied = ['config:kyc:status']; await s.confirmStatus();
  assert.equal(posts(host).length, 0);
});
console.log(`Public KYC template interactions: ${count} tests passed`);
