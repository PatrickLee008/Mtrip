#!/usr/bin/env python3
"""Isolated chat regression: empty schema clones, temporary DB user/services; no customer data copied.
Run: python3 test/chat/run-integration.py
CHAT_QA_KEEP=1 retains the generated fixtures for browser QA; cleanup instructions are printed.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RUN = secrets.token_hex(4)
BUSINESS = 'mtrip_chat_qa_' + RUN
SYSTEM = BUSINESS + '_system'
DBUSER = 'chat_qa_' + RUN
PASSWORD = secrets.token_hex(20)
JWT_SECRET = 'isolated-chat-qa-' + RUN
CONTAINERS = []
QA = Path(tempfile.mkdtemp(prefix='mtrip-chat-qa-'))
QA.chmod(0o700)
RESULTS = []
(QA/'session.json').write_text(json.dumps({'run':RUN,'business':BUSINESS,'system':SYSTEM,'dbUser':DBUSER,'containers':CONTAINERS,'qaDirectory':str(QA)}))
(QA/'session.json').chmod(0o600)
print('QA_SESSION='+str(QA/'session.json'),flush=True)


def cmd(args, data=None):
    result = subprocess.run(args, input=data, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(args[:3]) + '\n' + result.stderr[-2500:] + result.stdout[-1500:])
    return result.stdout


def mysql(sql):
    return cmd(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], sql)


def token(claims):
    now = int(time.time())
    claims = {**claims, 'iat': now, 'exp': now + 7200}
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')
    raw = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc(claims)
    return raw + '.' + base64.urlsafe_b64encode(hmac.new(JWT_SECRET.encode(), raw.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    RESULTS.append(label)
    print('PASS', label, flush=True)


def request(path, data=None, auth=None, port=19502, property_id=None):
    headers = {'Content-Type': 'application/json', 'X-Site-Id': '1'}
    if auth:
        headers['Authorization'] = 'Bearer ' + auth
    if property_id is not None:
        headers['X-Mtrip-Property-Id'] = str(property_id)
    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/' + path, data=None if data is None else json.dumps(data).encode(), headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=12)
    except urllib.error.HTTPError as e:
        r = e
    raw = r.read().decode()
    try:
        return json.loads(raw)
    except ValueError:
        raise AssertionError('Non-JSON ' + path + ': ' + raw[:600])


def ok(path, data=None, auth=None, **kwargs):
    r = request(path, data, auth, **kwargs)
    if r.get('code') != 0:
        raise AssertionError(path + ': ' + json.dumps(r, ensure_ascii=False))
    return r['data']


def cleanup():
    for c in CONTAINERS:
        subprocess.run(['docker', 'rm', '-f', c], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mysql(f'DROP DATABASE IF EXISTS `{BUSINESS}`; DROP DATABASE IF EXISTS `{SYSTEM}`; DROP USER IF EXISTS \'{DBUSER}\'@\'%\';')
    shutil.rmtree(QA)


try:
    mysql(f'CREATE DATABASE `{BUSINESS}` CHARACTER SET utf8mb4; CREATE DATABASE `{SYSTEM}` CHARACTER SET utf8mb4; CREATE USER \'{DBUSER}\'@\'%\' IDENTIFIED BY \'{PASSWORD}\'; GRANT ALL ON `{BUSINESS}`.* TO \'{DBUSER}\'@\'%\'; GRANT ALL ON `{SYSTEM}`.* TO \'{DBUSER}\'@\'%\';')
    for source, dest in [('mtrip_business', BUSINESS), ('mtrip_system', SYSTEM)]:
        schema = cmd(['docker', 'exec', 'mtrip-mysql-1', 'sh', '-c', f'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --no-data --skip-comments --set-gtid-purged=OFF {source}'])
        mysql('USE `' + dest + '`;\n' + schema)
    migration = (ROOT / 'database/migrations/V20261015100000__guest-messaging.sql').read_text().replace('USE mtrip_business;', f'USE `{BUSINESS}`;')
    mysql(migration)
    mysql(migration)
    check('migration is repeatable on empty schema clone', True)
    seed = f"""USE `{BUSINESS}`;
