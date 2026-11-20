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
async function compile(filename) {
  const { descriptor } = parse(readFileSync(`${src}/${filename}`, 'utf8'));
  const script = compileScript(descriptor, { id: 'merchant-commercial' });
  const { outputFiles } = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: `${src}/${filename}`.replace(/[/\\][^/\\]+$/, '') },
    bundle: true, write: false, format: 'iife', globalName: 'subject', alias: { '@': src },
    plugins: [{ name: 'merchant-detail-boundaries', setup(b) {
      b.onResolve({ filter: /^(vue|vue-i18n|vue-router|ant-design-vue|@ant-design\/icons-vue)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
        path === 'vue' ? `export const {${Object.keys(vue).filter(key => key !== 'onMounted').join(',')}}=fixtureHost.vue; export const onMounted=()=>{};` :
        path === 'vue-i18n' ? 'export const useI18n=()=>({t:(key,params)=>params ? key+JSON.stringify(params) : key});' :
        path === 'vue-router' ? 'export const useRoute=()=>({query:{}});' :
        path === '@ant-design/icons-vue' ? 'export const BellOutlined={},LoginOutlined={},EyeOutlined={},DownloadOutlined={},ExclamationCircleOutlined={},CloseOutlined={},CalculatorOutlined={},HistoryOutlined={};' :
        'export const message={success(){},warning(){}}; export const Modal={confirm:options=>fixtureHost.confirm=options};',
      }));
      b.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {};' }));
      b.onLoad({ filter: /[/\\]stores[/\\]user\.ts$/ }, () => ({ contents: 'export const useUserStore=()=>fixtureHost.user;' }));
      b.onLoad({ filter: /[/\\]utils[/\\]http\.ts$/ }, () => ({ contents: 'export const get=(...args)=>fixtureHost.request("get",...args),post=(...args)=>fixtureHost.request("post",...args);' }));
    } }],
  });
  return outputFiles[0].text;
}

