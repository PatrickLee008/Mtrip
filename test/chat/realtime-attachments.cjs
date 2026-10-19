/* Run after CHAT_QA_KEEP=1 python3 test/chat/run-integration.py. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const WebSocket = require('../../client-app/node_modules/ws');
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let passes = 0;
function check(label, value) { if (!value) throw Error(label); console.log('PASS', label); passes++; }
async function request(route, data, token, port = 19502) {
  const r = await fetch(`http://127.0.0.1:${port}/api/v1/${route}`, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: data === undefined ? undefined : JSON.stringify(data) });
  return r.json();
}
async function ok(...args) { const r = await request(...args); if (r.code !== 0) throw Error(JSON.stringify(r)); return r.data; }
function mysql(sql) { return execFileSync('docker', ['exec','-i','mtrip-mysql-1','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N --default-character-set=utf8mb4'], { input: sql, encoding:'utf8' }); }
async function open(token, role, port = 19502) {
  const { ticket } = await ok(`${role}/chat/ticket`, {}, token, port);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/${role}/chat/socket?ticket=${ticket}`);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('WebSocket ready timeout')), 12000);
    ws.on('error', reject);
    ws.on('message', raw => { if (JSON.parse(raw).kind === 'ready') { clearTimeout(timeout); resolve(); } });
    ws.on('close', code => { clearTimeout(timeout); reject(Error('Closed before ready: '+code)); });
  });
  return { ws, ticket };
}
function waitEvent(ws, predicate, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', listener); reject(Error('Realtime event timeout')); }, ms);
    function listener(raw) { const event = JSON.parse(raw); if (predicate(event)) { clearTimeout(timer); ws.off('message', listener); resolve(event); } }
    ws.on('message', listener);
  });
}
async function upload(bytes, filename, type, token = s.consumer) {
  const form = new FormData(); form.set('conversationId', String(s.conversationId)); form.set('file', new Blob([bytes], { type }), filename);
  return (await fetch('http://127.0.0.1:19512/api/v1/app/chat/upload', { method:'POST', headers: { Authorization:`Bearer ${token}` }, body:form })).json();
}
(async () => {
  const consumer = await open(s.consumer,'app',19512);
  const employee = await open(s.staff,'merchant');
  const outsider = await open(s.outsider,'merchant');
  let leaked = false;
  outsider.ws.on('message',raw => { if (JSON.parse(raw).conversationId === s.conversationId) leaked = true; });
  let internalLeak = false;
  consumer.ws.on('message',raw => { if (JSON.parse(raw).kind === 'internal') internalLeak = true; });
  const visitorEvent = waitEvent(employee.ws, e => e.kind === 'message' && e.conversationId === s.conversationId);
  const message = await ok('app/chat/send',{ conversationId:s.conversationId, content:'Realtime question from the consumer pool', clientMessageId:'qa-websocket-consumer' },s.consumer,19512);
  await visitorEvent; check('consumer pool publishes to merchant pool over WebSocket',true);
  const merchantEvent = waitEvent(consumer.ws,e => e.kind === 'message' && e.conversationId === s.conversationId);
  const reply = await ok('merchant/chat/send',{ conversationId:s.conversationId, content:'Realtime reply from merchant pool', clientMessageId:'qa-websocket-merchant' },s.owner);
  await merchantEvent; check('merchant pool publishes to consumer pool over WebSocket',true);
  const receiptEvent = waitEvent(employee.ws,e => e.kind === 'receipt');
  await ok('app/chat/receipt',{conversationId:s.conversationId,messageId:reply.messageId,read:1},s.consumer,19512); await receiptEvent;
  await ok('app/chat/receipt',{conversationId:s.conversationId,messageId:message.messageId,read:0},s.consumer,19512);
  const receipts=(await ok('merchant/chat/messages?conversationId='+s.conversationId,undefined,s.owner)).receipts;
  check('delivery/read positions never move backward',receipts.find(r=>r.actor_role==='user').read_id===reply.messageId);
  const reused = new WebSocket(`ws://127.0.0.1:19512/api/v1/app/chat/socket?ticket=${consumer.ticket}`);
  const closeCode = await new Promise(resolve=>reused.on('close',resolve)); check('connection ticket is single use',closeCode===4003);
  const img = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64');
  const attachment = await upload(img,'arrival.png','image/png'); check('allowed image upload accepted',attachment.code===0);
  const parallelTickets = await Promise.all(Array.from({length:5},()=>request('app/chat/file-ticket',{attachmentId:attachment.data.id},s.consumer,19512)));
  check('parallel thumbnail file tickets all succeed with unique capabilities',parallelTickets.every(r=>r.code===0) && new Set(parallelTickets.map(r=>r.data.ticket)).size===5);
  const pdf = await upload(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),'guide.pdf','application/pdf'); check('PDF upload accepted',pdf.code===0);
  check('spoofed file MIME rejected',(await upload(Buffer.from('<script>alert(1)</script>'),'spoof.jpg','image/jpeg')).code!==0);
  check('extension mismatch rejected',(await upload(img,'arrival.pdf','image/png')).code!==0);
  check('oversized image rejected',(await upload(Buffer.alloc(10*1024*1024+1),'large.png','image/png')).code!==0);
  check('consumer cannot attach an upload from another account',(await request('app/chat/send',{conversationId:s.conversationId,content:'spoof',clientMessageId:'qa-forged-attachment',attachmentIds:[attachment.data.id]},s.otherUser)).code!==0);
  await ok('app/chat/send',{conversationId:s.conversationId,content:'Arrival information',clientMessageId:'qa-attachment-send',attachmentIds:[attachment.data.id,pdf.data.id]},s.consumer,19512);
  check('message has authenticated attachment metadata',(await ok('merchant/chat/messages?conversationId='+s.conversationId,undefined,s.owner)).list.at(-1).attachments.length===2);
  check('unrelated merchant cannot issue file ticket',(await request('merchant/chat/file-ticket',{attachmentId:attachment.data.id},s.outsider)).code!==0);
  const {ticket} = await ok('merchant/chat/file-ticket',{attachmentId:attachment.data.id},s.owner);
  const download=await fetch('http://127.0.0.1:19502/api/v1/merchant/chat/file?ticket='+ticket);
  check('private attachment downloaded through another service instance',download.ok && Buffer.compare(Buffer.from(await download.arrayBuffer()),img)===0);
  check('download ticket is single use',!(await fetch('http://127.0.0.1:19502/api/v1/merchant/chat/file?ticket='+ticket)).ok);
  const note=(await ok('merchant/chat/detail?conversationId='+s.conversationId,undefined,s.owner)).note;
  const internalEvent=waitEvent(employee.ws,e=>e.kind==='internal');
  await ok('merchant/chat/note',{conversationId:s.conversationId,content:'Do not disclose to consumer',version:note.version},s.owner); await internalEvent;
  check('internal event stays on staff connections',!internalLeak);
  check('cross-merchant socket receives no conversation identifiers',!leaked);
  const recipientRows=mysql(`SELECT DISTINCT recipient_id FROM ${s.business}.merchant_notify WHERE request_id LIKE 'chat-${message.messageId}-%'`);
  check('assigned conversation notifies only the assignee',recipientRows.trim()==='2');
  const max=Number(mysql(`SELECT MAX(id) FROM ${s.business}.chat_message WHERE conversation_id=${s.conversationId}`).trim());
  mysql(`UPDATE ${s.business}.merchant_employee_property SET created_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE admin_id=2;`);
  check('new property grant does not make earlier history personally unread',(await ok('merchant/chat/summary',undefined,s.staff)).unread===0);
  mysql(`DELETE FROM ${s.business}.merchant_employee_property WHERE admin_id=2;`);
  check('revoked property access blocks HTTP immediately',(await request('merchant/chat/detail?conversationId='+s.conversationId,undefined,s.staff)).code!==0);
  const revoked=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Revoked socket stayed connected')),18000);employee.ws.on('close',code=>{clearTimeout(timer);resolve(code);});});
  // All-properties sockets can remain connected for other properties; they must stop receiving revoked events.
  check('revoked selected/property session disconnects',revoked===4003);
  consumer.ws.close(); outsider.ws.close();
  console.log('PASS_COUNT='+passes);
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode||0),100));