INSERT INTO merchant_info(id,site_id,merchant_name,credit_code,legal_person,contact_name,contact_phone,status) VALUES(1,1,'Chat QA','CHAT-QA','QA','QA','',3),(2,1,'Other merchant','CHAT-QA-2','QA','QA','',3);
INSERT INTO merchant_store(id,site_id,merchant_id,store_name,business_type,status,publish_status,operating_status) VALUES(1,1,1,'The Harbour Hotel','hotel',1,1,1),(2,1,2,'Other Hotel','hotel',1,1,1),(3,1,1,'QA Restaurant','restaurant',1,1,1);
INSERT INTO merchant_admin(id,site_id,merchant_id,account_type,username,password,real_name,is_owner,status,auth_version,created_at) VALUES(1,1,1,2,'chat-qa-owner','disabled','Hotel Manager',1,1,1,'2020-01-01'),(2,1,1,2,'chat-qa-staff','disabled','Reception',0,1,1,'2020-01-01'),(3,1,2,2,'chat-qa-other','disabled','Other Manager',1,1,1,'2020-01-01');
INSERT INTO merchant_role(id,site_id,merchant_id,account_type,role_name,status) VALUES(90,1,1,2,'Chat handler',1);
INSERT INTO merchant_admin_role(admin_id,role_id,created_at) VALUES(2,90,'2020-01-01');
INSERT INTO merchant_role_menu(role_id,menu_id,created_at) SELECT 90,id,'2020-01-01' FROM merchant_menu WHERE perm_key IN('mch:chat:list','mch:chat:reply','mch:chat:note');
INSERT INTO merchant_employee_property(site_id,admin_id,property_id,created_at) VALUES(1,2,1,'2020-01-01');
INSERT INTO user_info(id,site_id,mobile,mobile_hash,nickname,user_status) VALUES(1,1,'qa-1','qa-hash-1','Aung Kyaw',1),(2,1,'qa-2','qa-hash-2','Mya Thida',1);
INSERT INTO order_main(id,order_no,site_id,user_id,merchant_id,property_id,goods_name,sku_name,booking_status,contact_name,contact_phone,use_date,end_date) VALUES(1,'QA-BOOKING-001',1,1,1,1,'The Harbour Hotel','Deluxe King',3,'Aung Kyaw','','2026-10-15','2026-10-18'),(2,'QA-BOOKING-002',1,1,1,1,'The Harbour Hotel','Garden Twin',2,'Aung Kyaw','','2026-10-20','2026-10-22'),(3,'QA-OFFLINE-003',1,0,1,1,'The Harbour Hotel','Garden Twin',2,'Offline Guest','','2026-10-20','2026-10-22');
"""
    mysql(seed)
    image_info = json.loads(cmd(['docker', 'inspect', 'mtrip-user-service-1']))[0]
    original_env = dict(x.split('=', 1) for x in image_info['Config']['Env'] if '=' in x)
    network = next(iter(image_info['NetworkSettings']['Networks']))
    qa_env = {**original_env, 'DB_BUSINESS_DATABASE': BUSINESS, 'DB_SYSTEM_DATABASE': SYSTEM, 'DB_USERNAME': DBUSER, 'DB_PASSWORD': PASSWORD, 'MTRIP_JWT_SECRET': JWT_SECRET, 'SCAN_CACHEABLE': 'false', 'REDIS_DB': '14', 'WORKER_NUM': '2', 'MTRIP_CLIENT_SIGN': 'false', 'MTRIP_SUBMIT_LOCK': 'true', 'MTRIP_PAYLOAD_ENCRYPT': 'false'}
    envfile = QA / 'env'; envfile.write_text('\n'.join(k+'='+v for k,v in qa_env.items())+'\n'); envfile.chmod(0o600)
    for index, port in enumerate([19502, 19512]):
        name = 'mtrip-chat-qa-' + RUN + '-' + str(index)
        CONTAINERS.append(name)
        meta=json.loads((QA/'session.json').read_text()); meta['containers']=CONTAINERS; (QA/'session.json').write_text(json.dumps(meta))
        cmd(['docker','run','-d','--name',name,'--network',network,'--env-file',str(envfile),'-p',f'127.0.0.1:{port}:9502','-v',str(ROOT/'backend/shared/src')+':/shared/src:ro','-v',str(ROOT/'backend/services/user-service/app')+':/opt/www/app:ro','-v',str(ROOT/'backend/services/user-service/config')+':/opt/www/config:ro','-v',str(QA/'files')+':/opt/chat-private',image_info['Config']['Image']])
    for _ in range(35):
        try:
            urllib.request.urlopen('http://127.0.0.1:19502/healthz',timeout=1)
            urllib.request.urlopen('http://127.0.0.1:19512/healthz',timeout=1)
            break
        except Exception:
            time.sleep(0.5)
    else:
        print(cmd(['docker','logs',CONTAINERS[0]])[-6000:]); raise RuntimeError('QA services did not start')
    perms = ['mch:chat:'+a for a in ['list','reply','note','assign','resolve','settings']] + ['mch:order:detail','mch:order:message']
    def merchant(i, owner=True, m=1):
        return token({'aud':'merchant','admin_id':i,'admin_name':'Hotel Manager','site_id':1,'account_type':2,'merchant_id':m,'group_id':0,'store_id':0,'is_owner':owner,'auth_version':1,'amr':'totp','permissions':perms})
    owner, staff, outsider = merchant(1), merchant(2,False), merchant(3,True,2)
    consumer = token({'aud':'app','user_id':1,'site_id':1})
    other_user = token({'aud':'app','user_id':2,'site_id':1})
    c = ok('app/chat/start',{'type':1,'propertyId':1},consumer)['conversationId']
    check('repeat consultation reuses same thread', c == ok('app/chat/start',{'type':1,'propertyId':1},consumer)['conversationId'])
    order = ok('app/chat/start',{'type':1,'orderId':1},consumer)['conversationId']
    second = ok('app/chat/start',{'type':1,'orderId':2},consumer)['conversationId']
    check('pre-booking and separate orders stay separate', len({c,order,second})==3)
    check('consumer cannot access another user conversation', request('app/chat/detail?conversationId='+str(c),auth=other_user)['code'] != 0)
    check('cross-merchant access denied', request('merchant/chat/detail?conversationId='+str(c),auth=outsider)['code'] != 0)
    check('selected property cannot widen authorization', request('merchant/chat/detail?conversationId='+str(c),auth=owner,property_id=2)['code'] != 0)
    check('unapproved role action denied despite stale JWT permissions', request('merchant/chat/assign',{'conversationId':c,'assigneeId':2,'version':1},staff)['code'] != 0)
    payload={'conversationId':c,'content':'Hello, what is the check-in time?','clientMessageId':'qa-idempotent-01'}
    m = ok('app/chat/send',payload,consumer)['messageId']
    check('retry returns same persisted message', m == ok('app/chat/send',payload,consumer)['messageId'])
    check('same retry ID cannot change content', request('app/chat/send',{**payload,'content':'changed'},consumer)['code'] != 0)
    owner_before = ok('merchant/chat/summary',auth=owner)['unread']
    staff_before = ok('merchant/chat/summary',auth=staff)['unread']
    ok('merchant/chat/receipt',{'conversationId':c,'messageId':m,'read':1},owner)
    check('employee reads are independent', owner_before==1 and staff_before==1 and ok('merchant/chat/summary',auth=owner)['unread']==0 and ok('merchant/chat/summary',auth=staff)['unread']==1)
    ok('merchant/chat/note',{'conversationId':c,'content':'Late arrival, staff only.','version':0},owner)
    check('note version conflict rejected', request('merchant/chat/note',{'conversationId':c,'content':'Overwrite','version':0},staff)['code']!=0)
    check('internal note never reaches consumer', 'Late arrival' not in json.dumps(ok('app/chat/messages?conversationId='+str(c)+'&cursor=1',auth=consumer)))
    version=ok('merchant/chat/detail?conversationId='+str(c),auth=owner)['version']
    ok('merchant/chat/assign',{'conversationId':c,'version':version,'assigneeId':2},owner)
    check('assignment CAS rejects stale change',request('merchant/chat/resolve',{'conversationId':c,'version':version},owner)['code']!=0)
    version=ok('merchant/chat/detail?conversationId='+str(c),auth=owner)['version']
    ok('merchant/chat/resolve',{'conversationId':c,'version':version},owner)
    ok('app/chat/send',{'conversationId':c,'content':'One more question','clientMessageId':'qa-reopen-user'},consumer)
    check('guest reply reopens the same conversation',ok('merchant/chat/detail?conversationId='+str(c),auth=owner)['status']==0)
    version=ok('merchant/chat/detail?conversationId='+str(c),auth=owner)['version']; ok('merchant/chat/resolve',{'conversationId':c,'version':version},owner)
    ok('merchant/chat/send',{'conversationId':c,'content':'Welcome, check-in is at 2 PM.','clientMessageId':'qa-reopen-staff'},staff)
    check('authorized colleague can reply and reopen',ok('app/chat/detail?conversationId='+str(c),auth=consumer)['status']==0)
    ok('merchant/chat/quick-reply',{'conversationId':order,'kind':'wifi','language':'en-US','content':'Network: Harbour-Guest'},owner)
    check('Wi-Fi reply only available for in-house booking',len(ok('merchant/chat/quick-replies?conversationId='+str(order),auth=owner))==1 and len(ok('merchant/chat/quick-replies?conversationId='+str(c),auth=owner))==0)
    check('shared menu is visible to all business types', mysql(f"SELECT module_key FROM `{BUSINESS}`.merchant_menu WHERE perm_key='mch:chat:list';").strip()=='')
    config={'run':RUN,'business':BUSINESS,'system':SYSTEM,'dbUser':DBUSER,'containers':CONTAINERS,'qaDirectory':str(QA),'owner':owner,'staff':staff,'consumer':consumer,'otherUser':other_user,'outsider':outsider,'conversationId':c,'orderConversationId':order,'secondConversationId':second}
    (QA/'session.json').write_text(json.dumps(config)); (QA/'session.json').chmod(0o600)
    print('QA_SESSION='+str(QA/'session.json'),flush=True)
    print('PASS_COUNT='+str(len(RESULTS)),flush=True)
except Exception:
    for container in CONTAINERS:
        print(cmd(['docker','logs','--tail','45',container])[-3500:])
    raise
finally:
    if not os.environ.get('CHAT_QA_KEEP'):
        cleanup()
    else:
        print('Retained isolated QA services and schema. Cleanup with test/chat/cleanup.py <QA_SESSION>.',flush=True)
