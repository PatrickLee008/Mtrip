// Local-only QA routing, for the real merchant/consumer UIs against isolated services.
const http = require('node:http');
const net = require('node:net');
function port(url) {
  if (/^\/api\/v1\/merchant\/(auth|notifications|properties|account|role)\//.test(url)) return 19506;
  if (/^\/api\/v1\/merchant\/order\//.test(url)) return 19504;
  return url.startsWith('/api/v1/app/') ? 19512 : 19502;
}
const server = http.createServer((req,res) => {
  const upstream=http.request({hostname:'127.0.0.1',port:port(req.url),method:req.method,path:req.url,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
});
server.on('upgrade',(req,socket,head)=>{
  const upstream=net.connect(port(req.url),'127.0.0.1',()=>{
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`+Object.entries(req.headers).map(([key,value])=>`${key}: ${value}\r\n`).join('')+'\r\n');
    if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
  });
  upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
});
server.listen(19501,'127.0.0.1',()=>console.log('Isolated QA proxy listening on 19501'));
