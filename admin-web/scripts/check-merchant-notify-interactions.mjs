import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const vue = require('vue');
const {parse, compileScript} = require('@vue/compiler-sfc');
const {build} = require('esbuild');
const src = fileURLToPath(new URL('../src', import.meta.url));
const {descriptor} = parse(readFileSync(`${src}/components/merchant/NotifyDrawer.vue`, 'utf8'));
const script = compileScript(descriptor, {id:'notify-test'});
const icons = ['CloseOutlined','FileTextOutlined','DownOutlined','SearchOutlined','LinkOutlined','MobileOutlined','DesktopOutlined','MailOutlined','MessageOutlined','CheckCircleFilled','ThunderboltOutlined','CalendarOutlined','SendOutlined','EyeOutlined','BellOutlined','HistoryOutlined'];
const {outputFiles} = await build({stdin:{contents:script.content,loader:'ts',resolveDir:src},bundle:true,write:false,format:'iife',globalName:'subject',alias:{'@':src},plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/^(vue|vue-i18n|ant-design-vue|@ant-design\/icons-vue)$/},({path})=>({path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='vue'?`export const {${Object.keys(vue).join(',')}}=host.vue;`:path==='vue-i18n'?'export const useI18n=()=>({t:(key,params)=>params?key+JSON.stringify(params):key});':path==='@ant-design/icons-vue'?`export const ${icons.map(i=>`${i}={}`).join(',')};`:'export const message={warning:x=>host.warnings.push(x),success:x=>host.success.push(x)};export const Modal={info(){}};'}));
  b.onLoad({filter:/\/utils\/http\.ts$/},()=>({contents:'export const get=(...a)=>host.request("get",...a),post=(...a)=>host.request("post",...a);'}));
}}]});
function fixture(){
  const host={vue,calls:[],events:[],warnings:[],success:[]};
  host.request=async(method,path,data)=>{host.calls.push({method,path,data});return path.endsWith('/channels')?{inapp:true,email:false,sms:false,push:false}:path.endsWith('/templates')?[]:path.endsWith('/list')?{list:[],total:0,page:1,pageSize:5}:{id:7,deliveries:[{channel:'inapp',status:'delivered'}]};};
  const props=vue.reactive({open:false,merchant:{id:9,merchant_code:'MCH-0009',merchant_name:'Parent merchant',contact_email:'ops@example.test',contact_phone:'***1234'}});
  const context=vm.createContext({host,console,crypto:globalThis.crypto,Date:class extends Date {static now(){return host.now ?? Date.now();}}});vm.runInContext(outputFiles[0].text,context);
  const s=context.subject.default.setup(props,{expose(){},emit:(...a)=>host.events.push(a)});
  return {host,props,s};
}
async function flush(){await vue.nextTick();await new Promise(resolve=>setImmediate(resolve));await vue.nextTick();}
async function ready(){const f=fixture();f.props.open=true;await flush();return f;}
function valid(s){Object.assign(s.form,{category:'system',title:'Service update',message:'Maintenance is complete.',channels:['inapp'],deepLinkType:'none',deepLinkValue:'',sendType:1});}
let count=0;
async function test(name,run){await run();console.log('PASS',name);count++;}
await test('unresolved template variables in title or body block transmission',async()=>{
  const {s,host}=await ready();valid(s);s.form.title='Booking {{booking_id}}';await s.send();valid(s);s.form.message='Refund {{ amount }}';await s.send();
  assert.equal(host.calls.filter(c=>c.method==='post').length,0);assert.ok(host.warnings.length>=2);
});
await test('required category, channel, owned target ID and valid future schedule are checked before sending',async()=>{
  const {s,host}=await ready();
  for(const patch of [{category:undefined},{title:' '},{message:' '},{channels:[]},{channels:['email']},{deepLinkType:'booking_detail',deepLinkValue:'abc'},{deepLinkType:'page',deepLinkValue:'https://example.test'},{sendType:2},{sendType:2,scheduleDate:'2020-01-01',scheduleTime:'12:00'},{sendType:2,scheduleDate:'2099-02-30',scheduleTime:'12:00'}]){valid(s);Object.assign(s.form,patch);await s.send();}
  assert.equal(host.calls.filter(c=>c.method==='post').length,0);
});
await test('scheduled Myanmar local time converts to the correct UTC instant',async()=>{
  const {s,host}=await ready();valid(s);Object.assign(s.form,{sendType:2,scheduleDate:'2099-01-02',scheduleTime:'08:15'});await s.send();
  const call=host.calls.find(c=>c.method==='post');assert.equal(call.data.sendAt,'2099-01-02T01:45:00.000Z');assert.equal(call.data.merchantId,9);
});
await test('template search and selection fill editable fields without changing recipient or channels',async()=>{
  const {s}=await ready();s.templates.value=[{id:1,category:'booking',title:'Booking confirmed',message:'Booking {{booking_id}}',deep_link_type:'booking_detail',deep_link_value:''},{id:2,category:'refund',title:'Refund done',message:'Money returned',deep_link_type:'wallet',deep_link_value:''}];
  s.templateQuery.value='REFUND';assert.equal(s.filteredTemplates.value.length,1);assert.equal(s.filteredTemplates.value[0].id,2);
  s.applyTemplate(1);assert.equal(s.form.category,'booking');assert.equal(s.form.title,'Booking confirmed');assert.equal(s.form.message,'Booking {{booking_id}}');assert.equal(s.form.deepLinkType,'booking_detail');assert.equal(s.form.channels.join(','),'inapp');
});
await test('preview preserves literal markup as text and marks unresolved variables',async()=>{
  const {s,host}=await ready();valid(s);s.form.message='<img src=x> {{booking_id}}';s.preview();assert.equal(s.previewOpen.value,true);
  const parts=s.previewParts(s.form.message);assert.equal(parts.map(p=>p.text).join(''),'<img src=x> {{booking_id}}');assert.ok(parts.some(p=>p.variable));assert.equal(host.calls.filter(c=>c.method==='post').length,0);
});
await test('double submits are suppressed and retries keep their key until the payload changes',async()=>{
  const {s,host}=await ready();valid(s);let reject;host.request=(method,path,data)=>{host.calls.push({method,path,data});return new Promise((yes,no)=>{reject=no;});};
  const pending=s.send();await s.send();assert.equal(host.calls.filter(c=>c.method==='post').length,1);reject(new Error('network'));await pending;
  const key=host.calls.find(c=>c.method==='post').data.requestId;host.request=async(method,path,data)=>{host.calls.push({method,path,data});throw new Error('still unavailable');};
  await s.send();assert.equal(host.calls.filter(c=>c.method==='post')[1].data.requestId,key);s.form.message='Updated text';await s.send();assert.notEqual(host.calls.filter(c=>c.method==='post')[2].data.requestId,key);
});
await test('a scheduled request with a lost response can retry after its due time using the same key',async()=>{
  const {s,host}=await ready();valid(s);Object.assign(s.form,{sendType:2,scheduleDate:'2099-01-02',scheduleTime:'08:15'});
  host.now=Date.parse('2099-01-02T01:44:00Z');host.request=async(method,path,data)=>{host.calls.push({method,path,data});throw new Error('response lost');};
  await s.send();const first=host.calls.find(c=>c.method==='post');host.now=Date.parse('2099-01-02T01:46:00Z');await s.send();
  const posts=host.calls.filter(c=>c.method==='post');assert.equal(posts.length,2);assert.equal(posts[1].data.requestId,first.data.requestId);
  s.form.title='Different notification';await s.send();assert.equal(host.calls.filter(c=>c.method==='post').length,2);
});
await test('changing merchant clears draft and prevents stale request results leaking across recipients',async()=>{
  const {s,host,props}=await ready();valid(s);const pending=[];
  host.request=(method,path)=>path.endsWith('/templates')?new Promise(resolve=>pending.push(resolve)):Promise.resolve({inapp:true});
  const old=s.loadTemplates();props.merchant={id:10,merchant_code:'MCH-0010',merchant_name:'Other'};await flush();
  pending[1]([{id:20,title:'New merchant'}]);await flush();
  pending[0]([{id:19,title:'Old merchant'}]);await old;
  assert.equal(s.form.title,'');assert.equal(s.form.category,undefined);assert.equal(s.templates.value[0].id,20);
  s.preview();props.open=false;await flush();assert.equal(s.previewOpen.value,false);

});
await test('channel and template request failures remain explicit and retryable',async()=>{
  const {s,host}=await ready();host.request=async()=>{throw new Error('unavailable');};await s.loadChannels();await s.loadTemplates();assert.equal(s.channelsFailed.value,true);assert.equal(s.templatesFailed.value,true);assert.equal(s.templates.value.length,0);
  host.request=async(method,path)=>path.endsWith('/channels')?{inapp:true,email:false}:[];await s.loadChannels();await s.loadTemplates();assert.equal(s.channelsFailed.value,false);assert.equal(s.templatesFailed.value,false);
});
await test('history failures clear rows and stale history responses cannot overwrite a newer page',async()=>{
  const {s,host}=await ready();s.notifications.value=[{id:1,title:'Old'}];host.request=async()=>{throw new Error('unavailable');};await s.loadHistory();assert.equal(s.historyFailed.value,true);assert.equal(s.notifications.value.length,0);
  const pending=[];host.request=()=>new Promise(resolve=>pending.push(resolve));const first=s.loadHistory(1);const second=s.loadHistory(2);pending[1]({list:[{id:2}],total:9});await second;pending[0]({list:[{id:1}],total:4});await first;assert.equal(s.notifications.value[0].id,2);assert.equal(s.historyPage.value,2);
});
console.log(`${count} merchant notification interaction checks passed`);
