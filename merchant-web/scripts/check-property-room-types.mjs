import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const esbuild = require('esbuild');
const filename = fileURLToPath(new URL('../src/views/properties/new.vue', import.meta.url));
const { descriptor } = parse(readFileSync(filename, 'utf8'));
const script = compileScript(descriptor, { id: 'property-room-types-test' });
const { outputFiles } = await esbuild.build({
  stdin: { contents: script.content, loader: 'ts' },
  bundle: true, write: false, format: 'iife', globalName: 'subject',
  plugins: [{ name: 'isolated-property', setup(build) {
    build.onResolve({ filter: /.*/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents:
      path === 'vue' ? 'export const {defineComponent,computed,ref}=h.vue; export const onMounted=()=>{}; export const onBeforeUnmount=()=>{};' :
      path === 'vue-router' ? 'export const useRoute=()=>({path:"/properties/new",query:{}}); export const useRouter=()=>h.router;' :
      path === 'vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
      path === 'ant-design-vue' ? 'export const message={warning:key=>h.warnings.push(key)};' :
      path === '@ant-design/icons-vue' ? 'export const CheckCircleFilled={},CloseOutlined={},FileImageOutlined={},FilePdfOutlined={},LeftOutlined={},RightOutlined={},UploadOutlined={},WarningOutlined={};' :
      path === '@/api/properties' ? 'export const apiPropertySave=input=>h.save(input); export const apiPropertyKyc=()=>h.kyc(); export const apiPropertyKycSubmit=()=>{}; export const apiPropertyKycUpload=()=>{};' :
      path === '@/stores/user' ? 'export const useUserStore=()=>({accountType:2,profile:{merchantId:7},properties:[]});' :
      (() => { throw new Error(path); })(),
    }));
  } }],
});

function fixture() {
  const h = { vue, saved: [], navigations: [], warnings: [],
    save: async input => { h.saved.push(input); return { propertyId: 42 }; },
    kyc: async () => ({ propertyName: 'Test Hotel', businessType: 'hotel', merchantId: 7, location: '', kycStatus: 0, rejectReason: '', documents: [] }),
    router: { replace: async target => h.navigations.push(target) },
  };
  const context = vm.createContext({ h });
  vm.runInContext(outputFiles[0].text, context);
  const s = context.subject.default.setup({}, { expose() {} });
  s.propertyName.value = 'Test Hotel';
  return { h, s };
}

let passed = 0;
for (const value of [-1, -10, -0.5, 1.5, '', 'invalid', NaN, Infinity]) {
  const { h, s } = fixture();
  s.roomTypes.value = value;
  await s.next();
  assert.equal(h.saved.length, 0, `Invalid count ${String(value)} must not save a property`);
  assert.equal(h.navigations.length, 0);
  assert.equal(s.step.value, 1);
  assert.equal(s.saving.value, false);
  assert.deepEqual(h.warnings, ['properties.new.invalidRoomTypes']);
  passed++;
}
for (const value of [0, 1, 12]) {
  const { h, s } = fixture();
  s.roomTypes.value = value;
  await s.next();
  assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].propertyName, 'Test Hotel');
  assert.equal(s.step.value, 2);
  assert.equal(s.saving.value, false);
  assert.equal(h.warnings.length, 0);
  passed++;
}
const { h, s } = fixture();
s.roomTypes.value = -1;
await s.next();
s.roomTypes.value = 2;
await s.next();
assert.equal(h.saved.length, 1);
assert.equal(s.step.value, 2);
passed++;
console.log(`Property room types: ${passed} tests passed`);
