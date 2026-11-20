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
async function compile(relative) {
  const filename = `${src}/${relative}`;
  const { descriptor } = parse(readFileSync(filename, 'utf8'));
  const script = compileScript(descriptor, { id: 'deletion-interactions' });
  const built = await build({ stdin: { contents: script.content, loader: 'ts', resolveDir: filename.slice(0,filename.lastIndexOf('/')) },
    bundle:true, write:false, format:'iife', globalName:'subject', alias:{'@':src}, plugins:[{name:'boundaries',setup(b){
      b.onResolve({filter:/^(vue|vue-i18n|vue-router|ant-design-vue)$/},({path})=>({path,namespace:'fixture'}));
      b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:
        path==='vue' ? `export const {${Object.keys(vue).join(',')}}=host.vue;` :
        path==='vue-i18n' ? 'export const useI18n=()=>({t:key=>key});' :
        path==='vue-router' ? 'export const useRoute=()=>host.route;' :
        'export const message={warning:key=>host.warnings.push(key),success(){}};' }));
      b.onLoad({filter:/\.vue$/},()=>({contents:'export default {};'}));
      b.onLoad({filter:/[/\\]stores[/\\]user\.ts$/},()=>({contents:'export const useUserStore=()=>host.user;'}));
      b.onLoad({filter:/[/\\]utils[/\\]http\.ts$/},()=>({contents:'export const get=(...a)=>host.request("get",...a),post=(...a)=>host.request("post",...a);'}));
    }}] });
  return built.outputFiles[0].text;
}
const code=await compile('views/user/deletion/index.vue');
const reportCode=await compile('views/stats/finance/forfeiture/index.vue');
function fixture(subject=code,actor=1001,superAdmin=true){
  const host={vue,calls:[],warnings:[],route:{query:{userId:'910001'}},
    user:vue.reactive({profile:{id:actor,isSuper:superAdmin}}),
    row:{id:1,user_id:910001,approved_by:1001,finance_maker_id:3001,state:'pending_admin',approved_balance:'100.00'},
    consumer:{id:910001,balance:'100.00'},download:null,fail:false,
    request:async(method,path,body)=>{
      host.calls.push({method,path,body});
      if(host.fail && method==='post')throw Error('Transient API failure');
      if(host.gate && method==='post')await host.gate;
      if(path.endsWith('/detail'))return {request:{...host.row},consumer:host.consumer,blockers:[],policy:{threshold_amount:'500'},events:[]};
      if(path.endsWith('/config'))return {current:{threshold_amount:'500',validity_days:7},history:[],version:3};
      if(path.endsWith('/report'))return {list:[{...host.row}],total:1,page:1,pageSize:20,summary:{completedAmount:'123.45'}};
      if(path.endsWith('/export'))return {filename:'report.xlsx',mime:'application/test',base64:'UVlB'};
      if(method==='get')return {list:[{...host.row}],total:1,page:1,pageSize:20};
      return {...host.row};
    }};
  const context=vm.createContext({host,console,Intl,Date,Blob,Uint8Array,atob,
    URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL(){}},
    document:{createElement:()=>({click(){host.download={name:this.download,url:this.href};}})}});
  vm.runInContext(subject,context);
  return {host,s:context.subject.default.setup({}, {expose(){}})};
}
let count=0;
async function test(name,run){await run();count++;console.log('PASS',name);}
await test('profile user filter is carried into the work list',async()=>{
  const {s,host}=fixture();await s.load();assert.equal(host.calls[0].body.userId,910001);
});
await test('blank request reason does not call the server',async()=>{
  const {s,host}=fixture();s.openAction('request');await s.submit();assert.equal(host.calls.filter(c=>c.method==='post').length,0);assert.equal(s.actionOpen.value,true);
});
await test('support request carries user, trimmed reason and optional evidence',async()=>{
  const {s,host}=fixture();s.openAction('request');s.form.reason=' QA reason ';s.form.evidence=' REF ';await s.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(host.calls.find(c=>c.method==='post').body)),{userId:910001,reason:'QA reason',evidence:'REF'});
});
await test('approvals carry the reviewed latest balance and request id',async()=>{
  const {s,host}=fixture();await s.openDetail({id:1});s.openAction('approve');s.form.reason='Checked';await s.submit();
  const call=host.calls.find(c=>c.method==='post');assert.equal(call.body.requestId,1);assert.equal(call.body.expectedBalance,'100.00');assert.equal(call.body.approve,1);
});
await test('duplicate clicks cannot submit two reviews',async()=>{
  const {s,host}=fixture();await s.openDetail({id:1});let release;host.gate=new Promise(r=>release=r);
  s.openAction('check');s.form.reason='Checked';const a=s.submit();await s.submit();assert.equal(host.calls.filter(c=>c.method==='post').length,1);release();await a;
});
await test('API failure keeps the review draft and releases the save lock',async()=>{
  const {s,host}=fixture();await s.openDetail({id:1});s.openAction('prepare');s.form.reason='Keep this';host.fail=true;
  await assert.rejects(s.submit());assert.equal(s.form.reason,'Keep this');assert.equal(s.saving.value,false);assert.equal(s.actionOpen.value,true);
});
await test('Super Admin approver is not offered Finance preparation',async()=>{
  const {s,host}=fixture();host.row.state='pending_finance';await s.openDetail({id:1});assert.equal(s.canMake.value,false);
});
await test('independent Finance maker can prepare the request',async()=>{
  const {s,host}=fixture(code,3001,false);host.row.state='pending_finance';await s.openDetail({id:1});assert.equal(s.canMake.value,true);
});
await test('Finance maker cannot see their own checker action',async()=>{
  const {s,host}=fixture(code,3001,false);host.row.state='pending_checker';await s.openDetail({id:1});assert.equal(s.canCheck.value,false);
});
await test('independent Finance checker can proceed',async()=>{
  const {s,host}=fixture(code,4001,false);host.row.state='pending_checker';await s.openDetail({id:1});assert.equal(s.canCheck.value,true);
});
await test('expired requests do not offer Finance actions',async()=>{
  const {s,host}=fixture(code,4001,false);host.row.state='expired';await s.openDetail({id:1});assert.equal(s.canCheck.value,false);assert.equal(s.canMake.value,false);
});
await test('policy save sends the loaded revision and UTC effective time',async()=>{
  const {s,host}=fixture();await s.loadPolicy();s.policyForm.reason='Policy review';s.policyForm.effectiveAt='2026-12-01T12:30:00';await s.savePolicy();
  const call=host.calls.find(c=>c.method==='post');assert.equal(call.body.expectedVersion,3);assert.equal(call.body.effectiveAt,'2026-12-01 12:30:00');
});
await test('policy reason is mandatory before a save',async()=>{
  const {s,host}=fixture();await s.loadPolicy();await s.savePolicy();assert.equal(host.calls.filter(c=>c.method==='post').length,0);
});
await test('report displays the server ledger total',async()=>{
  const {s}=fixture(reportCode);await s.load();assert.equal(s.summary.value,'123.45');
});
await test('export uses all selected filters and returns an actual download',async()=>{
  const {s,host}=fixture(reportCode);s.query.userId=910007;s.query.state='completed';await s.download('xlsx');
  const call=host.calls.find(c=>c.method==='post');assert.equal(call.body.userId,910007);assert.equal(call.body.state,'completed');assert.equal(call.body.format,'xlsx');assert.equal(host.download.name,'report.xlsx');
});
await test('failed exports release the lock',async()=>{
  const {s,host}=fixture(reportCode);host.fail=true;await assert.rejects(s.download('csv'));assert.equal(s.exporting.value,false);
});
console.log(`PASSED ${count} account-deletion UI interaction checks`);
