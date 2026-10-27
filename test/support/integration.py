#!/usr/bin/env python3
"""Support HTTP regression in empty schema clones and temporary containers.

No customer rows are copied. SUPPORT_QA_KEEP=1 retains fixtures for browser QA;
remove retained resources with python3 test/support/integration.py --cleanup SESSION.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import io
import json
import os
import re
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def command(args, data=None):
    p = subprocess.run(args, input=data, text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(args[:3]) + '\n' + p.stderr[-1800:] + p.stdout[-1200:])
    return p.stdout


def mysql(sql):
    return command(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], sql)


def cleanup(meta):
    suffix = meta['business'].removeprefix('mtrip_support_qa_')
    assert re.fullmatch('[a-f0-9]{8}', suffix) and meta['system'] == meta['business'] + '_system'
    assert meta['dbUser'] == 'support_qa_' + suffix
    assert Path(meta['directory']).resolve().name.startswith('mtrip-support-qa-')
    assert all(name in ['mtrip-support-qa-' + suffix + '-' + str(i) for i in range(2)] for name in meta['containers'])
    for name in meta['containers']:
        command(['docker', 'rm', '-f', name])
    mysql(f"DROP DATABASE IF EXISTS `{meta['business']}`; DROP DATABASE IF EXISTS `{meta['system']}`; DROP USER IF EXISTS '{meta['dbUser']}'@'%';")
    shutil.rmtree(meta['directory'])


if len(sys.argv) == 3 and sys.argv[1] == '--cleanup':
    cleanup(json.loads(Path(sys.argv[2]).read_text()))
    sys.exit(0)

RUN = secrets.token_hex(4)
BUSINESS = 'mtrip_support_qa_' + RUN
SYSTEM = BUSINESS + '_system'
DBUSER = 'support_qa_' + RUN
PASSWORD = secrets.token_hex(20)
JWT = 'isolated-support-' + RUN
QA = Path(tempfile.mkdtemp(prefix='mtrip-support-qa-'))
QA.chmod(0o700)
meta = dict(business=BUSINESS, system=SYSTEM, dbUser=DBUSER, directory=str(QA), containers=[])
session = QA / 'session.json'
RESULTS = []


def save_session():
    session.write_text(json.dumps(meta)); session.chmod(0o600)


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    RESULTS.append(label)
    print('PASS', label, flush=True)


def token(claims):
    claims = dict(claims, iat=int(time.time()), exp=int(time.time()) + 7200)
    def enc(obj):
        return base64.urlsafe_b64encode(json.dumps(obj, separators=(',', ':')).encode()).decode().rstrip('=')
    raw = enc(dict(alg='HS256', typ='JWT')) + '.' + enc(claims)
    return raw + '.' + base64.urlsafe_b64encode(hmac.new(JWT.encode(), raw.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def request(path, data=None, auth=None, prop=None, port=19525, raw=None, mime=None):
    headers = {'Content-Type': mime or 'application/json'}
    if auth:
        headers['Authorization'] = 'Bearer ' + auth
    if prop is not None:
        headers['X-Mtrip-Property-Id'] = str(prop)
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/' + path, data=body, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        response = e
    payload = response.read()
    if 'application/json' not in response.headers.get('Content-Type', ''):
        return {'code': 0 if response.status == 200 else response.status, 'data': payload, 'headers': dict(response.headers)}
    return json.loads(payload)


def ok(path, data=None, auth=None, **kwargs):
    result = request(path, data, auth, **kwargs)
    if result.get('code') != 0:
        raise AssertionError(path + ': ' + json.dumps(result, ensure_ascii=False))
    return result['data']


def upload(auth, fields, content=b'%PDF-1.4\nSupport QA\n%%EOF', name='evidence.pdf'):
    boundary = 'SupportBoundary' + RUN
    body = b''
    for key, value in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + f'\r\n--{boundary}--\r\n'.encode()
    prefix = 'admin/merchant' if fields.pop('_admin', False) else 'merchant'
    return request(prefix + '/support/attachments/upload', auth=auth, raw=body, mime='multipart/form-data; boundary=' + boundary)


try:
    save_session()
    mysql(f"CREATE DATABASE `{BUSINESS}` CHARACTER SET utf8mb4; CREATE DATABASE `{SYSTEM}` CHARACTER SET utf8mb4; CREATE USER '{DBUSER}'@'%' IDENTIFIED BY '{PASSWORD}'; GRANT ALL ON `{BUSINESS}`.* TO '{DBUSER}'@'%'; GRANT ALL ON `{SYSTEM}`.* TO '{DBUSER}'@'%';")
    for source, dest in [('mtrip_business', BUSINESS), ('mtrip_system', SYSTEM)]:
        schema = command(['docker', 'exec', 'mtrip-mysql-1', 'sh', '-c', f'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --no-data --skip-comments --set-gtid-purged=OFF {source}'])
        mysql('USE `' + dest + '`;\n' + schema)
    migration = (ROOT / 'database/migrations/V20261026100000__merchant-support.sql').read_text().replace('USE mtrip_business;', f'USE `{BUSINESS}`;').replace('USE mtrip_system;', f'USE `{SYSTEM}`;')
    mysql(migration); mysql(migration)
    check('migration repeats without duplicating tables or permissions', mysql(f"SELECT COUNT(*) FROM `{BUSINESS}`.merchant_menu WHERE perm_key LIKE 'mch:support:%';").strip() == '6')
    mysql(f"""USE `{BUSINESS}`;
