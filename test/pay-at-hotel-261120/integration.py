#!/usr/bin/env python3
"""Real HTTP, SQL and wallet flows in disposable schemas; never production data."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import re
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from provider import Provider

ROOT = Path(__file__).resolve().parents[2]
RUN = secrets.token_hex(4)
B, S = 'pah_qa_' + RUN, 'pah_qa_' + RUN + '_system'
SECRET, PASSWORD = secrets.token_hex(24), secrets.token_hex(20)
UID = 900_000_000 + int(RUN, 16) % 10_000_000
CONTAINERS, PASSED = [], []
PROVIDER = Provider(SECRET)
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
CHECKSUM = 'CHECKSUM TABLE mtrip_business.merchant_info,mtrip_business.merchant_commercial_config,mtrip_business.merchant_pay_at_hotel_terms,mtrip_business.order_main,mtrip_business.user_info,mtrip_business.finance_flow,mtrip_business.finance_account_entry,mtrip_business.finance_merchant_settle;'

def command(args, data=None):
    r = subprocess.run(args, input=data, text=True, capture_output=True, encoding='utf-8', timeout=180)
    if r.returncode: raise RuntimeError(r.stderr[-1600:] + r.stdout[-1600:])
    return r.stdout.strip()

def sql(statement):
    if re.search(r'\b(?:USE\s+|(?:INSERT\s+INTO|UPDATE|ALTER\s+TABLE|DELETE\s+FROM|DROP\s+TABLE)\s+)`?mtrip_(?:business|system)\b', statement, re.IGNORECASE):
        raise RuntimeError('Refusing source database mutation')
    return command(['docker','exec','-i','mtrip-mysql-1','sh','-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], statement)

def check(name, value):
    if not value: raise AssertionError(name)
    PASSED.append(name); print('PASS ' + name, flush=True)

def jwt(claims):
    enc = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    body = enc(dict(alg='HS256',typ='JWT'))+'.'+enc(dict(claims,iat=int(time.time()),exp=int(time.time())+3600))
    return body+'.'+base64.urlsafe_b64encode(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')

def http(base, path, claims, body=None, headers=None):
    request = urllib.request.Request(base+path, None if body is None else json.dumps(body).encode(),
        headers={**(headers or {}),'Authorization':'Bearer '+jwt(claims),'Content-Type':'application/json','X-Site-Id':str(claims.get('site_id',7))})
    try: response = OPENER.open(request, timeout=30)
    except urllib.error.HTTPError as error: response = error
    return json.loads(response.read())

def admin(path, body=None, base=None, site=0, perms=None, super=True, actor=1001):
    return http(base or MERCHANT, '/api/v1/admin/'+path,
        dict(aud='admin',admin_id=actor,admin_name='Isolated PAH QA',site_id=site,is_super=super,
             permissions=['merchant:list:list','merchant:list:edit','finance:msettle:confirm','finance:msettle:pay','order:refund:audit'] if perms is None else perms),body)

def merchant(path, body=None, base=None, owner=True, property_id=None):
    return http(base or MERCHANT, '/api/v1/merchant/'+path,
        dict(aud='merchant',admin_id=701 if owner else 702,admin_name='PAH merchant',site_id=7,account_type=2,
             merchant_id=71,group_id=0,store_id=0,is_owner=owner,auth_version=1,amr='totp',permissions=[
                 'mch:properties:profile-submit','mch:order:list','mch:order:detail','mch:order:check-in','mch:order:check-out','mch:order:cancel',
                 'mch:order:no-show','mch:order:no-show-waive','mch:order:refund','mch:earnings:overview'] if owner else []),body,{'X-Mtrip-Property-Id':str(property_id)} if property_id else None)

def app(path, body=None, uid=UID):
    return http(ORDER,'/api/v1/app/order/'+path,dict(aud='app',user_id=uid,site_id=7),body)

def data(response):
    if response['code'] != 0: raise AssertionError(json.dumps(response))
    return response['data']

def start(service, port, directory):
    info = json.loads(command(['docker','inspect','mtrip-'+service+'-service-1']))[0]
    env = dict(v.split('=',1) for v in info['Config']['Env'] if '=' in v)
    env.update(DB_BUSINESS_DATABASE=B,DB_SYSTEM_DATABASE=S,DB_USERNAME=B,DB_PASSWORD=PASSWORD,
        MTRIP_JWT_SECRET=SECRET,MTRIP_AES_KEY=SECRET,SCAN_CACHEABLE='false',WORKER_NUM='2',REDIS_DB='13',
        MTRIP_CLIENT_SIGN='false',MTRIP_PAYLOAD_ENCRYPT='false',KBZ_REFUND_MERGE_SECONDS='0')
    env.update(PAYMENT_CENTER_URL=PROVIDER.url,MTRIP_INTERNAL_TOKEN=SECRET)
    envfile=directory/(service+'.env'); envfile.write_text('\n'.join(k+'='+v for k,v in env.items())+'\n',encoding='utf-8')
    name='mtrip-pah-'+service+'-'+RUN; CONTAINERS.append(name)
    args=['docker','run','-d','--name',name,'--network',next(iter(info['NetworkSettings']['Networks'])),
          '--env-file',str(envfile),'-p','127.0.0.1::'+str(port)]
    for source,target in [('backend/shared/src','/shared/src'),('backend/services/'+service+'-service/app','/opt/www/app'),
                          ('backend/services/'+service+'-service/config','/opt/www/config')]:
        args += ['-v',str(ROOT/source)+':'+target+':ro']
    command(args+[info['Config']['Image']])
    base='http://'+command(['docker','port',name,str(port)+'/tcp'])
    for _ in range(80):
        try: OPENER.open(base+'/healthz',timeout=1); return name,base
        except Exception: time.sleep(.25)
    raise RuntimeError(service+' did not start')

def job(action, **values):
    output=command(['docker','exec','-i',ORDER_CONTAINER,'php','/tmp/pah-runner.php'],json.dumps(dict(action=action,**values)))
    return json.loads(output.split('PAH_RESULT=')[-1])

def policy(**overrides):
    current=data(admin('merchant/commercial-settings?id=71'))
    body=dict(id=71,expectedVersion=current['latest_version'],requestId='pah-'+secrets.token_hex(10),
        commissionPlan='standard',commissionRate='10',transactionFeeRate='2',payAtHotelEnabled=True,
        noShowFeeEnabled=True,merchantUpfrontRate='20',effectiveAt=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),reason='Isolated QA policy')
    body.update(overrides)
    return data(admin('merchant/commercial-settings',body))

def choice(no_show, rate, terms=None):
    terms=terms or data(merchant('pay-at-hotel/terms'))
    return merchant('pay-at-hotel/terms',dict(noShowEnabled=no_show,depositRate=rate,policyVersion=terms['policy_version'],
        policySource=terms['policy_source'],selectionVersion=terms['selection_version']))

def book(property_id=81, room_id=91, uid=UID, **extra):
    body=dict(propertyId=property_id,roomTypeId=room_id,quantity=1,useDate=ARRIVE,endDate=DEPART,
        contactName='PAH QA',contactPhone='977700123',payAtHotel=1)
    body.update(extra); return data(app('create',body,uid=uid))

def pay(order):
    return data(app('pay',dict(orderId=order['orderId'],payMethod=3)))

def reviewed_refund(order, amount, approved=None, complete=True, legacy_original=False, uid=UID):
    request=data(merchant('order/refund/apply',dict(id=order['orderId'],amount=amount,reason='PAH regression refund'),base=ORDER))
    rid=int(sql(f"SELECT id FROM `{B}`.order_refund WHERE refund_no='{request['refundNo']}';"))
    if legacy_original:
        # Exercise already-issued original-channel refunds carried over from the previous release.
        sql(f"UPDATE `{B}`.order_refund SET refund_channel=2 WHERE id={rid};")
    data(admin('order/refund/audit',dict(id=rid,auditStatus=1,refundAmount=amount if approved is None else approved),base=ORDER))
    if not legacy_original and sql(f'SELECT refund_channel FROM `{B}`.order_refund WHERE id={rid};')=='0':
        data(app('refund/apply',dict(orderId=order['orderId'],reason='Select wallet',refundChannel=1),uid=uid))
    if complete and sql(f'SELECT status FROM `{B}`.order_refund WHERE id={rid};')=='2':
        data(admin('order/refund/confirm',dict(id=rid),base=ORDER))
    return rid

def notify(body):
    req=urllib.request.Request(ORDER+'/internal/v1/order/payment-notify',json.dumps(body).encode(),
        headers={'Content-Type':'application/json','X-Internal-Token':SECRET})
    return data(json.loads(OPENER.open(req,timeout=30).read()))

def channel_pay(order):
    qr=data(app('pay',dict(orderId=order['orderId'],payMethod=5)))
    payment=PROVIDER.payments[qr['payNo']]; payment['status']='paid'
    notify(dict(payment,event='paid'))
    return payment

def channel_refunded(refund_id):
    no=sql(f'SELECT refund_trade_no FROM `{B}`.order_refund WHERE id={refund_id};')
    PROVIDER.refunds[no]['status']='succeeded'
    notify(dict(event='refunded',refundNo=no,channelTradeNo='ISOLATED-REFUND-'+no))
    return no

def make_trip():
    items=[dict(propertyId=p,roomTypeId=r,quantity=1,useDate=ARRIVE,endDate=DEPART) for p,r in [(81,91),(82,92)]]
    session=data(app('trip/checkout',dict(checkoutKey='trip_'+secrets.token_hex(16),items=items,payAtHotel=1)))
    return data(app('trip/create',dict(items=[dict(v,contactName='PAH Guest',contactPhone='977700123') for v in items],
        checkoutKey=session['checkoutKey'],checkoutRevision=session['revision'],payAtHotel=1,expectedPayAmount=session['quote']['payAmount'])))

def row(order):
    result = json.loads(sql(f"SELECT JSON_OBJECT('paid',pay_amount,'hotel',hotel_balance,'commission',hotel_commission,'deposit',hotel_deposit,'fee',hotel_transaction_fee,'status',booking_status,'payment',payment_status,'operational',hotel_settlement_status,'reconciliation',hotel_reconciliation_status,'terms',hotel_terms_snapshot,'commercial',merchant_commercial_snapshot) FROM `{B}`.order_main WHERE id={order['orderId']};"))
    for key in ['paid','hotel','commission','deposit','fee']: result[key]=format(result[key],'.2f')
    return result

before=''
try:
    before=sql(CHECKSUM)
    sql(f"CREATE DATABASE `{B}`; CREATE DATABASE `{S}`; CREATE USER '{B}'@'%' IDENTIFIED BY '{PASSWORD}'; GRANT ALL ON `{B}`.* TO '{B}'@'%'; GRANT ALL ON `{S}`.* TO '{B}'@'%';")
    for source,target in [('mtrip_business',B),('mtrip_system',S)]:
        tables=sql(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{source}' AND TABLE_TYPE='BASE TABLE';").splitlines()
        sql(''.join(f'CREATE TABLE `{target}`.`{table}` LIKE `{source}`.`{table}`;' for table in tables))
    migrations=['V20261117100000__merchant-commercial-settings.sql','V20261120100100__multi-hotel-checkout-sessions.sql','V20261120120000__property-commercial-commission.sql','V20261120120100__pay-at-hotel-booking-settlements.sql','V20261123090000__scope-long-stay-tiers.sql','V20261124070000__consumer-affiliate-access.sql','V20261125080000__consumer-affiliate-link-opens.sql','V20261126090000__booking-refund-destination.sql','V20261126090100__hotel-long-stay-ranges.sql']
    for _ in range(2):
        for filename in migrations:
            isolated=(ROOT/'database/migrations'/filename).read_text(encoding='utf-8').replace('mtrip_business',B).replace('mtrip_system',S)
            targets=re.findall(r'\bUSE\s+`?([A-Za-z0-9_]+)`?\s*;',isolated,re.IGNORECASE)
            if not targets or any(target not in [B,S] for target in targets): raise RuntimeError('Unsafe migration target')
            command(['docker','exec','-i','-e','MYSQL_PWD='+PASSWORD,'mtrip-mysql-1','mysql','-u'+B,'--default-character-set=utf8mb4'],isolated)
    forbidden=subprocess.run(['docker','exec','-i','-e','MYSQL_PWD='+PASSWORD,'mtrip-mysql-1','mysql','-u'+B],
        input='USE mtrip_business;',capture_output=True,text=True,encoding='utf-8')
    check('migration account is denied access to the source business database',forbidden.returncode!=0)
    check('all new migration structures are idempotent',True)
    sql(f"INSERT INTO `{S}`.sys_site(id,site_name,currency,timezone) VALUES(7,'PAH QA','MMK','Asia/Yangon'),(6,'Foreign QA','MMK','Asia/Yangon'); "
        f"INSERT INTO `{B}`.user_info(id,site_id,mobile,mobile_hash,nickname) VALUES({UID},7,'pah-{RUN}','pah-{RUN}','PAH QA'); "
        f"INSERT INTO `{B}`.merchant_info(id,site_id,merchant_code,merchant_name,status,credit_code,legal_person,contact_name,contact_phone,commission_rate) VALUES(71,7,'PAH71','PAH QA',3,'PAH71','QA','QA','000000',3); "
        f"INSERT INTO `{B}`.merchant_admin(id,site_id,merchant_id,account_type,is_owner,username,password) VALUES(701,7,71,2,1,'pah-owner','unused'),(702,7,71,2,0,'pah-employee','unused'); "
        f"INSERT INTO `{B}`.merchant_store(id,site_id,merchant_id,store_name,business_type,status,kyc_status,content_status,content_approved_version,publish_status,operating_status) VALUES(81,7,71,'PAH Hotel A','hotel',1,1,2,1,1,1),(82,7,71,'PAH Hotel B','hotel',1,1,2,1,1,1); "
        f"INSERT INTO `{B}`.hotel_room_type(id,site_id,property_id,room_name,status,publish_status,approved_version,base_price,base_stock,currency) VALUES(91,7,81,'PAH Room A',1,2,1,100000,100,'MMK'),(92,7,82,'PAH Room B',1,2,1,100000,100,'MMK');")
    ARRIVE=(datetime.now(timezone.utc)+timedelta(days=2)).date().isoformat()
    DEPART=(datetime.now(timezone.utc)+timedelta(days=3)).date().isoformat()
    with tempfile.TemporaryDirectory(prefix='pah-qa-') as tmp:
        _,MERCHANT=start('merchant',9505,Path(tmp))
        ORDER_CONTAINER,ORDER=start('order',9504,Path(tmp))
        _,FINANCE=start('finance',9506,Path(tmp))
    command(['docker','cp',str(ROOT/'test/pay-at-hotel-261120/runner.php'),ORDER_CONTAINER+':/tmp/pah-runner.php'])
    job('credit',uid=UID,amount=5000000)
    check('unconfigured merchants remain disabled',data(merchant('pay-at-hotel/terms'))['enabled']==0)
    sql(f"INSERT INTO `{B}`.merchant_pay_at_hotel_terms(merchant_id,site_id,version,enabled,no_show_enabled,deposit_cap_rate,deposit_rate,commission_rate,transaction_fee_rate,effective_at,reason,actor_type,actor_id) VALUES(71,7,1,1,1,30,20,5,2,UTC_TIMESTAMP(),'Legacy contract','admin',1001); UPDATE `{B}`.merchant_store SET hotel_policies='{{\"booking\":{{\"payAtHotel\":true}}}}' WHERE id=82;")
    legacy=data(merchant('pay-at-hotel/terms')); legacy_booking=book(82,92)
    check('merchants without canonical policy retain their existing legacy terms',legacy['policy_source']=='legacy' and row(legacy_booking)['paid']=='25100.00')
    sql(f'UPDATE `{B}`.merchant_store SET hotel_policies=NULL WHERE id=82;')
    configured=policy()
    terms=data(merchant('pay-at-hotel/terms'))
    public_quote=data(app('trip/quote',dict(items=[dict(propertyId=81,roomTypeId=91,quantity=1,useDate=ARRIVE,endDate=DEPART)],payAtHotel=1)))
    check('consumer quotes exclude internal policy reasons and operator identities','commercialTerms' not in public_quote['items'][0]['hotelOption'])
    check('an explicit canonical policy supersedes the legacy policy consistently',terms['policy_source']=='commercial' and terms['commission_rate']==10)
    check('admin effective policy is immediately visible to merchant',terms['enabled']==1 and terms['commission_rate']==10 and terms['transaction_fee_rate']==2 and terms['deposit_cap_rate']==20)
    check('out-of-range merchant prepayment is refused',choice(True,21)['code']==40001)
    check('employee cannot change merchant preferences',merchant('pay-at-hotel/terms',dict(noShowEnabled=False,depositRate=0),owner=False)['code'] in [40301,40302])
    first=book(); original=row(first)
    check('consumer booking responses exclude internal commercial terms','commercialTerms' not in first['priceDetail']['hotelOption'])
    check('canonical admin policy enables booking without a second hidden property switch',original['paid']=='30200.00')
    check('PRD room-price example has one extra fee and the correct hotel balance',original['hotel']=='70000.00' and original['commission']=='10000.00' and original['deposit']=='20000.00' and original['fee']=='200.00')
    policy(commissionRate='12')
    pay(first); frozen=row(first)
    check('payment retains the accepted pricing and commercial version after policy changes',frozen['paid']=='30200.00' and frozen['terms']['commercialTerms']['version']==frozen['commercial']['version']==1)
    check('wallet payment posts real income and matching component entries',sql(f"SELECT SUM(amount) FROM `{B}`.finance_flow WHERE order_id={first['orderId']} AND flow_type=1;")=='30200.00')
    data(merchant('order/check-in',dict(id=first['orderId'],roomNo='101'),base=ORDER))
    check('actual check-in completes operations without pretending hotel cash was verified',row(first)['operational']==1)
    data(merchant('order/check-in',dict(id=first['orderId']),base=ORDER))
    check('repeated check-in does not duplicate operational completion',sql(f"SELECT COUNT(*) FROM `{B}`.order_booking_event WHERE order_id={first['orderId']} AND event_type='hotel_settlement_completed';")=='1')
    data(merchant('order/check-out',dict(id=first['orderId']),base=ORDER)); job('reconcile')
    settlement=int(sql(f"SELECT id FROM `{B}`.finance_merchant_settle WHERE order_id={first['orderId']};"))
    check('checkout creates a booking settlement for prepaid merchant funds only',sql(f'SELECT settle_amount FROM `{B}`.finance_merchant_settle WHERE id={settlement};')=='20000.00' and row(first)['reconciliation']==1)
    job('reconcile')
    check('reconciliation retries cannot create duplicate settlements',sql(f"SELECT COUNT(*) FROM `{B}`.finance_merchant_settle WHERE order_id={first['orderId']};")=='1')
    statement=data(merchant('earnings/settle/detail?id='+str(settlement),base=FINANCE))
    check('merchant settlement detail references exactly the settled booking',len(statement['entries'])==1 and int(statement['entries'][0]['order_id'])==first['orderId'])
    data(admin('finance/settle/confirm',dict(id=settlement),base=FINANCE))
    data(admin('finance/settle/mark-paid',dict(id=settlement,payVoucher='Isolated QA proof; no bank transfer'),base=FINANCE))
    data(admin('finance/settle/mark-paid',dict(id=settlement,payVoucher='Retry'),base=FINANCE))
    check('payout record retries post exactly one merchant expense',sql(f"SELECT COUNT(*),SUM(amount) FROM `{B}`.finance_flow WHERE order_id={first['orderId']} AND flow_type=2 AND biz_type=3;")=='1\t20000.00')

    # Property overrides, merchant-bounded preferences and scheduled admin policy.
    property_view=data(admin('merchant/commercial-settings/property?merchantId=71&propertyId=82'))
    override=dict(merchantId=71,propertyId=82,commissionRate='15',expectedVersion=property_view['latest_version'],
        requestId='property-'+secrets.token_hex(6),effectiveAt=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),reason='Property contract')
    data(admin('merchant/commercial-settings/property',override))
    data(admin('merchant/commercial-settings/property',override))
    check('property commission save safely retries without another version',sql(f'SELECT COUNT(*) FROM `{B}`.merchant_property_commercial_config;')=='1')
    check('ordinary administrators cannot cross property site boundaries',admin('merchant/commercial-settings/property?merchantId=71&propertyId=82',site=6,super=False)['code'] in [40301,40302])
    merchant_view=data(merchant('pay-at-hotel/terms'))
    check('merchant sees the property override and inherited default',[(p['id'],p['commission_rate']) for p in merchant_view['properties']]==[(81,12),(82,15)])
    data(choice(False,0)); without_deposit=book(82,92)
    check('merchant FOC choice removes only its deposit',row(without_deposit)['paid']=='15300.00' and row(without_deposit)['hotel']=='85000.00')
    data(choice(True,10)); with_deposit=book(82,92)
    check('booking combines property commission with a bounded merchant choice',row(with_deposit)['paid']=='25300.00' and row(with_deposit)['hotel']=='75000.00')
    check('stale merchant preferences cannot overwrite a newer choice',choice(True,7,merchant_view)['code']!=0)
    scheduled=policy(commissionRate='20',effectiveAt=(datetime.now(timezone.utc)+timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))
    check('scheduled admin policy is visible without applying early',scheduled['next']['commission_rate']=='20.00' and data(merchant('pay-at-hotel/terms'))['commission_rate']==12)
    restore=dict(override,commissionRate=None,expectedVersion=1,requestId='inherit-'+secrets.token_hex(6),reason='Restore merchant default')
    data(admin('merchant/commercial-settings/property',restore))
    check('explicitly clearing an override restores inheritance',next(p for p in data(merchant('pay-at-hotel/terms'))['properties'] if p['id']==82)['commission_rate']==12)
    policy(); data(choice(True,20))

    guest=book(); pay(guest)
    quote=data(app('refund/quote?orderId='+str(guest['orderId'])))
    check('guest cancelling a 30,200 booking can refund 30,000 including zero fee',quote['refundAmount']==30000
        and quote['refund_transaction_fee']==0 and 3 in quote['availableRefundChannels'])
    guest_refund=data(app('refund/apply',dict(orderId=guest['orderId'],reason='QA guest cancellation',refundChannel=1)))
    guest_rid=int(sql(f"SELECT id FROM `{B}`.order_refund WHERE refund_no='{guest_refund['refundNo']}';"))
    for stage in range(2): data(admin('order/refund/audit',dict(id=guest_rid,auditStatus=1),base=ORDER))
    data(admin('order/refund/confirm',dict(id=guest_rid),base=ORDER))
    check('full eligible refund closes the booking with its non-refundable fee retained',row(guest)['payment']==4 and row(guest)['status']==5)
    # Merchant escalation does not move money; smaller platform approvals must change every component.
    refundable=book(); pay(refundable)
    wallet_before=sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};')
    pending=data(merchant('order/refund/apply',dict(id=refundable['orderId'],amount=10000,reason='Support escalation'),base=ORDER))
    check('merchant refund escalation waits for platform review without wallet movement',pending['refundStatus']=='pending_review' and wallet_before==sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))
    rid=int(sql(f"SELECT id FROM `{B}`.order_refund WHERE refund_no='{pending['refundNo']}';"))
    data(admin('order/refund/audit',dict(id=rid,auditStatus=1,refundAmount=8000),base=ORDER))
    data(app('refund/apply',dict(orderId=refundable['orderId'],reason='Select wallet',refundChannel=1)))
    data(admin('order/refund/confirm',dict(id=rid),base=ORDER))
    check('approved partial refund components sum to the actual lower amount',sql(f'SELECT refund_amount,refund_hotel_commission+refund_hotel_deposit+refund_transaction_fee+refund_addon FROM `{B}`.order_refund WHERE id={rid};')=='8000.00\t8000.00')
    check('partial refund leaves the booking active',row(refundable)['status']==2 and row(refundable)['payment']==3)
    reviewed_refund(refundable,22000)
    check('sequential refunds stop at the prepaid amount and close the booking',row(refundable)['payment']==3 and sql(f"SELECT SUM(refund_amount) FROM `{B}`.order_refund WHERE order_id={refundable['orderId']} AND status=3;")=='30000.00')
    check('partial merchant escalation keeps inventory occupied',sql(f"SELECT COUNT(*) FROM `{B}`.goods_stock_log WHERE order_id={refundable['orderId']} AND change_type=4;")=='0')
    check('duplicate completion cannot credit the wallet twice',admin('order/refund/confirm',dict(id=rid),base=ORDER)['code']!=0)
    history = data(admin(f'order/refund/detail?id={rid}', base=ORDER))
    check('refund details include the wallet completion and refund reference',
          any(event['event_type'] == 'refund_completed' and event['reference'] == history['refund']['refund_no']
              for event in history['history']))
    check('cross-site admins cannot read the refund history',
          admin(f'order/refund/detail?id={rid}', base=ORDER, site=6, super=False)['code'] != 0)

    platform_cancel=book(); pay(platform_cancel)
    data(admin('order/cancel',dict(id=platform_cancel['orderId'],reason='Platform cancellation'),base=ORDER))
    platform_quote=data(app('refund/quote?orderId='+str(platform_cancel['orderId'])))
    data(app('refund/apply',dict(orderId=platform_cancel['orderId'],refundChannel=1,reason='Select wallet')))
    platform_rid=int(sql(f"SELECT id FROM `{B}`.order_refund WHERE order_id={platform_cancel['orderId']};"))
    data(admin('order/refund/confirm',dict(id=platform_rid),base=ORDER))
    check('platform cancellation before check-in refunds 30,200 including the fee to the selected wallet',
        platform_quote['refundAmount']==30200 and platform_quote['refund_transaction_fee']==200 and row(platform_cancel)['payment']==4)

    # Hotel cancellation overrides a non-refundable policy and the guest selects a destination.
    sql(f"INSERT INTO `{B}`.goods_refund_rule(property_id,sku_type,sku_id,rule_type,remark) VALUES(81,1,91,3,'No refund');")
    cancelled=book(); pay(cancelled)
    check('non-refundable policy is frozen into the booking',data(app('refund/quote?orderId='+str(cancelled['orderId'])))['refundable']==0)
    data(merchant('order/cancel',dict(id=cancelled['orderId'],reason='Hotel unavailable'),base=ORDER))
    data(merchant('order/cancel',dict(id=cancelled['orderId'],reason='Retry'),base=ORDER))
    guest_quote=data(app('refund/quote?orderId='+str(cancelled['orderId'])))
    check('hotel cancellation waits for guest selection and includes the fee',guest_quote['awaitingDestination'] and guest_quote['refundAmount']==30200)
    data(app('refund/apply',dict(orderId=cancelled['orderId'],reason='Choose external',refundChannel=3,provider='QA Bank',holder='QA Guest',accountNumber='12345678')))
    external_id=int(sql(f"SELECT id FROM `{B}`.order_refund WHERE order_id={cancelled['orderId']} AND refund_channel=3;"))
    data(admin('order/refund/confirm',dict(id=external_id,claim=1),base=ORDER))
    check('a second operator cannot claim an assigned external refund',admin('order/refund/confirm',dict(id=external_id,claim=1),base=ORDER,actor=1002)['code']!=0)
    receipt='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l6MAAAAASUVORK5CYII='
    check('external refund requires transfer proof',admin('order/refund/confirm',dict(id=external_id,refundTradeNo='QA-REF'),base=ORDER)['code']!=0)
    data(admin('order/refund/confirm',dict(id=external_id,refundTradeNo='QA-REF',proofImage=receipt),base=ORDER))
    check('finance can review the original transfer receipt',data(admin(f'order/refund/detail?id={external_id}',base=ORDER))['refund']['proofImage']==receipt)
    check('hotel cancellation refunds all prepaid components once regardless of cutoff',row(cancelled)['payment']==4 and sql(f"SELECT COUNT(*),SUM(refund_amount) FROM `{B}`.order_refund WHERE order_id={cancelled['orderId']} AND status=3;")=='1\t30200.00')
    check('hotel cancellation plus refund does not restore stock twice',sql(f"SELECT COUNT(*) FROM `{B}`.goods_stock_log WHERE order_id={cancelled['orderId']} AND change_type=4;")=='1')
    sql(f'DELETE FROM `{B}`.goods_refund_rule WHERE property_id=81;')

    # Cutoff is interpreted in the booking's timezone, with commission and fee protected afterwards.
    arrival_local=datetime.fromisoformat(ARRIVE+'T14:00:00').replace(tzinfo=timezone(timedelta(hours=6,minutes=30)))
    threshold=(arrival_local-datetime.now(timezone.utc)).total_seconds()/3600+1
    rules=json.dumps([dict(hours_before=threshold,refund_rate=100),dict(hours_before=0,refund_rate=50)])
    sql(f"INSERT INTO `{B}`.goods_refund_rule(property_id,sku_type,sku_id,rule_type,rules,remark) VALUES(81,1,91,2,'{rules}','Site timezone cutoff');")
    cutoff=book(); pay(cutoff)
    cutoff_quote=data(app('refund/quote?orderId='+str(cutoff['orderId'])))
    check('after-cutoff quote uses site time and protects commission plus its fee',cutoff_quote['refund_hotel_commission']==0 and cutoff_quote['refund_transaction_fee']==0 and cutoff_quote['refundable']==0)
    sql(f'DELETE FROM `{B}`.goods_refund_rule WHERE property_id=81;')

    # No-show retains the frozen merchant percentage; authorized waiver refunds only that portion.
    past=(datetime.now(timezone.utc)-timedelta(days=2)).date().isoformat()
    past_end=(datetime.now(timezone.utc)-timedelta(days=1)).date().isoformat()
    noshow=book(); pay(noshow)
    sql(f"UPDATE `{B}`.order_main SET use_date='{past}',end_date='{past_end}' WHERE id={noshow['orderId']};")
    data(merchant('order/no-show',dict(id=noshow['orderId']),base=ORDER))
    check('No-show retains the booking merchant prepayment without commission sharing',sql(f"SELECT no_show_fee FROM `{B}`.order_main WHERE id={noshow['orderId']};")=='20000.00')
    waived=book(); pay(waived)
    sql(f"UPDATE `{B}`.order_main SET use_date='{past}',end_date='{past_end}' WHERE id={waived['orderId']};")
    check('waiving a No-show fee requires an audit reason',merchant('order/no-show',dict(id=waived['orderId'],waiveFee=1),base=ORDER)['code']==40001)
    data(merchant('order/no-show',dict(id=waived['orderId'],waiveFee=1,waiveReason='Authorized goodwill'),base=ORDER))
    data(merchant('order/no-show',dict(id=waived['orderId'],waiveFee=1,waiveReason='Retry'),base=ORDER))
    check('No-show waiver refunds only merchant funds exactly once',sql(f"SELECT COUNT(*),SUM(refund_amount),SUM(refund_hotel_commission),SUM(refund_transaction_fee) FROM `{B}`.order_refund WHERE order_id={waived['orderId']} AND status=3;")=='1\t20000.00\t0.00\t0.00')
    job('reconcile')
    check('No-show and waiver settlements use final merchant balances',sql(f"SELECT settle_amount FROM `{B}`.finance_merchant_settle WHERE order_id IN ({noshow['orderId']},{waived['orderId']}) ORDER BY order_id;")=='20000.00\n0.00')

    # Zero prepayment and disabled policy preserve ordinary checkout behavior.
    policy(commissionRate='0',noShowFeeEnabled=False,merchantUpfrontRate=0)
    zero=book(); pay(zero)
    check('zero online prepayment confirms without a zero-value provider charge',row(zero)['paid']=='0.00' and row(zero)['hotel']=='100000.00' and row(zero)['payment']==2)
    policy(payAtHotelEnabled=False,noShowFeeEnabled=False,merchantUpfrontRate=0)
    check('disabled merchant policy removes Pay at Hotel from quote',data(app('trip/quote',dict(items=[dict(propertyId=81,roomTypeId=91,quantity=1,useDate=ARRIVE,endDate=DEPART)])))['payAtHotelAvailable']==False)
    ordinary=book(payAtHotel=0); pay(ordinary)
    check('ordinary fully prepaid booking still works when Pay at Hotel is disabled',row(ordinary)['paid']=='100000.00' and row(ordinary)['payment']==2)

    # Actual order services use the local provider contract for QR creation and internal channel callbacks.
    policy(); data(choice(True,20))
    ordinary_channel=book(payAtHotel=0); channel_pay(ordinary_channel)
    check('ordinary KBZ booking offers wallet as its only refund destination',
        data(app('refund/quote?orderId='+str(ordinary_channel['orderId'])))['availableRefundChannels']==[1])
    channel_order=book(); channel_payment=channel_pay(channel_order)
    notify(dict(channel_payment,event='paid'))
    check('channel payment callback and duplicate callback post the booking once',row(channel_order)['payment']==2 and sql(f"SELECT COUNT(*) FROM `{B}`.finance_account_entry WHERE order_id={channel_order['orderId']};")=='1')
    wallet_before=sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};')
    channel_rid=reviewed_refund(channel_order,10000,legacy_original=True)
    check('original refund waits for provider completion without crediting the wallet',sql(f'SELECT status FROM `{B}`.order_refund WHERE id={channel_rid};')=='2' and wallet_before==sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))
    check('finance cannot take over a pending automatic transfer',admin('order/refund/confirm',dict(id=channel_rid,takeover=1),base=ORDER)['code']!=0)
    submitted=len([c for c in PROVIDER.calls if c[0].endswith('/refund/create')])
    data(admin('order/refund/confirm',dict(id=channel_rid),base=ORDER))
    check('retry while channel refund is processing does not resubmit',len([c for c in PROVIDER.calls if c[0].endswith('/refund/create')])==submitted)
    failed_no=sql(f'SELECT refund_trade_no FROM `{B}`.order_refund WHERE id={channel_rid};')
    PROVIDER.refunds[failed_no]['status']='failed'
    notify(dict(event='refund_failed',refundNo=failed_no,refundFailReason='Isolated transient channel failure'))
    check('failed channel refund stays pending for a safe retry',sql(f'SELECT status FROM `{B}`.order_refund WHERE id={channel_rid};')=='2')
    data(admin('order/refund/confirm',dict(id=channel_rid),base=ORDER))
    replacement=sql(f'SELECT refund_trade_no FROM `{B}`.order_refund WHERE id={channel_rid};')
    check('failed channel refund retries with a new provider reference',replacement!=failed_no)
    notify(dict(event='refunded',refundNo=failed_no,channelTradeNo='LATE-OLD-CALLBACK'))
    check('old refund callback cannot complete a superseded refund request',sql(f'SELECT status FROM `{B}`.order_refund WHERE id={channel_rid};')=='2')
    success_no=channel_refunded(channel_rid)
    notify(dict(event='refunded',refundNo=success_no,channelTradeNo='DUPLICATE'))
    check('original refund completion and duplicate callback post one expense',sql(f"SELECT COUNT(*),SUM(amount) FROM `{B}`.finance_flow WHERE order_id={channel_order['orderId']} AND flow_type=2 AND biz_type=2;")=='1\t10000.00')
    remaining_id=reviewed_refund(channel_order,20000,legacy_original=True); channel_refunded(remaining_id)
    check('legacy channel rows retain the nonrefundable fee',row(channel_order)['payment']==3 and wallet_before==sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))

    takeover=book(); channel_pay(takeover)
    takeover_id=reviewed_refund(takeover,30000,legacy_original=True)
    old_reference=sql(f'SELECT refund_trade_no FROM `{B}`.order_refund WHERE id={takeover_id};')
    PROVIDER.refunds[old_reference]['status']='failed'
    notify(dict(event='refund_failed',refundNo=old_reference,refundFailReason='Confirmed failure'))
    data(admin('order/refund/confirm',dict(id=takeover_id,takeover=1),base=ORDER))
    notify(dict(event='refunded',refundNo=old_reference,channelTradeNo='DUPLICATE-OLD'))
    check('late callback after confirmed failure and manual takeover cannot post an expense',
        sql(f'SELECT status,refund_channel FROM `{B}`.order_refund WHERE id={takeover_id};')=='2\t3'
        and sql(f"SELECT COUNT(*) FROM `{B}`.finance_flow WHERE order_id={takeover['orderId']} AND flow_type=2;")=='0')

    fallback=book(); fallback_payment=channel_pay(fallback)
    PROVIDER.payments[fallback_payment['payNo']]['quotaOverride']=3
    wallet_before=float(sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))
    fallback_id=reviewed_refund(fallback,30000,complete=False,legacy_original=True)
    check('provider quota exhaustion preserves the selected external destination',sql(f'SELECT channel_submit_status FROM `{B}`.order_refund WHERE id={fallback_id};')=='4' and float(sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))==wallet_before)
    data(admin('order/refund/confirm',dict(id=fallback_id,takeover=1),base=ORDER))
    check('finance can take over an undispatched exhausted quota refund',sql(f'SELECT refund_channel FROM `{B}`.order_refund WHERE id={fallback_id};')=='3')

    trip=make_trip(); qr=data(app('trip/pay',dict(tripId=trip['tripId'],payMethod=5)))
    trip_payment=PROVIDER.payments[qr['payNo']]; trip_payment['status']='paid'; notify(dict(trip_payment,event='paid'))
    children=[dict(orderId=b['orderId']) for b in trip['bookings']]
    check('one channel Trip payment creates separately balanced booking income',sql(f"SELECT COUNT(*),SUM(amount) FROM `{B}`.finance_flow WHERE order_id IN ({','.join(str(b['orderId']) for b in children)}) AND flow_type=1;")=='2\t60400.00')
    before_calls=len([c for c in PROVIDER.calls if c[0].endswith('/refund/create')])
    child_refunds=[reviewed_refund(child,30000,complete=False,legacy_original=True) for child in children]
    job('refund-queue')
    check('two Trip refunds merge into one provider refund request',len([c for c in PROVIDER.calls if c[0].endswith('/refund/create')])==before_calls+1)
    channel_refunded(child_refunds[0])
    check('merged channel completion refunds both bookings without duplication',all(row(child)['payment']==3 for child in children))

    wallet_trip=make_trip()
    balance_before=float(sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))
    data(app('trip/pay',dict(tripId=wallet_trip['tripId'],payMethod=3)))
    child_ids=','.join(str(b['orderId']) for b in wallet_trip['bookings'])
    check('wallet Trip debits once and records income for every booking',balance_before-float(sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};'))==60400 and sql(f'SELECT COUNT(*),SUM(amount) FROM `{B}`.finance_flow WHERE order_id IN ({child_ids}) AND flow_type=1;')=='2\t60400.00')

    rollback=book(); balance_before=sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};')
    sql(f"CREATE TRIGGER `{B}`.pah_fail_post BEFORE INSERT ON `{B}`.finance_account_entry FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Isolated posting failure';")
    failed=app('pay',dict(orderId=rollback['orderId'],payMethod=3))
    check('payment posting failure rolls back wallet, booking and income together',failed['code']!=0 and row(rollback)['status']==1 and balance_before==sql(f'SELECT balance FROM `{B}`.user_info WHERE id={UID};') and sql(f"SELECT COUNT(*) FROM `{B}`.finance_flow WHERE order_id={rollback['orderId']};")=='0')
    sql(f'DROP TRIGGER `{B}`.pah_fail_post;'); pay(rollback)
    check('retry after posting rollback succeeds once',row(rollback)['payment']==2)

    # A refund after a recorded payout is flagged for review without silently rewriting the transfer.
    reviewed_refund(first,1000); job('reconcile')
    check('post-payout adjustments require review and preserve the recorded payout',row(first)['reconciliation']==2 and sql(f'SELECT settle_amount,status FROM `{B}`.finance_merchant_settle WHERE id={settlement};')=='20000.00\t2')
    flagged=data(admin('finance/entry/list?reconciliationStatus=2',base=FINANCE))
    check('finance can filter reconciliation exceptions',any(int(entry['order_id'])==first['orderId'] for entry in flagged['list']))

    # Mixed wallet/channel funds refund to the approved wallet route without over-refunding the channel.
    mixed_uid=UID+1
    sql(f"INSERT INTO `{B}`.user_info(id,site_id,mobile,mobile_hash,nickname) VALUES({mixed_uid},7,'pah-mixed-{RUN}','pah-mixed-{RUN}','Mixed PAH QA');")
    job('credit',uid=mixed_uid,amount=5000)
    mixed=book(uid=mixed_uid)
    mixed_qr=data(app('pay',dict(orderId=mixed['orderId'],payMethod=5,useWallet=1),uid=mixed_uid))
    check('mixed payment charges the channel only the amount left after wallet use',mixed_qr['walletAmount']==5000 and mixed_qr['dueAmount']==25200)
    mixed_payment=PROVIDER.payments[mixed_qr['payNo']]; mixed_payment['status']='paid'; notify(dict(mixed_payment,event='paid'))
    check('mixed wallet and channel income add up to the disclosed prepayment',sql(f"SELECT COUNT(*),SUM(amount) FROM `{B}`.finance_flow WHERE order_id={mixed['orderId']} AND flow_type=1;")=='2\t30200.00')
    reviewed_refund(mixed,30000,uid=mixed_uid)
    check('mixed payment refund credits the wallet without over-refunding the bank channel',sql(f'SELECT balance FROM `{B}`.user_info WHERE id={mixed_uid};')=='30000.00' and sql(f"SELECT refund_channel FROM `{B}`.order_refund WHERE order_id={mixed['orderId']};")=='1')

    # Use each service's real HTTP entry points with the same disposable schema.
    with tempfile.TemporaryDirectory(prefix='sprint-p0-') as tmp:
        _,goods=start('goods',9503,Path(tmp))
        _,users=start('user',9502,Path(tmp))
        _,marketing=start('marketing',9507,Path(tmp))
    claims=dict(aud='app',user_id=UID,site_id=7)
    def hotels(path):
        return data(http(goods,'/api/v1/app/hotels/'+path,claims))
    def user(path, body=None, device='one'):
        return data(http(users,'/api/v1/app/user/'+path,dict(claims,device=device),body))

    sql(f'UPDATE `{B}`.merchant_store SET display_enabled=1 WHERE id IN (81,82);')
    check('canonical policy is used by list, facet and detail without a legacy property flag',
        hotels('list?payAtHotel=1')['total']==2 and hotels('filters')['counts']['payAtHotel']==2
        and hotels('detail?propertyId=81')['payAtHotel'] is True)
    policy(payAtHotelEnabled=False,noShowFeeEnabled=False,merchantUpfrontRate=0)
    check('disabling Pay at Hotel removes it from list, facet and detail',hotels('list?payAtHotel=1')['total']==0
        and hotels('filters')['counts']['payAtHotel']==0 and hotels('detail?propertyId=81')['payAtHotel'] is False)
    policy(effectiveAt=(datetime.now(timezone.utc)+timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))
    check('scheduled policy is hidden until it takes effect',hotels('filters')['counts']['payAtHotel']==0)

    user('favorite/add',dict(propertyId=81)); user('favorite/add',dict(propertyId=82)); user('favorite/add',dict(propertyId=81))
    check('saved hotels sync by account and are paginated',user('favorite/list?pageSize=1',device='two')['total']==2
        and user('favorite/list?page=2&pageSize=1',device='two')['list'][0]['property_id']==81)
    sql(f"UPDATE `{B}`.merchant_store SET operating_status=2 WHERE id=81;")
    paused=next(item for item in user('favorite/list',device='two')['list'] if item['property_id']==81)
    check('paused saved hotel remains listed as unavailable',paused['available'] is False)
    user('favorite/remove',dict(propertyId=81),device='two')
    sql(f"UPDATE `{B}`.merchant_store SET operating_status=1,city_key='Tamwe' WHERE id=81;")
    check('mixed-case city matches the public detail',hotels('list?cityKey=tamwe')['list'][0]['property_id']==hotels('detail?propertyId=81')['id'])
    check('another device sees deletion and existing orders are unaffected',user('favorite/list')['total']==1 and row(first)['paid']=='30200.00')
    check('the hotel details can detect a deleted favorite and save it again',user('favorite/status?propertyId=81')['saved'] is False
        and user('favorite/add',dict(propertyId=81)) is None and user('favorite/status?propertyId=81',device='two')['saved'] is True)

    # Product example: an already approved partial amount goes wholly to the guest's selected bank.
    partial_uid=UID+3
    sql(f"INSERT INTO `{B}`.user_info(id,site_id,mobile,mobile_hash,nickname) VALUES({partial_uid},7,'split-{RUN}','split-{RUN}','Split refund');")
    policy(transactionFeeRate=0); data(choice(True,20))
    job('credit',uid=partial_uid,amount=10000)
    partial=book(uid=partial_uid)
    qr=data(app('pay',dict(orderId=partial['orderId'],payMethod=5,useWallet=1),uid=partial_uid))
    transaction=PROVIDER.payments[qr['payNo']]; transaction['status']='paid'; notify(dict(transaction,event='paid'))
    request=data(merchant('order/refund/apply',dict(id=partial['orderId'],amount=18000,reason='Approved partial amount'),base=ORDER))
    rid=int(sql(f"SELECT id FROM `{B}`.order_refund WHERE refund_no='{request['refundNo']}';"))
    data(admin('order/refund/audit',dict(id=rid,auditStatus=1,refundAmount=18000),base=ORDER))
    data(app('refund/apply',dict(orderId=partial['orderId'],reason='Bank transfer',refundChannel=3,provider='KBZ',holder='QA Guest',accountNumber='12345678'),uid=partial_uid))
    data(admin('order/refund/confirm',dict(id=rid,claim=1),base=ORDER))
    data(admin('order/refund/confirm',dict(id=rid,proofImage=receipt,refundTradeNo='QA-SPLIT'),base=ORDER))
    check('10,000 wallet plus 20,000 KBZ: approved 18,000 goes wholly to selected external account',
        qr['walletAmount']==10000 and qr['dueAmount']==20000 and sql(f'SELECT balance FROM `{B}`.user_info WHERE id={partial_uid};')=='0.00'
        and sql(f'SELECT refund_amount,refund_channel,status FROM `{B}`.order_refund WHERE id={rid};')=='18000.00\t3\t3')
    wallet_start=datetime.now(timezone.utc).date().replace(day=1)
    previous=(wallet_start-timedelta(days=1)).replace(day=1).isoformat()
    outside=(wallet_start-timedelta(days=190)).replace(day=1).isoformat()
    fixture_wallet=UID+2
    sql(f"INSERT INTO `{B}`.user_info(id,site_id,mobile,mobile_hash,nickname) VALUES({fixture_wallet},7,'pah-history-{RUN}','pah-history-{RUN}','Wallet History');"
        f"INSERT INTO `{B}`.user_balance_log(site_id,user_id,change_type,created_at) VALUES "
        + ','.join(f"(7,{fixture_wallet},6,'{previous} 12:00:{i:02}')" for i in range(10))
        + f",(7,{fixture_wallet},6,'{wallet_start} 00:00:00'),(7,{fixture_wallet},6,'{outside} 00:00:00');")
    def wallet(path):
        return data(http(users,'/api/v1/app/user/balance-logs?type=expired'+path,dict(claims,user_id=fixture_wallet)))
    check('expired history fills from the previous month and excludes earlier audit history',wallet('')['total']==11
        and len(wallet('')['list'])==10 and len(wallet('&pageSize=20')['list'])==11)
    check('wallet month filtering is bounded by the same six-month window',wallet('&month='+previous[:7])['total']==10
        and wallet('&month='+outside[:7])['total']==0)

    tier=dict(siteId=7,propertyId=81,minNights=2,discountRate=20,status=1,priority=0,couponStackable=0)
    save_tier=lambda body,site=0,super=True: admin('marketing/longstay/save',body,base=marketing,site=site,super=super,perms=['marketing:longstay:save'])
    data(save_tier(tier))
    check('overlapping scheduled tiers are rejected',save_tier(dict(tier,discountRate=70,priority=10,startsAt=(datetime.now(timezone.utc)+timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')))['code']!=0)
    check('long-stay settings reject cross-site hotel IDs and unbookable nights',save_tier(dict(tier,siteId=6))['code']!=0
        and save_tier(dict(tier,minNights=60))['code']!=0)
    end=(datetime.fromisoformat(ARRIVE)+timedelta(days=2)).date().isoformat()
    qs=f'checkIn={ARRIVE}&checkOut={end}'
    sql(f"UPDATE `{B}`.hotel_room_type SET weekend_price=120000,base_price_citizen=90000 WHERE id=91;")
    listings={r['property_id']:r for r in hotels('list?'+qs)['list']}
    quote=hotels('detail?propertyId=81&'+qs)['longStay']
    check('scheduled and property-scoped long stays match list and detail',listings[81]['longStay']==quote
        and quote['rate']==20 and listings[82]['longStay'] is None)
    stay=data(app('trip/quote',dict(items=[dict(propertyId=81,roomTypeId=91,quantity=1,useDate=ARRIVE,endDate=end)])))
    booked=book(payAtHotel=0,endDate=end,expectedPayAmount=quote['total'])
    check('long-stay calendar price and discount agree across discovery, quote and actual booking',
        quote['total']==stay['payAmount']==booked['priceDetail']['payAmount'] and quote['discount']==stay['longstayDiscount'])
    sql(f"UPDATE `{B}`.goods_daily_stock SET price_citizen=90000 WHERE site_id=7 AND property_id=81 AND sku_id=91 AND stock_date='{ARRIVE}';")
    citizen_quote=hotels('detail?citizen=1&propertyId=81&'+qs)['longStay']
    check('dated citizen room card shows the nightly price used at checkout',
        float(hotels('detail?citizen=1&propertyId=81&'+qs)['skus'][0]['stay_nightly_price'])==citizen_quote['original']/2)
    citizen_booking=book(payAtHotel=0,endDate=end,isCitizen=1,expectedPayAmount=citizen_quote['total'])
    check('citizen price shown in long stay uses the same booking rate',citizen_quote['original']==180000
        and citizen_quote['total']==citizen_booking['priceDetail']['payAmount']==144000)

    sql(f"INSERT INTO `{B}`.marketing_coupon(id,site_id,coupon_name,coupon_type,discount_value,goods_scope,stackable,status) VALUES(90,7,'Long stay test',3,1000,1,1,1);"
        f"INSERT INTO `{B}`.marketing_coupon_receive(id,site_id,coupon_id,user_id,coupon_code) VALUES(92,7,90,{UID},'test-longstay-{RUN}');")
    lines=[dict(propertyId=81,roomTypeId=91,quantity=1,useDate=ARRIVE,endDate=end)]
    exclusive=data(app('trip/quote',dict(items=lines,couponId=92)))
    allowed=data(app('trip/quote',dict(items=lines+[dict(lines[0],propertyId=82,roomTypeId=92)],couponId=92)))
    check('eligible coupons apply after the long-stay discount',exclusive['couponDiscount']==1000 and allowed['couponDiscount']==1000)
    data(save_tier(dict(tier,minNights=31,maxNights=60,discountRate=25,platformFundingPct=40)))
    end60=(datetime.fromisoformat(ARRIVE)+timedelta(days=60)).date().isoformat()
    long_quote=data(app('trip/quote',dict(items=[dict(lines[0],endDate=end60)])))
    check('60 nights are eligible only at the configured hotel',long_quote['longstayDiscount']>0
        and app('trip/quote',dict(items=[dict(lines[0],endDate=end60,propertyId=82,roomTypeId=92)]))['code']!=0)
    funded=book(payAtHotel=0,endDate=end60)
    snap=json.loads(sql(f"SELECT longstay_funding_snapshot FROM `{B}`.order_main WHERE id={funded['orderId']};"))
    check('the booking freezes a 40/60 split for its long-stay discount',
        snap['platformAmount']==round(long_quote['longstayDiscount']*.4,2)
        and snap['merchantAmount']==round(long_quote['longstayDiscount']*.6,2))
    check('one hotel cannot enable both merchant and platform offers',save_tier(dict(tier,minNights=61,maxNights=70,offerSource='merchant'))['code']!=0)
    proposal=dict(propertyId=82,minNights=5,maxNights=15,discountRate=10,details='Standard rooms')
    def propose(terms):
        return merchant('properties/longstay/propose',terms,property_id=82)
    proposal_id=data(propose(proposal))['id']
    check('submitting a proposal twice preserves the same pending request',data(propose(proposal))['id']==proposal_id)
    def review(pid,action,reason=''):
        return admin('marketing/longstay/review',dict(id=pid,action=action,reason=reason),base=marketing)
    data(review(proposal_id,'reviewing'))
    check('returning an offer requires a reason',review(proposal_id,'returned')['code']!=0)
    data(review(proposal_id,'returned','Please adjust the date range'))
    updated=data(propose(dict(proposal,previousId=proposal_id,maxNights=20)))['id']
    data(review(updated,'reviewing')); approved=data(review(updated,'approved'))
    check('approved merchant proposal remains inactive until separately enabled',
        sql(f"SELECT status FROM `{B}`.marketing_longstay_tier WHERE id={approved['tier_id']};")=='2')
    data(save_tier(dict(tier,id=approved['tier_id'],propertyId=82,minNights=5,maxNights=20,discountRate=10,offerSource='merchant')))
    check('merchant receives review results and cannot submit conflicting platform dates',
        sql(f"SELECT COUNT(*) FROM `{B}`.merchant_notify WHERE request_id='longstay-{updated}-approved';")=='1'
        and merchant('properties/longstay/propose',dict(proposal,propertyId=81),property_id=81)['code']!=0)
    print(f'PASSED {len(PASSED)} assertions',flush=True)
except BaseException:
    for name in CONTAINERS:
        result=subprocess.run(['docker','logs','--tail','100',name],capture_output=True,text=True,encoding='utf-8')
        path=Path(tempfile.gettempdir())/(name+'-failure.log')
        path.write_text(result.stdout+result.stderr,encoding='utf-8')
        print('Service diagnostics: '+str(path),flush=True)
    raise
finally:
    for name in reversed(CONTAINERS): subprocess.run(['docker','rm','-f',name],capture_output=True)
    sql(f"DROP DATABASE IF EXISTS `{B}`; DROP DATABASE IF EXISTS `{S}`; DROP USER IF EXISTS '{B}'@'%';")
    PROVIDER.close()
    if before: check('source development business data is unchanged',before==sql(CHECKSUM))
