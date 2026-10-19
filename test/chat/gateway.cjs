/* Run after start-gateway-qa.py. Tests real OpenResty ordering, upgrade and upload limits. */
const fs = require('node:fs');
const WebSocket = require('../../client-app/node_modules/ws');
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let passes = 0;
function check(label, valid) { if (!valid) throw Error(label); console.log('PASS', label); passes++; }
async function ok(role, path, body, token) {
  const result = await fetch(`http://127.0.0.1:19500/api/v1/${role}/chat/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await result.json(); if (data.code !== 0) throw Error(JSON.stringify(data)); return data.data;
}
async function open(role, token, port = 19500) {
  const { ticket } = await ok(role, 'ticket', {}, token);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/${role}/chat/socket?ticket=${ticket}`);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Gateway websocket timeout')), 10000);
    ws.once('error', reject);
    ws.on('message', raw => { if (JSON.parse(raw).kind === 'ready') { clearTimeout(timer); resolve(); } });
  });
  return ws;
}
(async () => {
  const consumer = await open('app', s.consumer); check('App websocket upgrade passes through actual gateway', true);
  const merchant = await open('merchant', s.owner); check('merchant websocket upgrade passes through actual gateway', true);
  const consumerStatic = await open('app', s.consumer, 19593); check('consumer H5 static server preserves websocket upgrade', true);
  const merchantStatic = await open('merchant', s.owner, 19591); check('merchant Web static server preserves websocket upgrade', true);
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Gateway event timeout')), 10000);
    merchant.on('message', raw => { const e = JSON.parse(raw); if (e.kind === 'message' && e.conversationId === s.orderConversationId) { clearTimeout(timer); resolve(); } });
  });
  await ok('app', 'send', { conversationId: s.orderConversationId, content: 'Message through real OpenResty', clientMessageId: 'qa-gateway-send-01' }, s.consumer);
  await received; check('gateway routes App writes and merchant realtime across both pools', true);
  const bytes = Buffer.alloc(20 * 1024 * 1024, 32); bytes.write('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
  const form = new FormData(); form.set('conversationId', String(s.orderConversationId)); form.set('file', new Blob([bytes], { type: 'application/pdf' }), 'limit-20mb.pdf');
  const result = await fetch('http://127.0.0.1:19500/api/v1/app/chat/upload', { method: 'POST', headers: { Authorization: `Bearer ${s.consumer}` }, body: form });
  const data = await result.json(); check('20MB PDF plus multipart overhead passes dedicated upload route', data.code === 0 && data.data.size === bytes.length);
  const ticket = await ok('app', 'file-ticket', { attachmentId: data.data.id }, s.consumer);
  const file = await fetch('http://127.0.0.1:19500/api/v1/app/chat/file?ticket=' + ticket.ticket);
  check('private file download works through normal App gateway route', file.ok && Buffer.from(await file.arrayBuffer()).length === bytes.length);
  consumer.close(); merchant.close(); consumerStatic.close(); merchantStatic.close(); console.log('PASS_COUNT=' + passes);
})().catch(error => { console.error(error); process.exit(1); });