INSERT INTO merchant_menu(id,parent_id,menu_name,menu_name_en,perm_key,menu_type,route_path,component,account_scope) VALUES(1200,0,'Support','Support','mch:support:list',2,'/support','support/index','1,2,3');
INSERT INTO merchant_info(id,site_id,merchant_name,credit_code,legal_person,contact_name,contact_phone,status) VALUES(1,1,'Harbour Group','SUPPORT-QA-1','QA','QA','',3),(2,1,'Other Merchant','SUPPORT-QA-2','QA','QA','',3),(3,2,'Other Site','SUPPORT-QA-3','QA','QA','',3);
INSERT INTO merchant_store(id,site_id,merchant_id,store_name,business_type,status) VALUES(1,1,1,'Harbour Hotel','hotel',1),(2,1,1,'Harbour Restaurant','restaurant',2),(3,1,2,'Other Hotel','hotel',1);
INSERT INTO merchant_admin(id,site_id,merchant_id,store_id,account_type,username,password,real_name,is_owner,status,auth_version) VALUES(1,1,1,0,2,'support-owner','disabled','Merchant Owner',1,1,1),(2,1,1,0,2,'support-staff','disabled','Property Staff',0,1,1),(3,1,2,0,2,'support-other','disabled','Other Owner',1,1,1),(4,1,1,1,3,'support-store','disabled','Store Owner',1,1,1);
INSERT INTO merchant_role(id,site_id,merchant_id,account_type,role_name,status) VALUES(90,1,1,2,'Support handler',1);
INSERT INTO merchant_admin_role(admin_id,role_id) VALUES(2,90);
INSERT INTO merchant_role_menu(role_id,menu_id) SELECT 90,id FROM merchant_menu WHERE perm_key IN('mch:support:list','mch:support:reply','mch:support:create','mch:support:close','mch:support:reopen');
INSERT INTO merchant_employee_property(site_id,admin_id,property_id) VALUES(1,2,1);
USE `{SYSTEM}`;
INSERT INTO sys_admin(id,site_id,username,password,real_name,is_super,status) VALUES(1,0,'support-super','disabled','Platform Support',1,1),(2,2,'support-other-site','disabled','Other Site Support',0,1),(3,1,'support-handler','disabled','Assigned Support',0,1);
INSERT INTO sys_role(id,site_id,role_name,status) VALUES(90,1,'Support',1),(91,2,'Other Site Support',1);
INSERT INTO sys_admin_role(admin_id,role_id) VALUES(3,90),(2,91);
INSERT INTO sys_role_menu(role_id,menu_id) SELECT 90,id FROM sys_menu WHERE perm_key LIKE 'help:ticket:%';
INSERT INTO sys_role_menu(role_id,menu_id) SELECT 91,id FROM sys_menu WHERE perm_key LIKE 'help:ticket:%';
""")
    info = json.loads(command(['docker', 'inspect', 'mtrip-merchant-service-1']))[0]
    env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    env.update(DB_BUSINESS_DATABASE=BUSINESS, DB_SYSTEM_DATABASE=SYSTEM, DB_USERNAME=DBUSER, DB_PASSWORD=PASSWORD,
               MTRIP_JWT_SECRET=JWT, SCAN_CACHEABLE='false', REDIS_DB='14', MTRIP_CLIENT_SIGN='false', MTRIP_PAYLOAD_ENCRYPT='false',
               MTRIP_SUBMIT_LOCK='false', MTRIP_REQUEST_LOG='false', HTTP_PORT='9505', WORKER_NUM='2',
               MTRIP_GUIDE_HUB_APP_ID='', MTRIP_GUIDE_HUB_APP_SECRET='', MTRIP_GUIDE_HUB_MERCHANT_SLUG='')
    envfile = QA / 'env'; envfile.write_text('\n'.join(k + '=' + v for k, v in env.items()) + '\n'); envfile.chmod(0o600)
    network = next(iter(info['NetworkSettings']['Networks']))
    for index, port in enumerate([19525, 19526]):
        name = 'mtrip-support-qa-' + RUN + '-' + str(index)
        meta['containers'].append(name); save_session()
        command(['docker', 'run', '-d', '--name', name, '--network', network, '--env-file', str(envfile), '-p', f'127.0.0.1:{port}:9505',
                 '-v', str(ROOT / 'backend/shared/src') + ':/shared/src:ro', '-v', str(ROOT / 'backend/services/merchant-service/app') + ':/opt/www/app:ro',
                 '-v', str(ROOT / 'backend/services/merchant-service/config') + ':/opt/www/config:ro', '-v', str(QA / 'files') + ':/opt/support-private', info['Config']['Image']])
    for _ in range(50):
        try:
            urllib.request.urlopen('http://127.0.0.1:19525/healthz', timeout=1)
            urllib.request.urlopen('http://127.0.0.1:19526/healthz', timeout=1)
            break
        except (OSError, urllib.error.URLError):
            time.sleep(0.3)
    else:
        raise RuntimeError('Isolated services did not start')
    def merchant(i, owner=True, mid=1, kind=2, store=0):
        return token(dict(aud='merchant', admin_id=i, admin_name='QA', site_id=1, account_type=kind, merchant_id=mid, group_id=0,
                          store_id=store, is_owner=owner, auth_version=1, amr='totp', permissions=['mch:notifications:read'] + ['mch:support:' + a for a in ['list', 'create', 'reply', 'close', 'reopen', 'merchant-scope']]))
    owner, staff, outsider, store = merchant(1), merchant(2, False), merchant(3, mid=2), merchant(4, kind=3, store=1)
    admin = token(dict(aud='admin', admin_id=1, admin_name='Platform Support', site_id=0, is_super=True))
    other_site = token(dict(aud='admin', admin_id=2, admin_name='Other Site', site_id=2, is_super=False, permissions=['help:ticket:list', 'help:ticket:reply']))
    meta.update(owner=owner, staff=staff, admin=admin); save_session()
    M = 'merchant/support/'; A = 'admin/merchant/support/'
    base = dict(requestId='create-ticket-001', merchantId=1, propertyId=1, category='technical', priority='medium', subject='Need help with calendar', description='Inventory does not match expected values.')
    created = ok(M + 'create', base, owner); tid = created['id']
    check('same request returns the same ticket', created == ok(M + 'create', base, owner))
    check('same request with changed content conflicts', request(M + 'create', dict(base, subject='Changed'), owner)['code'] == 40901)
    check('invalid categories and blank subjects rejected', all(request(M + 'create', dict(base, requestId=secrets.token_hex(8), **change), owner)['code'] == 40001 for change in [dict(subject=' '), dict(category='fake')]))
    check('merchant and platform share a persisted ticket', ok(A + f'ticket?ticketId={tid}', auth=admin)['subject'] == base['subject'])
    check('other merchant cannot guess ticket ID', request(M + f'ticket?ticketId={tid}', auth=outsider)['code'] == 40401)
    check('platform other site cannot read ticket', request(A + f'ticket?ticketId={tid}', auth=other_site)['code'] == 40401)
    general = ok(M + 'create', dict(base, requestId='create-general-001', propertyId=None, subject='Merchant account question'), owner)
    check('store owner cannot read merchant-wide ticket', request(M + f"ticket?ticketId={general['id']}", auth=store)['code'] == 40401)
    check('staff without merchant-scope cannot read general ticket', request(M + f"ticket?ticketId={general['id']}", auth=staff)['code'] == 40401)
    restaurant = ok(M + 'create', dict(base, requestId='create-restaurant-001', propertyId=2), owner, prop=2)
    check('closed restaurant property keeps authorized support history', ok(M + f"ticket?ticketId={restaurant['id']}", auth=owner, prop=2)['property_id'] == 2)
    check('property selector cannot widen employee scope', request(M + f"ticket?ticketId={restaurant['id']}", auth=staff, prop=2)['code'] == 40302)
    check('support local property filter includes authorized non-hotel resources', ok(M + 'tickets?propertyId=2', auth=owner)['list'][0]['id'] == restaurant['id'] and sum(ok(M + 'summary?propertyId=2', auth=owner).values()) == 1)
    check('local property query cannot widen employee grants', ok(M + 'tickets?propertyId=2', auth=staff)['total'] == 0)
    check('single-property list excludes general tickets', ok(M + 'tickets', auth=owner, prop=1)['total'] == 1)
    check('summary cards cover every authorized ticket', sum(ok(M + 'summary', auth=owner).values()) == 3)
    assigned = ok(A + 'assign', dict(ticketId=tid, requestId='assign-ticket-001', expectedVersion=1, assigneeId=3), admin)
    check('first assignment moves open ticket into progress', assigned['status'] == 'in_progress')
    check('stale version cannot overwrite assignment', request(M + 'reply', dict(ticketId=tid, requestId='stale-reply-001', expectedVersion=1, content='Stale'), staff)['code'] == 40901)
    reply = ok(A + 'reply', dict(ticketId=tid, requestId='admin-reply-001', expectedVersion=2, content='Please attach evidence.'), admin)
    check('platform reply requests merchant response', reply['status'] == 'waiting_merchant')
    check('authorized staff receive ticket notification', ok('merchant/notifications/summary', auth=staff)['unread'] == 2)
    check('notification does not leak to other merchant', ok('merchant/notifications/summary', auth=outsider)['total'] == 0)
    notice = ok('merchant/notifications/list', auth=staff)['list'][0]
    destination = ok('merchant/notifications/destination?id=' + str(notice['id']), auth=staff)
    check('notification deep link restores ticket and property scope', destination['query'] == dict(ticketId=str(tid), propertyId=1) and destination['propertyId'] == 1)
    owner_notice = ok('merchant/notifications/list', auth=owner)['list'][0]
    owner_unread = ok('merchant/notifications/summary', auth=owner)['unread']
    ok('merchant/notifications/read', dict(id=owner_notice['id']), owner)
    check('individual notification read is personal and idempotent', ok('merchant/notifications/summary', auth=owner)['unread'] == owner_unread - 1 and ok('merchant/notifications/summary', auth=staff)['unread'] == 2)
    ok('merchant/notifications/read', dict(id=owner_notice['id']), owner)
    check('repeated notification read does not change counts', ok('merchant/notifications/summary', auth=owner)['unread'] == owner_unread - 1)
    attachment = upload(staff, dict(ticketId=tid))
    check('private PDF upload succeeds', attachment['code'] == 0)
    fid = attachment['data']['id']
    reply = ok(M + 'reply', dict(ticketId=tid, requestId='staff-evidence-001', expectedVersion=3, content='', attachmentIds=[fid]), staff)
    check('attachment-only reply moves ticket to support queue', reply['status'] == 'waiting_support')
    check('download streams original bytes without public URL', ok(M + f'attachments/download?attachmentId={fid}', auth=owner).startswith(b'%PDF'))
    check('cross-merchant attachment denied', request(M + f'attachments/download?attachmentId={fid}', auth=outsider)['code'] == 40401)
    check('fake PDF content rejected', upload(staff, dict(ticketId=tid), b'<script>alert(1)</script>')['code'] == 40001)
    temporary = upload(staff, dict(ticketId=tid))['data']['id']
    mysql(f"UPDATE `{BUSINESS}`.merchant_support_attachment SET created_at='2020-01-01' WHERE id={temporary};")
    check('expired temporary attachment cannot be downloaded or bound', request(M + f'attachments/download?attachmentId={temporary}', auth=staff)['code'] == 40401 and request(M + 'reply', dict(ticketId=tid, requestId='expired-file-001', expectedVersion=4, attachmentIds=[temporary]), staff)['code'] == 40302)
    check('already-bound attachment cannot be reused', request(M + 'reply', dict(ticketId=tid, requestId='rebind-attempt-001', expectedVersion=4, content='Again', attachmentIds=[fid]), staff)['code'] == 40302)
    check('failed binding rolls back inserted reply and version', ok(M + f'ticket?ticketId={tid}', auth=owner)['version'] == 4 and ok(M + f'replies?ticketId={tid}', auth=owner)['total'] == 2)
    with ThreadPoolExecutor(max_workers=2) as pool:
        calls = [pool.submit(request, M + 'reply', dict(ticketId=tid, requestId='concurrent-reply-' + str(i), expectedVersion=4, content='Concurrent ' + str(i)), staff if i else owner, port=19525 + i) for i in range(2)]
        outcomes = [call.result()['code'] for call in calls]
    check('two workers enforce optimistic concurrency', sorted(outcomes) == [0, 40901])
    mysql(f"USE `{BUSINESS}`; CREATE TRIGGER support_qa_fail BEFORE INSERT ON merchant_notify_delivery FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='isolated notification failure';")
    failing = dict(ticketId=tid, requestId='rollback-notice-001', expectedVersion=5, content='Must roll back')
    check('notification failure rejects the entire action', request(A + 'reply', failing, admin)['code'] != 0)
    check('failed notification leaves version and reply count unchanged', ok(M + f'ticket?ticketId={tid}', auth=owner)['version'] == 5 and ok(M + f'replies?ticketId={tid}', auth=owner)['total'] == 3)
    mysql(f'USE `{BUSINESS}`; DROP TRIGGER support_qa_fail;')
    ok(A + 'reply', failing, admin)
    resolved = ok(A + 'status', dict(ticketId=tid, requestId='resolve-ticket-001', expectedVersion=6, status='resolved', reason='Configuration fixed'), admin)
    check('platform resolves ticket with explanation', resolved['status'] == 'resolved')
    check('terminal ticket rejects implicit reply reopening', request(M + 'reply', dict(ticketId=tid, requestId='terminal-reply-001', expectedVersion=7, content='No'), owner)['code'] == 40901)
    check('reopen requires a reason', request(M + 'reopen', dict(ticketId=tid, requestId='empty-reopen-001', expectedVersion=7, reason=' '), owner)['code'] == 40001)
    reopened = ok(M + 'reopen', dict(ticketId=tid, requestId='reopen-ticket-001', expectedVersion=7, reason='Issue remains'), owner)
    check('merchant explicitly reopens resolved ticket', reopened['status'] == 'waiting_support')
    closed = ok(M + 'close', dict(ticketId=tid, requestId='close-ticket-001', expectedVersion=8, reason='No longer needed'), owner)
    check('merchant closes ticket', closed['status'] == 'closed')
    mysql(f'UPDATE `{SYSTEM}`.sys_admin SET status=2 WHERE id=3;')
    reopened = ok(A + 'reopen', dict(ticketId=tid, requestId='reopen-closed-001', expectedVersion=9, reason='Follow-up required'), admin)
    check('closed ticket can reopen and invalid assignee is cleared', reopened['status'] == 'open' and ok(A + f'ticket?ticketId={tid}', auth=admin)['assigned_admin_id'] is None)
    events = ok(M + f'events?ticketId={tid}&pageSize=200', auth=owner)
    check('every committed version retains exactly one activity', events['total'] == 10 and [e['version'] for e in events['list']] == list(range(1, 11)))
    check('history keyset pagination retains all activity', ok(M + f'events?ticketId={tid}&afterId={events["list"][3]["id"]}&pageSize=2', auth=owner)['list'][0]['version'] == 5)
    check('assignees expose actual display names and exclude disabled staff', all('name' in row and row['id'] != 3 for row in ok(A + f'assignees?ticketId={tid}', auth=admin)))
    check('invalid boolean version cannot be coerced to integer', request(M + 'reply', dict(ticketId=tid, requestId='bool-version-001', expectedVersion=True, content='No'), owner)['code'] == 40001)
    with ThreadPoolExecutor(max_workers=2) as pool:
        calls = [pool.submit(request, M + 'create', dict(base, requestId='duplicate-create-concurrent'), owner, port=19525 + i) for i in range(2)]
        outcomes = [call.result() for call in calls]
    check('concurrent identical create returns one ticket and one creation event', all(x['code'] == 0 for x in outcomes) and outcomes[0]['data']['id'] == outcomes[1]['data']['id'] and ok(M + f'events?ticketId={outcomes[0]["data"]["id"]}', auth=owner)['total'] == 1)
    check('filtering does not narrow summary cards', ok(M + 'tickets?keyword=missing-result', auth=owner)['total'] == 0 and sum(ok(M + 'summary?keyword=missing-result&status=closed', auth=owner).values()) == 4)
    check('guide missing credentials returns truthful unconfigured state', ok(M + 'guides/list', auth=owner)['status'] == 'not_configured')
    check('guide permission is checked before configuration response', request(M + 'guides/list', auth=staff)['code'] == 40301)
    mysql(f"""USE `{SYSTEM}`;
