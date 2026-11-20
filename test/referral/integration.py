#!/usr/bin/env python3
"""Referral HTTP + real wallet/lifecycle integration in disposable schemas.

Requires the existing local MySQL/Redis containers and service images. No real
provider calls, normal business rows, production writes or test routes are used.
"""
from concurrent.futures import ThreadPoolExecutor
import base64
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RUN = secrets.token_hex(4)
BUSINESS = 'referral_qa_' + RUN
SYSTEM = BUSINESS + '_system'
DBUSER = BUSINESS
SECRET = secrets.token_hex(24)
CONTAINERS = []
PASSED = []


def command(args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr[-1800:] + result.stdout[-1800:])
    return result.stdout.strip()


def mysql(sql):
    return command(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], sql)


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    PASSED.append(name)
    print('PASS ' + name, flush=True)


def token(uid=1, site=7):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    body = encode(dict(alg='HS256', typ='JWT')) + '.' + encode(dict(
        aud='app', user_id=uid, site_id=site, iat=int(time.time()), exp=int(time.time()) + 3600))
    return body + '.' + base64.urlsafe_b64encode(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def request(path, uid=1, site=7):
    req = urllib.request.Request(BASE + '/api/v1/app/user/referral/' + path,
                                 headers={'Authorization': 'Bearer ' + token(uid, site), 'X-Site-Id': str(site)})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def register(mobile, referral='', password='Referral123456789'):
    payload = dict(mobile=mobile, password=password, referralCode=referral)
    req = urllib.request.Request(BASE + '/api/v1/app/auth/register', json.dumps(payload).encode(),
                                 headers={'Content-Type': 'application/json', 'X-Site-Id': '7'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def job(mode, uid=0, order=0, site=7):
    output = command(['docker', 'exec', '-i', ORDER_CONTAINER, 'php', '/tmp/referral-runner.php'],
                     json.dumps(dict(mode=mode, uid=uid, order=order, site=site)))
    result = json.loads(output.split('REFERRAL_RESULT=')[-1])
    if not result['ok']:
        print('SERVICE_RESULT ' + json.dumps(result), flush=True)
    return result


def bind(invitee, inviter=1, site=7):
    mysql(f"INSERT INTO `{BUSINESS}`.user_referral(site_id,inviter_user_id,invitee_user_id,bind_time) "
          f"VALUES({site},{inviter},{invitee},NOW());")


def booking(uid, site=7, status=2):
    return int(mysql(f"INSERT INTO `{BUSINESS}`.order_main(order_no,site_id,user_id,order_type,merchant_id,property_id,goods_name,sku_name,contact_name,contact_phone,quantity,booking_status,order_status,payment_status) "
                     f"VALUES('REF-{secrets.token_hex(8)}',{site},{uid},1,1,1,'Referral QA','QA Room','Fixture','000000',1,{status},1,2); SELECT LAST_INSERT_ID();"))


def balances(*uids):
    return mysql(f"SELECT id,balance FROM `{BUSINESS}`.user_info WHERE id IN ({','.join(map(str,uids))}) ORDER BY id;")


def start_service(service, port, directory):
    info = json.loads(command(['docker', 'inspect', 'mtrip-' + service + '-service-1']))[0]
    env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    env.update(DB_BUSINESS_DATABASE=BUSINESS, DB_SYSTEM_DATABASE=SYSTEM, DB_USERNAME=DBUSER,
               DB_PASSWORD=PASSWORD, MTRIP_JWT_SECRET=SECRET, MTRIP_AES_KEY=SECRET,
               SCAN_CACHEABLE='false', WORKER_NUM='2', REDIS_DB='14',
               MTRIP_CLIENT_SIGN='false', MTRIP_PAYLOAD_ENCRYPT='false')
    envfile = directory / (service + '.env')
    envfile.write_text('\n'.join(k + '=' + v for k, v in env.items()) + '\n', encoding='utf-8')
    container = 'mtrip-referral-' + service + '-' + RUN
    CONTAINERS.append(container)
    args = ['docker', 'run', '-d', '--name', container, '--network',
            next(iter(info['NetworkSettings']['Networks'])), '--env-file', str(envfile),
            '-p', '127.0.0.1::' + str(port)]
    for source, dest in [('backend/shared/src', '/shared/src'),
                         ('backend/services/' + service + '-service/app', '/opt/www/app'),
                         ('backend/services/' + service + '-service/config', '/opt/www/config')]:
        args += ['-v', str(ROOT / source) + ':' + dest + ':ro']
    command(args + [info['Config']['Image']])
    origin = 'http://' + command(['docker', 'port', container, str(port) + '/tcp'])
    for _ in range(50):
        try:
            urllib.request.urlopen(origin + '/healthz', timeout=1)
            return container, origin
        except Exception:
            time.sleep(.3)
    raise RuntimeError(service + ' failed to start')


try:
    PASSWORD = secrets.token_hex(20)
    mysql(f"CREATE DATABASE `{BUSINESS}`; CREATE DATABASE `{SYSTEM}`; "
          f"CREATE USER '{DBUSER}'@'%' IDENTIFIED BY '{PASSWORD}'; "
          f"GRANT ALL ON `{BUSINESS}`.* TO '{DBUSER}'@'%'; GRANT ALL ON `{SYSTEM}`.* TO '{DBUSER}'@'%';")
    for source, target in [('mtrip_business', BUSINESS), ('mtrip_system', SYSTEM)]:
        tables = mysql(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{source}' AND TABLE_TYPE='BASE TABLE';").splitlines()
        mysql(''.join(f'CREATE TABLE `{target}`.`{table}` LIKE `{source}`.`{table}`;' for table in tables))
    mysql(f"INSERT INTO `{SYSTEM}`.sys_site(id,site_name,currency) VALUES(1,'No reward','EUR'),(6,'Other offer','MMK'),(7,'Reward QA','MMK'); "
          f"INSERT INTO `{SYSTEM}`.sys_site_config(site_id,config_group,config_key,config_value,config_name) VALUES "
          "(7,'operate','referral_reward_inviter','50000','QA'),(7,'operate','referral_reward_invitee','12000','QA'),"
          "(6,'operate','referral_reward_inviter','3000','QA'),(6,'operate','referral_reward_invitee','1000','QA');")
    users = [(uid, 1 if uid in [41,42] else 6 if uid == 61 else 7) for uid in range(1, 63)]
    mysql(f'INSERT INTO `{BUSINESS}`.user_info(id,site_id,mobile,mobile_hash,nickname,referral_code) VALUES ' +
          ','.join(f"({uid},{site},'ref-{uid}','ref-{uid}','Referral QA {uid}','REFQA{uid}')" for uid, site in users) + ';')
    bind(2)
    bind(3)
    mysql(f'UPDATE `{BUSINESS}`.user_referral SET reward_status=1,reward_amount=0,reward_time=NOW() WHERE invitee_user_id=3;')
    with tempfile.TemporaryDirectory(prefix='referral-qa-') as temp:
        directory = Path(temp)
        ORDER_CONTAINER, _ = start_service('order', 9504, directory)
        _, BASE = start_service('user', 9502, directory)
    command(['docker', 'cp', str(ROOT / 'test/referral/runner.php'), ORDER_CONTAINER + ':/tmp/referral-runner.php'])

    summary = request('my')['data']
    check('zero-value historical completion is not counted as earned reward', summary['rewardedCount'] == 0)
    check('zero-value history remains visible as completed without reward', summary['noRewardCount'] == 1 and summary['inviteeCount'] == 2 and summary['pendingCount'] == 1)
    check('displayed offer uses the current site configuration and currency', summary['program'] == dict(inviterAmount=50000, inviteeAmount=12000, currency='MMK'))
    disabled = request('my', uid=41, site=1)['data']
    check('unconfigured site does not inherit another currency reward', disabled['program'] == dict(inviterAmount=0, inviteeAmount=0, currency='EUR'))
    check('pending filter preserves status zero', request('invitees?status=0')['data']['total'] == 1)
    check('completed history remains accessible', request('invitees?status=1')['data']['list'][0]['reward_amount'] in [0, '0.00'])

    order = booking(2)
    check('first qualifying check-in succeeds', job('checkin', order=order)['ok'])
    check('both wallets receive their independently configured amounts', balances(1,2) == '1\t50000.00\n2\t12000.00')
    check('reward creates two ledger entries and two lots', mysql(f'SELECT COUNT(*) FROM `{BUSINESS}`.user_balance_log WHERE order_id={order}; SELECT COUNT(*) FROM `{BUSINESS}`.user_wallet_lot;') == '2\n2')
    check('referral freezes the paid amount and source order', mysql(f'SELECT reward_status,reward_amount,reward_order_id FROM `{BUSINESS}`.user_referral WHERE invitee_user_id=2;') == f'1\t50000.00\t{order}')
    before = balances(1,2)
    check('repeated check-in is idempotent', job('checkin', order=order)['ok'] and balances(1,2) == before)
    second = booking(2)
    check('second booking does not pay another reward', job('checkin', order=second)['ok'] and balances(1,2) == before)
    credited = request('my')['data']
    check('summary matches real paid rewards and retained zero history', credited['rewardedCount'] == 1 and credited['noRewardCount'] == 1 and credited['rewardTotal'] == 50000)

    bind(4)
    a, b = booking(4), booking(4)
    with ThreadPoolExecutor(max_workers=2) as pool:
        concurrent = list(pool.map(lambda oid: job('checkin', order=oid), [a,b]))
    check('concurrent Trip-like child check-ins pay only once', all(r['ok'] for r in concurrent) and balances(4) == '4\t12000.00')
    check('concurrent check-ins create exactly one pair of credits', mysql(f'SELECT COUNT(*) FROM `{BUSINESS}`.user_balance_log WHERE order_id IN ({a},{b});') == '2')

    bind(5)
    failed = booking(5)
    before = balances(1,5)
    mysql(f"CREATE TRIGGER `{BUSINESS}`.qa_fail_credit BEFORE INSERT ON `{BUSINESS}`.user_balance_log FOR EACH ROW SET NEW.amount=IF(NEW.user_id=5,NULL,NEW.amount);")
    check('second credit failure rejects the check-in', not job('checkin', order=failed)['ok'])
    check('wallet writes and referral state roll back together', balances(1,5) == before and mysql(f'SELECT reward_status FROM `{BUSINESS}`.user_referral WHERE invitee_user_id=5;') == '0')
    check('failed reward also rolls back booking transition', mysql(f'SELECT booking_status FROM `{BUSINESS}`.order_main WHERE id={failed};') == '2')
    mysql(f'DROP TRIGGER `{BUSINESS}`.qa_fail_credit;')
    check('retry succeeds after the transient failure', job('checkin', order=failed)['ok'])

    bind(42, inviter=41, site=1)
    check('zero-config completion keeps the existing no-payment policy', job('checkin', order=booking(42, site=1), site=1)['ok'] and balances(41,42) == '41\t0.00\n42\t0.00')
    mysql(f"INSERT INTO `{SYSTEM}`.sys_site_config(site_id,config_group,config_key,config_value,config_name) VALUES(1,'operate','referral_reward_inviter','5','QA');")
    check('enabling rewards does not repay already-consumed history', job('checkin', order=booking(42, site=1), site=1)['ok'] and balances(41,42) == '41\t0.00\n42\t0.00')

    bind(6, inviter=61, site=6)
    cross = booking(6)
    before = balances(6,61)
    check('cross-site binding cannot credit a foreign wallet', not job('checkin', order=cross)['ok'] and balances(6,61) == before)
    check('cross-site rejection preserves binding and booking', mysql(f'SELECT reward_status FROM `{BUSINESS}`.user_referral WHERE invitee_user_id=6; SELECT booking_status FROM `{BUSINESS}`.order_main WHERE id={cross};') == '0\n2')

    bind(7)
    unpaid = booking(7, status=1)
    check('pending payment cannot earn a referral reward', not job('checkin', order=unpaid)['ok'] and balances(7) == '7\t0.00')
    check('no-referral booking checks in without a reward', job('checkin', order=booking(8))['ok'] and balances(8) == '8\t0.00')
    registered = register('977880001', 'REFQA1')
    check('R_TC_026 valid referral code registers a real account', registered['code'] == 0)
    uid = registered['data']['user']['id']
    check('R_TC_026 binding is persisted once in its site', mysql(f'SELECT site_id,inviter_user_id,reward_status FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={uid};') == '7\t1\t0')
    skipped = register('977880002')
    check('R_TC_027 skipped referral registers without binding', skipped['code'] == 0 and mysql(f"SELECT COUNT(*) FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={skipped['data']['user']['id']};") == '0')
    before_count = mysql(f'SELECT COUNT(*) FROM `{BUSINESS}`.user_info;')
    check('invalid referral is rejected without a half-created account', register('977880003', 'INVALIDQA')['code'] == 40001 and mysql(f'SELECT COUNT(*) FROM `{BUSINESS}`.user_info;') == before_count)
    check('cross-site referral code cannot bind a foreign inviter', register('977880004', 'REFQA61')['code'] == 40001)
    check('new-password complexity enforced by the real register API', register('977880005', password='abcdef1')['code'] == 40001)
    print('PASS_COUNT=' + str(len(PASSED)), flush=True)
finally:
    for container in CONTAINERS:
        subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
    mysql(f'DROP DATABASE IF EXISTS `{BUSINESS}`; DROP DATABASE IF EXISTS `{SYSTEM}`; DROP USER IF EXISTS \'{DBUSER}\'@\'%\';')