const code = await compile('components/merchant/CommercialSettingsDrawer.vue');
const propertyCode = await compile('components/merchant/PropertyCommissionSettings.vue');
const terms = { version: 0, commission_plan: null, commission_rate: '8.00', transaction_fee_rate: '2.00', pay_at_hotel_enabled: true, no_show_fee_enabled: true, merchant_upfront_rate: '20.00', effective_at: null, created_at: null, created_by_name: '', reason: '' };
function fixture() {
  const host = { vue, calls: [], events: [], user: { profile: { isSuper: true } }, response: { merchant_id: 9, latest_version: 4, current: { ...terms }, next: null } };
  host.request = async (method,path,data) => { host.calls.push({method,path,data}); return host.response; };
  const props=vue.reactive({merchant:{id:9,merchant_code:'MCH-0009',merchant_name:'Parent Merchant'}});
  const context=vm.createContext({fixtureHost:host,console,crypto:globalThis.crypto});
  vm.runInContext(code,context);
  const s=context.subject.default.setup(props,{expose(){},emit:(...args)=>host.events.push(args)});
  return {host,s,props};
}
let passed=0;
async function test(name,run){await run();console.log('PASS',name);passed++;}
async function ready(){const f=fixture();await f.s.openEdit();return f;}
function valid(s){Object.assign(s.form,{commissionPlan:'premium',commissionRate:8,transactionFeeRate:2,payAtHotelEnabled:true,noShowFeeEnabled:true,merchantUpfrontRate:20,effectiveAt:s.toDate('2026-11-18 10:30:00').millisecond(123),reason:'  Contract renewal  '});}
await test('opening editor loads latest saved version without silently assigning an unset plan',async()=>{
  const {s}=await ready();assert.equal(s.expectedVersion.value,4);assert.equal(s.form.commissionPlan,undefined);assert.equal(s.form.commissionRate,8);assert.equal(s.form.reason,'');assert.equal(s.form.effectiveAt,undefined);
});
await test('preview uses actual rates and applies the transaction fee only to commission',async()=>{
  const {s}=await ready();valid(s);await vue.nextTick();
  assert.equal(s.preview.value.commission,8000);assert.equal(s.preview.value.transactionFee,160);assert.equal(s.preview.value.merchantUpfront,20000);assert.equal(s.preview.value.upfront,28160);assert.equal(s.preview.value.balance,72000);
});
await test('disabling no-show or pay-at-hotel clears inapplicable upfront terms',async()=>{
  const {s}=await ready();valid(s);s.form.noShowFeeEnabled=false;await vue.nextTick();assert.equal(s.form.merchantUpfrontRate,0);
  s.form.noShowFeeEnabled=true;s.form.merchantUpfrontRate=20;s.form.payAtHotelEnabled=false;await vue.nextTick();assert.equal(s.form.noShowFeeEnabled,false);assert.equal(s.form.merchantUpfrontRate,0);
});
await test('missing required fields and invalid monetary rates never submit',async()=>{
  const {s,host}=await ready();
  for(const patch of [{reason:'   '},{effectiveAt:undefined},{commissionRate:-1},{commissionRate:100.01},{transactionFeeRate:100.01},{merchantUpfrontRate:30.01},{commissionRate:80,merchantUpfrontRate:30},{commissionRate:8.001}]){
    valid(s);Object.assign(s.form,patch);await s.save();
  }
  assert.equal(host.calls.filter(c=>c.method==='post').length,0);
});
await test('saving sends merchant identity, revision, timezone-aware effective time and trimmed reason',async()=>{
  const {s,host}=await ready();valid(s);await s.save();const call=host.calls.find(c=>c.method==='post');
  assert.equal(call.path,'/admin/merchant/commercial-settings');assert.equal(call.data.id,9);assert.equal(call.data.expectedVersion,4);assert.equal(call.data.reason,'Contract renewal');assert.equal(call.data.merchantUpfrontRate,20);assert.match(call.data.effectiveAt,/\.000Z$/);assert.ok(call.data.requestId);assert.equal(s.editOpen.value,false);assert.equal(host.events[0][0],'changed');
});
await test('double submit is suppressed and failed request retries reuse the same idempotency key',async()=>{
  const {s,host}=await ready();valid(s);let reject;host.request=(method,path,data)=>{host.calls.push({method,path,data});return new Promise((resolve,no)=>{reject=no;});};
  const pending=s.save();await s.save();assert.equal(host.calls.filter(c=>c.method==='post').length,1);reject(new Error('network'));await pending;assert.equal(s.editOpen.value,true);const key=host.calls.find(c=>c.method==='post').data.requestId;
  host.request=async(method,path,data)=>{host.calls.push({method,path,data});return host.response;};await s.save();assert.equal(host.calls.filter(c=>c.method==='post')[1].data.requestId,key);
});
await test('failed history loads clear stale records and show a retryable error rather than an empty history',async()=>{
  const {s,host}=await ready();s.history.list.value=[terms];s.history.total.value=1;
  host.request=async()=>{throw new Error('history unavailable');};
  await s.loadHistory(2);assert.equal(s.historyFailed.value,true);assert.equal(s.history.list.value.length,0);assert.equal(s.history.total.value,0);
  host.request=async()=>({list:[{...terms,version:2}],total:1,page:2,pageSize:10});
  await s.loadHistory(2);assert.equal(s.historyFailed.value,false);assert.equal(s.history.list.value[0].version,2);
});
await test('older history responses cannot replace the most recently requested page',async()=>{
  const {s,host}=await ready();const pending=[];host.request=()=>new Promise(resolve=>pending.push(resolve));
  const first=s.loadHistory(1);const second=s.loadHistory(2);
  pending[1]({list:[{...terms,version:2}],total:20});await second;
  pending[0]({list:[{...terms,version:1}],total:10});await first;
  assert.equal(s.history.list.value[0].version,2);assert.equal(s.history.total.value,20);assert.equal(s.history.page.value,2);assert.equal(s.history.loading.value,false);
});
function propertyFixture() {
  const host={vue,calls:[],events:[],user:{profile:{isSuper:true}},failList:false,failPost:false};
  host.request=async(method,path,data)=>{
    host.calls.push({method,path,data});
    if(path.endsWith('/detail')) {
      if(host.failList)throw Error('list unavailable');
      return {properties:[{id:data.id*10+1,store_name:'Property '+data.id}]};
    }
    if(method==='post' && host.failPost)throw Error('save unavailable');
    if(method==='post' && host.gate)await host.gate;
    return {property:{id:data.propertyId,store_name:'Property'},latest_version:3,current:{commission_rate:'12.00',version:3},history:[]};
  };
  const props=vue.reactive({merchantId:9});
  const context=vm.createContext({fixtureHost:host,console,crypto:globalThis.crypto});
  vm.runInContext(propertyCode,context);
  const s=context.subject.default.setup(props,{expose(){}});
  return {host,s,props};
}
async function settled(){await vue.nextTick();await new Promise(resolve=>setImmediate(resolve));await vue.nextTick();}
await test('property editor loads the scoped property and its latest revision',async()=>{
  const {s}=propertyFixture();await settled();assert.equal(s.selected.value,91);assert.equal(s.data.value.latest_version,3);
});
await test('switching merchant cannot retain the old property selection',async()=>{
  const {s,props}=propertyFixture();await settled();props.merchantId=10;await settled();assert.equal(s.selected.value,101);assert.equal(s.data.value.property.id,101);
});
await test('empty property change reason never submits',async()=>{
  const {s,host}=propertyFixture();await settled();s.edit();await s.save();assert.equal(host.calls.filter(c=>c.method==='post').length,0);
});
await test('restoring merchant inheritance sends explicit null, revision and UTC time',async()=>{
  const {s,host}=propertyFixture();await settled();s.edit();s.form.inherit=true;s.form.reason='Restore default';await s.save();
  const call=host.calls.find(c=>c.method==='post');assert.equal(call.data.merchantId,9);assert.equal(call.data.propertyId,91);assert.equal(call.data.commissionRate,null);assert.equal(call.data.expectedVersion,3);assert.match(call.data.effectiveAt,/Z$/);
});
await test('property save failures preserve the draft and retry request key',async()=>{
  const {s,host}=propertyFixture();await settled();s.edit();s.form.reason='Keep draft';host.failPost=true;await assert.rejects(s.save());
  const key=host.calls.find(c=>c.method==='post').data.requestId;assert.equal(s.open.value,true);assert.equal(s.saving.value,false);
  host.failPost=false;await s.save();assert.equal(host.calls.filter(c=>c.method==='post')[1].data.requestId,key);
});
await test('property list load failure can retry without reopening the merchant',async()=>{
  const {s,host}=propertyFixture();await settled();host.failList=true;await s.loadProperties();assert.equal(s.failed.value,true);
  host.failList=false;s.retry();await settled();assert.equal(s.failed.value,false);assert.equal(s.selected.value,91);
});
console.log(`${passed} commercial settings interaction checks passed`);