INSERT INTO help_category(id,site_id,name,visible) VALUES(1,0,'Common questions',1),(2,1,'Hidden',0),(3,2,'Other site',1);
INSERT INTO help_article(id,site_id,category_id,title,audience,content,status) VALUES
(1,0,1,'Published merchant FAQ','merchant','Real published answer',1),(2,1,1,'Draft secret','merchant','Draft body',2),(3,1,1,'Consumer answer','customer','Consumer body',1),(4,1,2,'Hidden category secret','merchant','Hidden body',1),(5,2,3,'Other site secret','merchant','Private body',1),(6,1,1,'Archived secret','all','Archived body',3);
USE `{BUSINESS}`;
INSERT INTO platform_rule(id,site_id,title,body,category,severity,status,version) VALUES(1,0,'Unpublished draft edit','Draft body','Operations',3,2,3),(2,1,'Excluded rule','Excluded body','Operations',3,1,1),(3,2,'Other site rule','Other body','Operations',3,1,1),(4,1,'Future rule','Future body','Operations',3,1,1);
INSERT INTO platform_rule_revision(rule_id,site_id,version,action,snapshot_json,effective_at,note,actor_id,actor_name) VALUES
(1,0,1,'publish',JSON_OBJECT('title','Published operations policy','body','Real effective policy','site_id',0,'category','Operations','severity',3,'exceptions_json','[]'),'2020-01-01','QA',1,'QA'),
(1,0,2,'publish',JSON_OBJECT('title','Future edit','body','Future body','site_id',0,'exceptions_json','[]'),'2099-01-01','QA',1,'QA'),
(1,0,3,'draft',JSON_OBJECT('title','Draft secret','body','Draft body','site_id',0),NULL,'QA',1,'QA'),
(2,1,1,'publish',JSON_OBJECT('title','Excluded policy','body','Excluded body','site_id',1,'exceptions_json','[1]'),'2020-01-01','QA',1,'QA'),
(3,2,1,'publish',JSON_OBJECT('title','Other site policy','body','Other body','site_id',2,'exceptions_json','[]'),'2020-01-01','QA',1,'QA'),
(4,1,1,'publish',JSON_OBJECT('title','Future policy','body','Future body','site_id',1,'exceptions_json','[]'),'2099-01-01','QA',1,'QA');
INSERT INTO merchant_violation(id,site_id,merchant_id,rule_title,status,details) VALUES(1,1,1,'Inventory mismatch',1,'Internal investigation'),(2,1,2,'Other merchant violation',1,'Internal');
INSERT INTO merchant_warning(id,site_id,merchant_id,reason,status,expires_at) VALUES(1,1,1,'Active warning',1,NULL),(2,1,1,'Expired warning',1,'2020-01-01'),(3,1,1,'Revoked warning',2,NULL),(4,1,1,'Expires today',1,UTC_DATE()),(5,1,2,'Other merchant warning',1,NULL);
""")
    faq = ok(M + 'faq/list', auth=owner)
    check('FAQ publishes only applicable merchant content', faq['total'] == 1 and faq['list'][0]['content'] == 'Real published answer')
    check('FAQ categories count visible published content only', ok(M + 'faq/categories', auth=owner) == [dict(id=1, name='Common questions', article_count=1)])
    check('FAQ hidden draft detail and other-site detail are inaccessible', all(request(M + f'faq/detail?id={i}', auth=owner)['code'] == 40401 for i in [2, 3, 4, 5, 6]))
    check('FAQ search queries persisted content', ok(M + 'faq/list?keyword=answer', auth=owner)['total'] == 1 and ok(M + 'faq/list?keyword=missing', auth=owner)['total'] == 0)
    rules = ok(M + 'compliance/rules?merchantId=1', auth=owner)['list']
    check('rules use effective published snapshot and filter exceptions/sites/future', len(rules) == 1 and rules[0]['body'] == 'Real effective policy' and 'exceptions_json' not in rules[0])
    check('property staff can read applicable policy without general compliance access', len(ok(M + 'compliance/rules?merchantId=1', auth=staff)['list']) == 1 and request(M + 'compliance/summary?merchantId=1', auth=staff)['code'] == 40301)
    counts = ok(M + 'compliance/summary?merchantId=1', auth=owner)
    check('compliance counts are real and scoring remains unconfigured', counts['score'] is None and not counts['score_configured'] and counts['violations'] == 1 and counts['active_warnings'] == 2)
    check('warning withdrawal and date expiry are distinguished', {x['effective_status'] for x in ok(M + 'compliance/warnings?merchantId=1', auth=owner)['list']} == {'active', 'expired', 'revoked'})
    check('compliance cross-merchant query cannot widen access', request(M + 'compliance/violations?merchantId=2', auth=owner)['code'] == 40302)
    check('violation projection excludes internal investigation text', 'details' not in ok(M + 'compliance/violations?merchantId=1', auth=owner)['list'][0])
    check('compliance keyword and status filters query actual cases', ok(M + 'compliance/violations?merchantId=1&keyword=Inventory&status=1', auth=owner)['total'] == 1 and ok(M + 'compliance/violations?merchantId=1&status=2', auth=owner)['total'] == 0)
    appeal = ok(M + 'create', dict(base, requestId='linked-appeal-001', propertyId=None, violationId=1), owner)
    check('appeal ticket links to the real owned violation', ok(M + 'compliance/appeals?merchantId=1', auth=owner)['list'][0]['id'] == appeal['id'])
    check('foreign violation cannot be linked', request(M + 'create', dict(base, requestId='foreign-appeal-001', propertyId=None, violationId=2), owner)['code'] == 40302)
    ok(A + 'status', dict(ticketId=appeal['id'], requestId='appeal-resolved-001', expectedVersion=1, status='resolved', reason='Ticket response complete'), admin)
    check('resolving appeal ticket never changes formal violation outcome', mysql(f'SELECT status FROM `{BUSINESS}`.merchant_violation WHERE id=1;').strip() == '1' and ok(M + 'compliance/summary?merchantId=1', auth=owner)['pending_appeal_tickets'] == 0)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z: z.writestr('readme.txt', 'Not an XLSX')
    check('arbitrary ZIP renamed to XLSX is rejected', upload(owner, dict(ticketId=tid), buf.getvalue(), 'fake.xlsx')['code'] == 40001)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
        z.writestr('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>')
    check('real XLSX package accepted with private metadata', upload(owner, dict(ticketId=tid), buf.getvalue(), 'evidence.xlsx')['code'] == 0)
    check('more than five attachments rejected transactionally', request(M + 'reply', dict(ticketId=tid, requestId='too-many-files-001', expectedVersion=10, attachmentIds=[fid] * 6), owner)['code'] == 40001 and ok(M + f'ticket?ticketId={tid}', auth=owner)['version'] == 10)
    check('anonymous private download is denied', request(M + f'attachments/download?attachmentId={fid}')['code'] == 40101)
    mysql(f'DELETE FROM `{BUSINESS}`.merchant_employee_property WHERE admin_id=2;')
    check('property grant removal immediately hides ticket and notifications', request(M + f'ticket?ticketId={tid}', auth=staff)['code'] == 40401 and ok('merchant/notifications/summary', auth=staff)['total'] == 0)
    check('property grant removal hides bound attachments', request(M + f'attachments/download?attachmentId={fid}', auth=staff)['code'] == 40401)
    mysql(f'INSERT INTO `{BUSINESS}`.merchant_employee_property(site_id,admin_id,property_id) VALUES(1,2,1);')
    mysql(f"USE `{BUSINESS}`; DELETE rm FROM merchant_role_menu rm JOIN merchant_menu m ON m.id=rm.menu_id WHERE rm.role_id=90 AND m.perm_key='mch:support:list';")
    check('stale JWT loses ticket access immediately after role removal', request(M + f'ticket?ticketId={tid}', auth=staff)['code'] == 40301)
    check('revoked employee sees neither notification counts nor rows', ok('merchant/notifications/summary', auth=staff)['total'] == 0)
    check('revoked notification destination is unavailable', request('merchant/notifications/destination?id=' + str(notice['id']), auth=staff)['code'] == 40401)
    # Combined editor saves must commit every selected field in one version.
    mysql(f"UPDATE `{SYSTEM}`.sys_admin SET status=1 WHERE id=3;")
    combined = ok(M + 'create', dict(base, requestId='combined-editor-create'), owner)
    combined_id = combined['id']
    combined_body = dict(ticketId=combined_id, requestId='combined-editor-save', expectedVersion=1,
                         status='waiting_support', assigneeId=3, priority='high', reason='Assign for investigation')
    saved = ok(A + 'status', combined_body, admin)
    detail = ok(A + f'ticket?ticketId={combined_id}', auth=admin)
    check('combined save persists assignee priority and status in one version',
          detail['assigned_admin_id'] == 3 and detail['priority'] == 'high' and detail['status'] == 'waiting_support' and detail['version'] == 2)
    check('combined save retry is idempotent', ok(A + 'status', combined_body, admin) == saved)
    changes = ok(A + f'events?ticketId={combined_id}', auth=admin)['list'][-1]['changes']
    check('combined save audits all three changes together', set(changes) == {'status', 'priority', 'assigned_admin_id'})
    invalid = dict(combined_body, requestId='combined-invalid-agent', expectedVersion=2, status='resolved', assigneeId=2)
    check('invalid cross-site agent rolls back combined status change', request(A + 'status', invalid, admin)['code'] == 40302
          and ok(A + f'ticket?ticketId={combined_id}', auth=admin)['version'] == 2)
    check('invalid priority rolls back combined status change', request(A + 'status', dict(invalid, requestId='combined-invalid-priority', assigneeId=3, priority='invalid'), admin)['code'] == 40001
          and ok(A + f'ticket?ticketId={combined_id}', auth=admin)['status'] == 'waiting_support')
    handler = token(dict(aud='admin', admin_id=3, admin_name='Assigned Support', site_id=1, is_super=False,
                         permissions=['help:ticket:' + value for value in ['list', 'reply', 'status', 'priority', 'assign']]))
    for field, permission in [('assigneeId', 'assign'), ('priority', 'priority')]:
        mysql(f"USE `{SYSTEM}`; DELETE rm FROM sys_role_menu rm JOIN sys_menu m ON m.id=rm.menu_id WHERE rm.role_id=90 AND m.perm_key='help:ticket:{permission}';")
        body = dict(ticketId=combined_id, requestId='combined-denied-' + permission, expectedVersion=2, status='resolved', reason='Denied change')
        body[field] = 0 if field == 'assigneeId' else 'low'
        check('combined save checks additional ' + permission + ' permission', request(A + 'status', body, handler)['code'] == 40301
              and ok(A + f'ticket?ticketId={combined_id}', auth=admin)['version'] == 2)
        mysql(f"INSERT INTO `{SYSTEM}`.sys_role_menu(role_id,menu_id) SELECT 90,id FROM `{SYSTEM}`.sys_menu WHERE perm_key='help:ticket:{permission}';")
    updated = ok(A + 'assign', dict(ticketId=combined_id, requestId='combined-assignment-only', expectedVersion=2, assigneeId=0, priority='low'), admin)
    detail = ok(A + f'ticket?ticketId={combined_id}', auth=admin)
    check('combined assignment and priority preserve existing status', detail['assigned_admin_id'] is None and detail['priority'] == 'low'
          and updated['status'] == 'waiting_support' and detail['version'] == 3)
    print('PASS_COUNT=' + str(len(RESULTS)), flush=True)
    print('QA_SESSION=' + str(session), flush=True)
except Exception:
    for name in meta['containers']:
        print(command(['docker', 'logs', '--tail', '18', name])[-3500:])
    raise
finally:
    if os.environ.get('SUPPORT_QA_KEEP'):
        print('Retained isolated QA fixtures; cleanup session: ' + str(session), flush=True)
    else:
        cleanup(meta)
