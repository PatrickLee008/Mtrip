import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const esbuild = require('esbuild');

async function component(path, h) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const { descriptor } = parse(readFileSync(filename, 'utf8'));
  const script = compileScript(descriptor, { id: 'property-search-test' });
  const { outputFiles } = await esbuild.build({
    stdin: { contents: script.content, loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'subject',
    plugins: [{ name: 'isolated-property-search', setup(build) {
      build.onResolve({ filter: /.*/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents:
        path === 'vue' ? 'export const {defineComponent,computed,ref}=h.vue; export const onMounted=()=>{};' :
        path === 'vue-router' ? 'export const useRoute=()=>h.route; export const useRouter=()=>h.router;' :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
        path === 'ant-design-vue' ? 'export const Modal={},message={};' :
        path === '@ant-design/icons-vue' ? 'export const BankOutlined={},CheckCircleOutlined={},CoffeeOutlined={},EnvironmentOutlined={},HomeOutlined={},PlusOutlined={},BellOutlined={},BookOutlined={},CheckOutlined={},DownOutlined={},GlobalOutlined={},LockOutlined={},LogoutOutlined={},RightOutlined={},SearchOutlined={},UserOutlined={};' :
        path === '@/api/properties' ? 'export const apiPropertyList=params=>h.list(params);' :
        path === '@/stores/user' ? 'export const useUserStore=()=>({hasPerm:()=>true});' :
        path === '@/stores/app' ? 'export const useAppStore=()=>({locale:"en-US"});' :
        path === '@/api/auth' ? 'export const apiUpdatePassword=()=>{};' :
        path === '@/api/notifications' ? 'export const apiNotificationSummary=()=>({unread:0});' :
        path === '@/locales/menuI18n' ? 'export const resolveMenuTitle=()=>"Properties";' :
        path === '@/locales' ? 'export const SUPPORTED_LOCALES=[];' :
        path.endsWith('.png') ? 'export default "fixture.png";' :
        (() => { throw new Error(path); })(),
      }));
    } }],
  });
  const context = vm.createContext({ h });
  vm.runInContext(outputFiles[0].text, context);
  return { s: context.subject.default.setup({}, { expose() {} }), descriptor };
}

const rows = [
  { id: 1, store_name: 'Grand Hotel', address: 'Yangon', merchant_name: 'Alpha Group', business_type: 'hotel', kyc_status: 1 },
  { id: 2, store_name: 'Test Cafe', address: 'Mandalay', merchant_name: 'Beta Group', business_type: 'restaurant', kyc_status: 0 },
  { id: 3, store_name: 'River Tour', address: '', merchant_name: 'Alpha Group', business_type: 'attraction', kyc_status: 1 },
];
const h = { vue, calls: [], navigations: [], route: vue.reactive({ path: '/properties', query: { keep: 'yes' }, hash: '#portfolio', meta: {} }),
  list: async params => { h.calls.push(params); return { list: rows, total: rows.length, page: 1, pageSize: 200 }; },
  router: { replace: async target => { h.navigations.push(target); Object.assign(h.route, target); } },
};
const { s: page, descriptor: pageSfc } = await component('../src/views/properties/index.vue', h);
const { s: header, descriptor: headerSfc } = await component('../src/layouts/components/AppHeader.vue', h);
await page.load();
const ids = () => Array.from(page.groups.value.flatMap(group => group.items.map(item => item.id)));
assert.deepEqual(ids(), [1, 2, 3]);
// AP_TC_002: drive the header's real search binding and inspect the list's real groups.
assert.ok(header.propertySearch, 'Header must expose a search binding connected to the property list');
let passed = 0;
for (const [keyword, expected] of [
  ['grand', [1]], ['GRAND', [1]], ['  grand  ', [1]], ['mandalay', [2]],
  ['Alpha Group', [1, 3]], ['AP_TC_002_NO_MATCH', []], ['%', []], ['', [1, 2, 3]], ['   ', [1, 2, 3]],
]) {
  header.propertySearch.value = keyword;
  assert.deepEqual(ids(), expected, keyword);
  assert.equal(header.propertySearch.value, keyword);
  assert.equal(h.route.query.keep, 'yes');
  assert.equal(h.route.hash, '#portfolio');
  assert.equal(page.summary.value[0].value, 3, 'Search must preserve portfolio statistics');
  assert.equal(h.calls.length, 1, 'Typing must not reload the property API');
  passed++;
}
header.propertySearch.value = '';
assert.equal(h.route.query.search, undefined);
h.route.query.search = 'River';
assert.equal(header.propertySearch.value, 'River');
assert.deepEqual(ids(), [3], 'Restored URL must restore both search input and results');
h.route.query.search = ['Grand', 'Cafe'];
assert.equal(header.propertySearch.value, '');
assert.deepEqual(ids(), [1, 2, 3]);
assert.match(headerSfc.template.content, /v-model="propertySearch"/);
assert.match(headerSfc.template.content, /v-if="route.path === '\/properties'"/);
assert.match(pageSfc.template.content, /properties.noSearchResults/);
passed++;

// A match after the first API page must remain searchable.
const manyRows = Array.from({ length: 201 }, (_, i) => ({ ...rows[0], id: i + 1, store_name: i === 200 ? 'Last Hotel' : 'First Hotel' }));
h.calls.length = 0;
h.list = async params => {
  h.calls.push(params);
  return { list: manyRows.slice((params.page - 1) * 200, params.page * 200), total: 201, page: params.page, pageSize: 200 };
};
await page.load();
header.propertySearch.value = 'Last Hotel';
assert.deepEqual(ids(), [201]);
assert.deepEqual(h.calls.map(params => params.page), [1, 2]);
assert.equal(page.summary.value[0].value, 201);
passed++;
console.log(`Property search: ${passed} tests passed`);
