/* Preserve platform support semantics while exposing realtime replies to the new consumer screen. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const WebSocket = require('../../client-app/node_modules/ws');
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const env = Object.fromEntries(fs.readFileSync(s.qaDirectory + '/env', 'utf8').split('\n').filter(line => line.includes('=')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
function admin(site) {
  const raw = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ aud:'admin', admin_id:1, admin_name:'QA Platform Agent', site_id:site, is_super:false, permissions:['user:chat:reply'], exp:Math.floor(Date.now()/1000)+300 })).toString('base64url');
  return raw + '.' + crypto.createHmac('sha256',env.MTRIP_JWT_SECRET).update(raw).digest('base64url');
}
let passes=0;
function check(label,value) { if(!value) throw Error(label); console.log('PASS',label); passes++; }
async function request(route,data,token=s.consumer) {
  return (await fetch('http://127.0.0.1:19502/api/v1/'+route,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Site-Id':'1'},body:data===undefined?undefined:JSON.stringify(data)})).json();
}
async function ok(...args) { const r=await request(...args); if(r.code!==0) throw Error(JSON.stringify(r)); return r.data; }
(async()=>{
  const c=(await ok('app/chat/start',{type:2})).conversationId;
  await ok('app/chat/send',{conversationId:c,content:'I need platform support'});
  const history=(await ok(`app/chat/messages?conversationId=${c}&cursor=1`)).list;
  check('platform conversation retains consumer and bot messages',history.length===2 && history[0].sender_type===1 && history[1].sender_type===3);
  check('merchant cannot enter platform support conversation',(await request(`merchant/chat/detail?conversationId=${c}`,undefined,s.owner)).code!==0);
  const {ticket}=await ok('app/chat/ticket',{});
  const ws=new WebSocket('ws://127.0.0.1:19502/api/v1/app/chat/socket?ticket='+ticket);
  await new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(Error('ready timeout')),10000); ws.once('error',reject); ws.on('message',raw=>{if(JSON.parse(raw).kind==='ready'){clearTimeout(timer);resolve();}}); });
  const event=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('platform reply timeout')),10000); ws.on('message',raw=>{const e=JSON.parse(raw);if(e.kind==='message'&&e.conversationId===c){clearTimeout(timer);resolve();}});});
  await ok('admin/chat/reply',{conversationId:c,content:'A platform agent is here to help.'},admin(1)); await event;
  check('platform agent reply reaches consumer realtime',true);
  check('platform agent remains site scoped',(await request(`admin/chat/messages?conversationId=${c}`,undefined,admin(2))).code!==0);
  await ok('admin/chat/close',{conversationId:c},admin(1));
  check('closed platform support keeps its original no-reopen rule',(await request('app/chat/send',{conversationId:c,content:'After closure'})).code!==0 && (await ok('app/chat/start',{type:2})).conversationId!==c);
  const hotel=s.orderConversationId;
  const detail=await ok(`merchant/chat/detail?conversationId=${hotel}`,undefined,s.owner);
  await ok('merchant/chat/resolve',{conversationId:hotel,version:detail.version},s.owner);
  await ok('admin/chat/reply',{conversationId:hotel,content:'Platform agent assisting this hotel booking.',clientMessageId:'qa-platform-hotel-reply'},admin(1));
  const hotelMessages=(await ok(`app/chat/messages?conversationId=${hotel}&cursor=1`)).list;
  check('platform hotel assistance reopens original thread with explicit admin identity',(await ok(`app/chat/detail?conversationId=${hotel}`)).status===0 && hotelMessages.at(-1).sender_role==='admin');
  ws.close(); console.log('PASS_COUNT='+passes);
})().catch(error=>{console.error(error);process.exit(1);});
