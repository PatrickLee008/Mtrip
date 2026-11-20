"""Local payment-center contract fixture. No bank, live channel or external request."""
from datetime import datetime, timezone
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import secrets
from threading import Thread

class Provider:
    def __init__(self, token):
        self.token, self.payments, self.refunds, self.calls = token, {}, {}, []
        parent = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_POST(self):
                if self.headers.get('X-Internal-Token') != parent.token:
                    self.send_response(403); self.end_headers(); return
                try:
                    body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                    result=parent.request(self.path,body)
                    response=dict(code=0,message='ok',data=result)
                except Exception as error:
                    response=dict(code=40001,message=str(error),data=None)
                payload=json.dumps(response).encode()
                self.send_response(200); self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(payload))); self.end_headers(); self.wfile.write(payload)
        self.server=ThreadingHTTPServer(('0.0.0.0',0),Handler)
        self.thread=Thread(target=self.server.serve_forever,daemon=True); self.thread.start()
        self.url='http://host.docker.internal:'+str(self.server.server_address[1])

    def close(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=2)

    def request(self,path,body):
        self.calls.append((path,body.copy()))
        if path.endswith('/channel/available'):
            return [dict(channel='kbz_mmqr',currencies=['MMK'],minAmount='0.01',maxAmount='99999999')]
        if path.endswith('/payment/create'):
            existing=next((p for p in self.payments.values() if p['bizNo']==body['bizNo'] and p['bizType']==body['bizType']),None)
            if existing: return existing
            pay_no='P'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')+str(secrets.randbelow(10000)).zfill(4)
            result=dict(body,payNo=pay_no,status='pending',qrCode='ISOLATED-QR-'+pay_no)
            self.payments[pay_no]=result; return result
        if path.endswith('/payment/query'):
            payment=self.payments[body['payNo']]
            refunds=[r for r in self.refunds.values() if r['payNo']==body['payNo'] and r['status'] in ['processing','succeeded']]
            return dict(payment,refundCount=payment.get('quotaOverride',len(refunds)),
                refundedAmount=str(sum((Decimal(r['amount']) for r in refunds),Decimal(0))))
        if path.endswith('/refund/create'):
            if body['refundNo'] in self.refunds: return self.refunds[body['refundNo']]
            result=dict(body,status='processing',channelRefundNo='ISOLATED-'+body['refundNo'])
            self.refunds[body['refundNo']]=result; return result
        if path.endswith('/refund/query'): return self.refunds[body['refundNo']]
        raise ValueError('Unexpected payment-center fixture endpoint: '+path)
