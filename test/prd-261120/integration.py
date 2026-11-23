#!/usr/bin/env python3
"""Real HTTP / SQL / wallet regression. Only disposable schemas and test containers."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import io
import json
import re
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RUN = secrets.token_hex(4)
B = 'prd_qa_' + RUN
S = B + '_system'
SECRET = secrets.token_hex(24)
PASSWORD = secrets.token_hex(20)
CONTAINERS = []
PASSED = []
UID_BASE = 10_000_000 + int(RUN,16) % 900_000_000
ALL = ['user:deletion:list','user:deletion:request','user:deletion:prepare','user:deletion:check',
       'user:deletion:config','user:deletion:report','user:deletion:export','user:list:approve-deletion']


def command(args, data=None):
    r = subprocess.run(args, input=data, text=True, capture_output=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:] + r.stdout[-1500:])
    return r.stdout.strip()


def sql(text):
    if re.search(r'\b(?:USE\s+|(?:INSERT\s+INTO|UPDATE|ALTER\s+TABLE|DELETE\s+FROM|DROP\s+TABLE)\s+)`?mtrip_(?:business|system)\b', text, re.IGNORECASE):
        raise RuntimeError('Refusing source database mutation')
    text = re.sub(r'(?<![A-Za-z0-9_])9100(?:0[1-9]|[1-3][0-9]|40)(?![A-Za-z0-9_])', lambda m:str(fixture_uid(int(m[0]))), text)
    return command(['docker','exec','-i','mtrip-mysql-1','sh','-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], text)


def check(name, value):
    if not value:
        raise AssertionError(name)
    PASSED.append(name)
    print('PASS ' + name, flush=True)


def jwt(claims):
    if 'user_id' in claims:
        claims = dict(claims,user_id=fixture_uid(claims['user_id']))
    def enc(v):
        return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
    body = enc({'alg':'HS256','typ':'JWT'}) + '.' + enc(dict(claims,iat=int(time.time()),exp=int(time.time())+3600))
    return body + '.' + base64.urlsafe_b64encode(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')


def http(base, path, claims, body=None):
    req = urllib.request.Request(base+path, None if body is None else json.dumps(body).encode(),
        headers={'Authorization':'Bearer '+jwt(claims),'Content-Type':'application/json','X-Site-Id':str(claims['site_id'])})
    try:
        r = urllib.request.urlopen(req, timeout=25)
    except urllib.error.HTTPError as e:
        r = e
    return json.loads(r.read())


def admin(path, body=None, actor=2001, site=7, super=False, perms=None):
    if body is not None and 'userId' in body:
        body = dict(body,userId=fixture_uid(body['userId']))
    return http(USER_BASE,'/api/v1/admin/user/deletion/'+path,
        dict(aud='admin',admin_id=actor,admin_name='PRD QA '+str(actor),site_id=site,is_super=super,permissions=ALL if perms is None else perms),body)


def app(path, body=None, uid=910001, site=7, base=None):
    return http(base or USER_BASE,'/api/v1/app/'+path,dict(aud='app',user_id=uid,site_id=site),body)


def data(r):
    if r['code'] != 0:
        raise AssertionError(json.dumps(r))
    return r['data']


def start(service, port, directory):
    info = json.loads(command(['docker','inspect','mtrip-'+service+'-service-1']))[0]
    env = dict(v.split('=',1) for v in info['Config']['Env'] if '=' in v)
    env.update(DB_BUSINESS_DATABASE=B,DB_SYSTEM_DATABASE=S,DB_USERNAME=B,DB_PASSWORD=PASSWORD,
        MTRIP_JWT_SECRET=SECRET,MTRIP_AES_KEY=SECRET,SCAN_CACHEABLE='false',WORKER_NUM='2',REDIS_DB='13',
        MTRIP_CLIENT_SIGN='false',MTRIP_PAYLOAD_ENCRYPT='false')
    envfile = directory/(service+'.env')
    envfile.write_text('\n'.join(k+'='+v for k,v in env.items())+'\n',encoding='utf-8')
    name = 'mtrip-prd-'+service+'-'+RUN
    CONTAINERS.append(name)
    args = ['docker','run','-d','--name',name,'--network',next(iter(info['NetworkSettings']['Networks'])),
            '--env-file',str(envfile),'-p','127.0.0.1::'+str(port)]
    for source,dest in [('backend/shared/src','/shared/src'),('backend/services/'+service+'-service/app','/opt/www/app'),
                        ('backend/services/'+service+'-service/config','/opt/www/config')]:
        args += ['-v',str(ROOT/source)+':'+dest+':ro']
    command(args+[info['Config']['Image']])
    base='http://'+command(['docker','port',name,str(port)+'/tcp'])
    for _ in range(60):
        try:
            urllib.request.urlopen(base+'/healthz',timeout=1)
            return name,base
        except Exception:
            time.sleep(.25)
    raise RuntimeError(service+' startup failed')


def credit(uid, amount=100):
    output=command(['docker','exec','-i',USER_CONTAINER,'php','/tmp/prd-runner.php'],json.dumps(dict(uid=fixture_uid(uid),site=7,amount=amount)))
    r=json.loads(output.split('PRD_RESULT=')[-1])
    if not r['ok']:
        raise AssertionError(r)


def request(uid=910001):
    return data(admin('request',dict(userId=uid,reason='Verified support escalation',evidence='QA-CASE')))


def decision(rid, action, actor, balance='100', approve=1, **extra):
    return admin(action,dict(requestId=rid,reason='Reviewed QA evidence',approve=approve,expectedBalance=balance),actor=actor,**extra)


def ready(uid):
    rid=request(uid)['id']
    data(decision(rid,'approve',1001,super=True,site=0))
    data(decision(rid,'prepare',3001))
    data(decision(rid,'check',4001))
    return rid


def apply_migrations():
    for filename in ['V20261117100000__merchant-commercial-settings.sql','V20261120100000__account-deletion-finance-controls.sql','V20261120100100__multi-hotel-checkout-sessions.sql','V20261120120000__property-commercial-commission.sql','V20261120120100__pay-at-hotel-booking-settlements.sql','V20261123090000__scope-long-stay-tiers.sql']:
        content=(ROOT/'database/migrations'/filename).read_text(encoding='utf-8')
        isolated = content.replace('mtrip_business', B).replace('mtrip_system', S)
        targets = re.findall(r'\bUSE\s+`?([A-Za-z0-9_]+)`?\s*;', isolated, re.IGNORECASE)
        if not targets or any(target not in [B,S] for target in targets):
            raise RuntimeError('Migration target is not isolated: '+filename)
        command(['docker','exec','-i','-e','MYSQL_PWD='+PASSWORD,'mtrip-mysql-1','mysql','-u'+B,'--default-character-set=utf8mb4'],isolated)


def fixture_uid(value):
    return UID_BASE + value - 910000 if 910001 <= value <= 910040 else value


source_before=''
try:
    source_before=sql('CHECKSUM TABLE mtrip_business.user_info,mtrip_business.order_main,mtrip_business.user_account_deletion,mtrip_business.user_wallet_forfeit;')
    sql(f"CREATE DATABASE `{B}`; CREATE DATABASE `{S}`; CREATE USER '{B}'@'%' IDENTIFIED BY '{PASSWORD}'; "
        f"GRANT ALL ON `{B}`.* TO '{B}'@'%'; GRANT ALL ON `{S}`.* TO '{B}'@'%';")
    for source,target in [('mtrip_business',B),('mtrip_system',S)]:
        tables=sql(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{source}' AND TABLE_TYPE='BASE TABLE';").splitlines()
        sql(''.join(f'CREATE TABLE `{target}`.`{table}` LIKE `{source}`.`{table}`;' for table in tables))
    apply_migrations(); apply_migrations()
    check('migrations can run twice without duplicating initial policy',sql(f'SELECT COUNT(*) FROM `{B}`.user_account_deletion_config;')=='1')
    sql(f"INSERT INTO `{S}`.sys_site(id,site_name,currency,timezone) VALUES(7,'PRD QA','MMK','Asia/Yangon'),(6,'Foreign QA','MMK','Asia/Yangon');")
    sql(f'INSERT INTO `{B}`.user_info(id,site_id,mobile,mobile_hash,nickname) VALUES '+','.join(
        f"({uid},{6 if uid==910040 else 7},'prd-{uid}','prd-{uid}','PRD QA')" for uid in range(910001,910041))+';')
    with tempfile.TemporaryDirectory(prefix='prd-qa-') as tmp:
        USER_CONTAINER,USER_BASE=start('user',9502,Path(tmp))
        ORDER_CONTAINER,ORDER_BASE=start('order',9504,Path(tmp))
    command(['docker','cp',str(ROOT/'test/prd-261120/runner.php'),USER_CONTAINER+':/tmp/prd-runner.php'])
    for uid in range(910001,910012):
        credit(uid)

    check('list requires its read permission',admin('list',perms=[])['code'] in [40301,40302])
    check('support cannot cross site boundaries',admin('request',dict(userId=910040,reason='Foreign'))['code'] in [40301,40302])
    check('empty reason is refused',admin('request',dict(userId=910001,reason=''))['code']!=0)
    policy=data(admin('config',super=True,actor=1001,site=0))
    check('default approval validity remains seven days',int(policy['current']['validity_days'])==7)
    effective=datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    settings=dict(thresholdAmount='500',validityDays=2,effectiveAt=effective,expectedVersion=policy['version'],reason='QA policy')
    check('only Super Admin can configure deletion policy',admin('config/save',settings)['code'] in [40301,40302])
    data(admin('config/save',settings,super=True,actor=1001,site=0))
    check('stale policy edits cannot overwrite a newer version',admin('config/save',settings,super=True,actor=1001,site=0)['code']!=0)
    rid=request()['id']
    check('duplicate support request reuses the active request',request()['id']==rid)
    check('small positive balances still cannot bypass reviewed approval',app('user/account/delete',dict(confirm='DELETE'))['code']==40933)
    check('non-Super Admin cannot approve even with the permission key',decision(rid,'approve',2001)['code'] in [40301,40302])
    check('Super Admin must review the current balance',decision(rid,'approve',1001,balance='99',super=True,site=0)['code']!=0)
    approved=data(decision(rid,'approve',1001,super=True,site=0))
    check('approval uses the configured future-approval validity',int(approved['validity_days'])==2 and approved['state']=='pending_finance')
    future=dict(thresholdAmount='999',validityDays=9,effectiveAt=(datetime.now(timezone.utc)+timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S'),expectedVersion=2,reason='Scheduled QA policy')
    data(admin('config/save',future,super=True,actor=1001,site=0))
    check('scheduled policy changes do not apply early or rewrite an approval',int(data(admin('config',super=True,actor=1001,site=0))['current']['validity_days'])==2 and int(data(admin('detail?id='+str(rid)))['request']['validity_days'])==2)
    check('Super Admin approval alone cannot authorize forfeiture',app('user/account/delete',dict(confirm='DELETE'))['code']==40933)
    check('Super Admin approver cannot be Finance maker',decision(rid,'prepare',1001,super=True,site=0)['code'] in [40301,40302])
    check('Finance prepare requires its own permission',decision(rid,'prepare',3001,perms=['user:deletion:list'])['code'] in [40301,40302])
    check('Finance preparation does not debit the wallet',data(decision(rid,'prepare',3001))['state']=='pending_checker' and sql(f'SELECT balance FROM `{B}`.user_info WHERE id=910001;')=='100.00')
    check('Finance maker cannot check their own request',decision(rid,'check',3001)['code'] in [40301,40302])
    check('Super Admin approver cannot be the Finance checker',decision(rid,'check',1001,super=True,site=0)['code'] in [40301,40302])
    check('independent Finance checker makes the request ready',data(decision(rid,'check',4001))['state']=='ready')
    check('repeated Finance check is refused without posting',decision(rid,'check',4001)['code']!=0)
    check('approved case still requires exact consumer confirmation',app('user/account/delete',dict(confirm='delete'))['code']!=0)
    yesterday=(datetime.now(timezone.utc)-timedelta(days=2)).date().isoformat()
    sql(f"INSERT INTO `{B}`.order_main(order_no,site_id,user_id,order_type,booking_status,order_status,end_date,goods_name,sku_name,contact_name,contact_phone,quantity) VALUES('PRD-PAST',7,910001,1,2,1,'{yesterday}','QA','QA','QA','000000',1);")
    detail=data(admin('detail?id='+str(rid)))
    check('confirmed past-checkout booking is exempt without a status change',len(detail['blockers'])==0)
    sql(f"UPDATE `{B}`.order_main SET refund_status=1 WHERE order_no='PRD-PAST';")
    check('refund in progress overrides a past-checkout exemption',app('user/account/delete',dict(confirm='DELETE'))['code']==40933)
    sql(f"UPDATE `{B}`.order_main SET refund_status=0 WHERE order_no='PRD-PAST';")
    check('consumer deletion succeeds after all independent approvals',app('user/account/delete',dict(confirm='DELETE'))['code']==0)
    check('forfeiture clears lots and posts one immutable ledger entry',sql(f'SELECT balance,user_status FROM `{B}`.user_info WHERE id=910001; SELECT COUNT(*),SUM(amount) FROM `{B}`.user_wallet_forfeit WHERE user_id=910001;')=='0.00\t3\n1\t100.00')
    check('historical confirmed booking was not auto-completed',sql(f"SELECT booking_status FROM `{B}`.order_main WHERE order_no='PRD-PAST';")=='2')
    check('old consumer token can no longer access the account',app('user/me')['code']!=0)
    check('deleted account cannot post forfeiture twice',app('user/account/delete',dict(confirm='DELETE'))['code']!=0 and sql(f'SELECT COUNT(*) FROM `{B}`.user_wallet_forfeit;')=='1')

    legacy=910002
    sql(f"INSERT INTO `{B}`.user_account_deletion(site_id,user_id,status,approved_balance,approved_by,approval_expires_at) VALUES(7,{legacy},1,100,1001,UTC_TIMESTAMP()+INTERVAL 1 DAY);")
    check('pre-upgrade single-person approval does not bypass Finance',app('user/account/delete',dict(confirm='DELETE'),uid=legacy)['code']==40933)
    legacy_id=int(sql(f'SELECT MAX(id) FROM `{B}`.user_account_deletion WHERE user_id={legacy};'))
    check('legacy approval cannot skip the new Super Admin request review',decision(legacy_id,'prepare',3001)['code']!=0)
    check('legacy approval can be renewed as a new pending request',request(legacy)['id']!=legacy_id)
    expired=ready(910003)
    sql(f"UPDATE `{B}`.user_account_deletion SET approval_expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id={expired};")
    check('expired approval cannot be finalized',app('user/account/delete',dict(confirm='DELETE'),uid=910003)['code']==40933)
    check('expired approval remains visible as expired',data(admin('detail?id='+str(expired)))['request']['state']=='expired')
    check('expired approval can be replaced by a new reviewed request',request(910003)['id']!=expired)
    increased=ready(910004);credit(910004,1)
    check('wallet growth after Finance review blocks consumer forfeiture',app('user/account/delete',dict(confirm='DELETE'),uid=910004)['code']==40933)
    rejected=request(910005)['id']
    check('rejection is recorded without wallet posting',data(decision(rejected,'approve',1001,approve=0,super=True,site=0))['state']=='rejected')
    scoped=request(910006)['id']
    check('request detail is site-scoped',admin('detail?id='+str(scoped),site=6)['code'] in [40301,40302])
    check('request revocation is audited',data(admin('revoke',dict(requestId=scoped,reason='Cancel QA review'),actor=1001,site=0,super=True))['state']=='revoked')
    rollback=ready(910007)
    sql(f"CREATE TRIGGER `{B}`.qa_forfeit_fail BEFORE INSERT ON `{B}`.user_wallet_forfeit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA rollback';")
    check('posting failure rolls back account and wallet together',app('user/account/delete',dict(confirm='DELETE'),uid=910007)['code']!=0 and sql(f'SELECT balance,user_status FROM `{B}`.user_info WHERE id=910007;')=='100.00\t1')
    sql(f'DROP TRIGGER `{B}`.qa_forfeit_fail;')
    check('retry after rollback posts once',app('user/account/delete',dict(confirm='DELETE'),uid=910007)['code']==0)
    report=data(admin('report',perms=['user:deletion:report']))
    check('report totals include only actually posted forfeitures',float(report['summary']['completedAmount'])==200)
    check('report can separately filter expired requests',all(r['state']=='expired' for r in data(admin('report?state=expired'))['list']))
    check('export requires an independent export permission',admin('export',dict(format='csv'),perms=['user:deletion:report'])['code'] in [40301,40302])
    csv=data(admin('export',dict(format='csv',userId=910001),perms=['user:deletion:export']))
    check('CSV export applies the same consumer filter',str(fixture_uid(910001)).encode() in base64.b64decode(csv['base64']) and str(fixture_uid(910007)).encode() not in base64.b64decode(csv['base64']))
    xlsx=data(admin('export',dict(format='xlsx',userId=910001),perms=['user:deletion:export']))
    import openpyxl
    workbook=openpyxl.load_workbook(io.BytesIO(base64.b64decode(xlsx['base64'])),read_only=True)
    check('XLSX is a real readable workbook',workbook.active.max_row in [None,2] and len(list(workbook.active.values))==2)
    check('successful exports leave an audit record',sql(f"SELECT COUNT(*) FROM `{B}`.user_account_deletion_event WHERE action='report_exported';")=='2')
    concurrent_id=ready(910008)
    with ThreadPoolExecutor(max_workers=2) as pool:
        simultaneous=list(pool.map(lambda _:app('user/account/delete',dict(confirm='DELETE'),uid=910008),range(2)))
    check('concurrent consumer confirmations post only once',sum(r['code']==0 for r in simultaneous)==1 and sql(f'SELECT COUNT(*) FROM `{B}`.user_wallet_forfeit WHERE deletion_id={concurrent_id};')=='1')
    check('zero-balance deletion needs no forfeiture approval',app('user/account/delete',dict(confirm='DELETE'),uid=910012)['code']==0 and sql(f'SELECT COUNT(*) FROM `{B}`.user_wallet_forfeit WHERE user_id=910012;')=='0')
    expiry_request=request(910009)['id'];credit(910009,50)
    lot_id=sql(f'SELECT MIN(id) FROM `{B}`.user_wallet_lot WHERE user_id=910009;')
    sql(f"UPDATE `{B}`.user_wallet_lot SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id={lot_id};")
    latest=data(admin('detail?id='+str(expiry_request)))
    check('review detail uses the current available balance after normal lot expiry',float(latest['consumer']['balance'])==50)
    for action,actor in [('approve',1001),('prepare',3001),('check',4001)]:
        data(decision(expiry_request,action,actor,balance='50',super=actor==1001,site=0 if actor==1001 else 7))
    check('normal wallet expiry does not trap Finance in repeated stale-balance errors',app('user/account/delete',dict(confirm='DELETE'),uid=910009)['code']==0)
    check('ordinary lot expiry is excluded from account-forfeiture amount',sql(f'SELECT amount FROM `{B}`.user_wallet_forfeit WHERE deletion_id={expiry_request};')=='50.00')

    # Two ordinary published hotels suffice for the real Trip/stock/checkout APIs.
    sql(f"INSERT INTO `{B}`.merchant_info(id,site_id,merchant_code,merchant_name,status,credit_code,legal_person,contact_name,contact_phone) VALUES(71,7,'PRD71','PRD Merchant',3,'PRD-QA-71','QA','QA','000000'); "
        f"INSERT INTO `{B}`.merchant_store(id,site_id,merchant_id,store_name,business_type,status,kyc_status,content_status,content_approved_version,publish_status,operating_status) VALUES(81,7,71,'PRD Hotel A','hotel',1,1,2,1,1,1),(82,7,71,'PRD Hotel B','hotel',1,1,2,1,1,1); "
        f"INSERT INTO `{B}`.hotel_room_type(id,site_id,property_id,room_name,status,publish_status,approved_version,base_price,base_stock) VALUES(91,7,81,'PRD Room A',1,2,1,100,5),(92,7,82,'PRD Room B',1,2,1,100,5);")
    tomorrow=(datetime.now(timezone.utc)+timedelta(days=2)).date().isoformat()
    later=(datetime.now(timezone.utc)+timedelta(days=3)).date().isoformat()
    items=[dict(propertyId=p,roomTypeId=r,quantity=1,useDate=tomorrow,endDate=later) for p,r in [(81,91),(82,92)]]
    key='qa_checkout_'+secrets.token_hex(12)
    body=dict(checkoutKey=key,items=items)
    first=data(app('order/trip/checkout',body,uid=910010,base=ORDER_BASE))
    second=data(app('order/trip/checkout',body,uid=910010,base=ORDER_BASE))
    check('reopening payment retains its original ten-minute deadline',first['expiresAtMs']==second['expiresAtMs'] and first['revision']==second['revision'] and 590000<first['expiresAtMs']-first['serverNowMs']<=600000)
    create_items=[dict(v,contactName='QA Guest',contactPhone='977700123') for v in items]
    create=dict(checkoutKey=key,checkoutRevision=first['revision'],items=create_items,expectedPayAmount=first['quote']['payAmount'])
    check('multi-hotel create cannot bypass the checkout session',app('order/trip/create',dict(items=create_items),uid=910010,base=ORDER_BASE)['code']==40934)
    sql(f"UPDATE `{B}`.order_checkout_session SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE checkout_key='{key}';")
    check('expired session cannot lock stock or create orders',app('order/trip/create',create,uid=910010,base=ORDER_BASE)['code']==40934 and sql(f'SELECT COUNT(*) FROM `{B}`.order_trip;')=='0')
    reopened=data(app('order/trip/checkout',body,uid=910010,base=ORDER_BASE))
    check('refresh cannot silently renew an expired session',reopened['expired'] and reopened['revision']==first['revision'])
    sql(f'UPDATE `{B}`.hotel_room_type SET status=0 WHERE id=91;')
    expired_unavailable=data(app('order/trip/checkout',body,uid=910010,base=ORDER_BASE))
    check('expired checkout remains recoverable when its room is no longer bookable',expired_unavailable['expired'] and expired_unavailable['quote'] is None)
    unavailable=app('order/trip/checkout',dict(body,review=1),uid=910010,base=ORDER_BASE)
    check('failed stock/room revalidation cannot renew checkout',unavailable['code']!=0 and sql(f"SELECT revision FROM `{B}`.order_checkout_session WHERE checkout_key='{key}';")=='1')
    sql(f'UPDATE `{B}`.hotel_room_type SET status=1,base_price=120,weekend_price=120 WHERE id=91;')
    reviewed=data(app('order/trip/checkout',dict(body,review=1),uid=910010,base=ORDER_BASE))
    check('explicit price and stock review opens a new revision',not reviewed['expired'] and reviewed['revision']==first['revision']+1)
    check('re-review returns the current changed price',reviewed['quote']['payAmount']!=first['quote']['payAmount'])
    check('stale checkout revision cannot submit after re-review',app('order/trip/create',create,uid=910010,base=ORDER_BASE)['code']==40934)
    create['checkoutRevision']=reviewed['revision']
    check('old displayed price is rejected without creating a Trip',app('order/trip/create',create,uid=910010,base=ORDER_BASE)['code']==40921 and sql(f'SELECT COUNT(*) FROM `{B}`.order_trip;')=='0')
    create['expectedPayAmount']=reviewed['quote']['payAmount']
    made=data(app('order/trip/create',create,uid=910010,base=ORDER_BASE))
    again=data(app('order/trip/create',create,uid=910010,base=ORDER_BASE))
    check('duplicate create returns the same Trip without extra orders',made['tripId']==again['tripId'] and sql(f'SELECT COUNT(*) FROM `{B}`.order_trip;')=='1')
    deadline=sql(f"SELECT COUNT(DISTINCT payment_expires_at),MIN(payment_expires_at)=(SELECT expires_at FROM `{B}`.order_checkout_session WHERE checkout_key='{key}') FROM `{B}`.order_main WHERE trip_id={made['tripId']};")
    check('all child orders inherit the payment-page deadline',deadline=='1\t1')
    sql(f'UPDATE `{B}`.hotel_room_type SET status=0 WHERE id=91;')
    recovered=data(app('order/trip/checkout',body,uid=910010,base=ORDER_BASE))
    check('lost create response recovers the existing Trip even after room withdrawal',recovered['tripId']==made['tripId'] and recovered['quote'] is None)
    retried=data(app('order/trip/create',create,uid=910010,base=ORDER_BASE))
    check('retry after room withdrawal returns the original Trip without more stock',retried['tripId']==made['tripId'] and sql(f'SELECT COUNT(*) FROM `{B}`.order_trip;')=='1')
    sql(f'UPDATE `{B}`.hotel_room_type SET status=1 WHERE id=91;')
    check('session ownership prevents a second consumer from submitting',app('order/trip/create',create,uid=910011,base=ORDER_BASE)['code']==40934)
    check('no simulated provider or production payment was required',sql(f'SELECT pay_status FROM `{B}`.order_trip;')=='0')
    single=dict(propertyId=81,roomTypeId=91,quantity=1,useDate=tomorrow,endDate=later,contactName='QA Guest',contactPhone='977700123')
    check('ordinary single-hotel create still succeeds',app('order/create',single,uid=910015,base=ORDER_BASE)['code']==0)
    with ThreadPoolExecutor(max_workers=2) as pool:
        create_future=pool.submit(app,'order/create',single,uid=910014,base=ORDER_BASE)
        delete_future=pool.submit(app,'user/account/delete',dict(confirm='DELETE'),uid=910014)
        raced_create,raced_delete=create_future.result(),delete_future.result()
    invariant=sql(f'SELECT user_status,(SELECT COUNT(*) FROM `{B}`.order_main WHERE user_id=910014) FROM `{B}`.user_info WHERE id=910014;').split('\t')
    check('concurrent account deletion and booking cannot leave an order on a deleted account',raced_create['code']==0 or raced_delete['code']==0)
    check('consumer-row commit guard preserves the booking/deletion invariant',not(invariant[0]=='3' and int(invariant[1])>0))
    print(f'PASSED {len(PASSED)} assertions',flush=True)
finally:
    for name in reversed(CONTAINERS):
        subprocess.run(['docker','rm','-f',name],capture_output=True)
    sql(f"DROP DATABASE IF EXISTS `{B}`; DROP DATABASE IF EXISTS `{S}`; DROP USER IF EXISTS '{B}'@'%';")
    subprocess.run(['docker','exec','mtrip-redis-1','redis-cli','-n','13','DEL']+
        ['mtrip:user:revoked:'+str(fixture_uid(i)) for i in range(910001,910041)],capture_output=True)
    if source_before:
        check('source development business checksums are unchanged',source_before==sql('CHECKSUM TABLE mtrip_business.user_info,mtrip_business.order_main,mtrip_business.user_account_deletion,mtrip_business.user_wallet_forfeit;'))
