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
import re
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


def token(uid=1, site=7, *, admin_permissions=None):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    claims = dict(aud='app', user_id=uid, site_id=site)
    if admin_permissions is not None:
        claims = dict(aud='admin', admin_id=uid, site_id=site, permissions=admin_permissions)
    claims.update(iat=int(time.time()), exp=int(time.time()) + 3600)
    body = encode(dict(alg='HS256', typ='JWT')) + '.' + encode(claims)
    return body + '.' + base64.urlsafe_b64encode(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def http_json(url, uid=1, site=7, *, admin_permissions=None, body=None):
    req = urllib.request.Request(url, None if body is None else json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + token(uid, site, admin_permissions=admin_permissions),
                                          'X-Site-Id': str(site), 'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def request(path, uid=1, site=7):
    return http_json(BASE + '/api/v1/app/user/referral/' + path, uid, site)


def affiliate_checks(marketing):
    endpoint = marketing + '/api/v1/admin/affiliate/partner/consumer-access'
    manage = ['affiliate:partner:list', 'affiliate:partner:manage-consumer']

    def admin_read(site=7):
        return http_json(endpoint + '?userId=60', 101, site, admin_permissions=manage)

    def admin_change(expected, status, *, site=7, permissions=manage):
        return http_json(endpoint, 101, site, admin_permissions=permissions,
                         body=dict(userId=60, status=status, expectedStatus=expected,
                                   affiliateType='agent', reason='Isolated affiliate verification'))

    def access(uid=60, site=7):
        return http_json(BASE + '/api/v1/app/user/affiliate/access', uid, site)['data']

    def open_invitation(code, property_id=None, site=7):
        payload = {'code': code}
        if property_id is not None:
            payload['propertyId'] = property_id
        return http_json(BASE + '/api/v1/app/auth/referral/open', site=site, body=payload)

    check('unactivated accounts do not see the affiliate center', access() == {'active': False})
    ordinary = register('977880006', 'REFQA60')
    ordinary_id = ordinary['data']['user']['id']
    check('partner read permission does not grant activation', admin_change(0, 1, permissions=manage[:1])['code'] != 0)
    check('admin cannot read or activate another site', admin_read(6)['code'] != 0 and admin_change(0, 1, site=6)['code'] != 0)
    first, retry = admin_change(0, 1), admin_change(0, 1)
    profile = admin_read()['data']
    profile_id = first['data']['profileId']
    check('activation uses one profile and retries preserve a single audit row',
          first['code'] == 0 and retry['data']['profileId'] == profile_id
          and profile['profile']['id'] == profile_id and len(profile['history']) == 1)
    check('only the same active consumer and site see the profile',
          access()['affiliateId'] == profile_id and not access(59)['active'] and not access(site=6)['active'])
    check('affiliate QR codes use the same code that ordinary invitations and registration already use',
          access()['referralCode'] == request('my', 60)['data']['referralCode'] == 'REFQA60')
    mysql(f"INSERT INTO `{BUSINESS}`.merchant_store (id,site_id,merchant_id,store_name,business_type) "
          "VALUES (7522,7,71,'Referral test hotel','hotel'),(7523,6,72,'Other site hotel','hotel');")
    check('affiliate link opens are counted by destination without making another referral binding',
          open_invitation('refqa60')['code'] == 0 and open_invitation('REFQA60', 7522)['code'] == 0
          and access()['linkOpens'] == 2 and access()['registeredReferrals'] == 0
          and mysql(f'SELECT property_id,opens FROM `{BUSINESS}`.consumer_affiliate_link_daily ORDER BY property_id;') == '0\t1\n7522\t1')
    check('ordinary, unknown or cross-site affiliate links do not change the count',
          open_invitation('REFQA59')['code'] == 0 and open_invitation('UNKNOWN')['code'] == 0
          and open_invitation('REFQA60', site=6)['code'] == 0 and open_invitation('REFQA60', 7523)['code'] == 0
          and access()['linkOpens'] == 2)
    linked = register('977880007', 'REFQA60', property_id=7522)
    linked_id = linked['data']['user']['id']
    check('active affiliation is frozen at registration and excludes ordinary rewards and history',
          mysql(f'SELECT consumer_affiliate_id FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={linked_id};') == str(profile_id)
          and access()['registeredReferrals'] == 1
          and request('my', 60)['data']['inviteeCount'] == 1
          and request('my', 60)['data']['program']['inviterAmount'] == 0)
    check('hotel attribution is stored only with the completed same-site affiliate registration',
          mysql(f'SELECT referral_property_id FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={linked_id};') == '7522')
    cross_site = register('977880009', 'REFQA60', property_id=7523)
    cross_site_id = cross_site['data']['user']['id']
    check('foreign destination is omitted without changing valid affiliate attribution',
          mysql(f'SELECT consumer_affiliate_id,referral_property_id FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={cross_site_id};')
          == f'{profile_id}\tNULL')
    check('suspending hides the center immediately', admin_change(1, 2)['code'] == 0 and not access()['active'])
    check('a suspended affiliate link stops counting',
          open_invitation('REFQA60', 7522)['code'] == 0
          and mysql(f'SELECT SUM(opens) FROM `{BUSINESS}`.consumer_affiliate_link_daily;') == '2')
    check('a suspended affiliate code cannot create another qualifying referral',
          register('977880008', 'REFQA60')['code'] == 40001 and register('977880008')['code'] == 0)
    check('a past ordinary registration still earns its ordinary reward after the inviter becomes an affiliate',
          job('checkin', order=booking(ordinary_id))['ok']
          and mysql(f'SELECT reward_status FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={ordinary_id};') == '1')
    before = balances(60, linked_id)
    check('a frozen affiliate registration keeps its linkage after suspension and never enters ordinary wallet rewards',
          job('checkin', order=booking(linked_id))['ok'] and balances(60, linked_id) == before
          and mysql(f'SELECT consumer_affiliate_id,reward_status FROM `{BUSINESS}`.user_referral WHERE invitee_user_id={linked_id};')
          == f'{profile_id}\t0')
    check('stale status cannot override a newer change', admin_change(1, 3)['code'] != 0)
    check('disable and reactivate retain the original profile and activation time',
          admin_change(2, 3)['code'] == 0 and not access()['active']
          and admin_change(3, 1)['data']['profileId'] == profile_id
          and access()['activatedAt'] == profile['profile']['activated_at'])
    check('all state changes are audited with operator and reason',
          [(entry['previous_status'], entry['new_status'], entry['operator_id'], bool(entry['reason']))
           for entry in admin_read()['data']['history']] == [(3, 1, 101, True), (2, 3, 101, True), (1, 2, 101, True), (0, 1, 101, True)])


def register(mobile, referral='', password='Referral123456789', property_id=None):
    payload = dict(mobile=mobile, password=password, referralCode=referral)
    if property_id is not None:
        payload['referralPropertyId'] = property_id
    req = urllib.request.Request(BASE + '/api/v1/app/auth/register', json.dumps(payload).encode(),
                                 headers={'Content-Type': 'application/json', 'X-Site-Id': '7'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def payout_account_checks(marketing):
    base = marketing + '/api/v1/admin/affiliate/'
    app_base = BASE + '/api/v1/app/user/affiliate/payout-accounts'
    verify = ['affiliate:payout-account:verify']
    manage = ['affiliate:payout-provider:manage']

    def admin(path, body=None, *, permissions=verify, site=7):
        return http_json(base + path, 101, site, admin_permissions=permissions, body=body)

    def app(path='', body=None, uid=60, site=7):
        return http_json(app_base + path, uid, site, body=body)

    profile_id = http_json(BASE + '/api/v1/app/user/affiliate/access', 60)['data']['affiliateId']
    provider = dict(siteId=7, kind='wallet', name='Fixture provider', enabled=1)
    check('site controls provider configuration',
          admin('payout-providers/save', provider, permissions=manage, site=6)['code'] != 0
          and admin('payout-providers/save', provider, permissions=verify)['code'] != 0
          and admin('payout-providers/save', provider, permissions=manage)['code'] == 0)
    provider_id = app()['data']['providers'][0]['id']
    fields = dict(providerId=provider_id, holderName='Fixture recipient', accountNumber='90123456789')
    check('only an active affiliate at the correct site can submit and read accounts',
          app('/save', fields, uid=59)['code'] != 0 and app(site=6)['code'] != 0)
    first = app('/save', fields)['data']['id']
    check('retrying creation with the same recipient account reuses the original row',
          app('/save', fields)['data']['id'] == first)
    second = app('/save', dict(fields, accountNumber='90234567890'))['data']['id']
    summary = app()['data']['accounts']
    check('multiple accounts can be saved and user list returns suffixes only',
          len(summary) == 2 and {row['number_suffix'] for row in summary} == {'6789', '7890'}
          and all('number_cipher' not in row and 'holder_cipher' not in row for row in summary))
    masked = mysql(f'SELECT number_cipher,holder_cipher FROM `{BUSINESS}`.consumer_affiliate_payout_account WHERE id={first};')
    check('recipient name and full number are encrypted in storage',
          fields['holderName'] not in masked and fields['accountNumber'] not in masked and len(masked) > 30)
    check('pending accounts cannot be set as default',
          app('/default', {'id': first})['code'] != 0)
    check('only a permitted same-site verifier can read the full account',
          admin('payout-accounts/inspect', {'id': first}, site=6)['code'] != 0
          and admin('payout-accounts/inspect', {'id': first}, permissions=manage)['code'] != 0
          and admin('payout-accounts/inspect', {'id': first})['data']['accountNumber'] == fields['accountNumber'])
    check('admin payout list stays masked',
          'number_cipher' not in admin(f'payout-accounts?affiliateId={profile_id}')['data'][0])
    for account in [first, second]:
        check('verified account may become the default',
              admin('payout-accounts/review', dict(id=account, version=1, status=1))['code'] == 0
              and app('/default', {'id': account})['code'] == 0)
    check('choosing another default clears the previous one',
          [row['id'] for row in app()['data']['accounts'] if row['is_default']] == [second])
    check('updating verified details requires a new review and clears the default',
          app('/save', dict(fields, id=second, version=1, accountNumber='90333333333'))['code'] == 0
          and app('/default', {'id': second})['code'] != 0
          and [row['id'] for row in app()['data']['accounts'] if row['is_default']] == [])
    check('stale and missing-reason reviews are refused',
          admin('payout-accounts/review', dict(id=second, version=1, status=1))['code'] != 0
          and admin('payout-accounts/review', dict(id=second, version=2, status=2))['code'] != 0)
    check('rejection shows its reason and leaves no default',
          admin('payout-accounts/review', dict(id=second, version=2, status=2, reason='Fixture rejected'))['code'] == 0
          and app()['data']['accounts'][0]['review_note'] == 'Fixture rejected'
          and app('/default', {'id': second})['code'] != 0)
    check('a disabled provider cannot be selected or submitted',
          admin('payout-providers/save', dict(siteId=7, id=provider_id, enabled=0), permissions=manage)['code'] == 0
          and app('/default', {'id': first})['code'] != 0
          and app('/save', fields)['code'] != 0
          and app()['data']['providers'] == [])
    check('reading and reviewing details writes an audit record without the account number',
          mysql(f'SELECT GROUP_CONCAT(action ORDER BY id) FROM `{BUSINESS}`.consumer_affiliate_payout_audit WHERE account_id={first};')
          == 'inspected,verified')


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
    for filename, targets in [('V20261124070000__consumer-affiliate-access.sql', [BUSINESS, SYSTEM]),
                              ('V20261125080000__consumer-affiliate-link-opens.sql', [BUSINESS]),
                              ('V20261125090000__consumer-affiliate-payout-accounts.sql', [BUSINESS, SYSTEM])]:
        migration = ROOT / 'database/migrations' / filename
        isolated = migration.read_text(encoding='utf-8').replace('mtrip_business', BUSINESS).replace('mtrip_system', SYSTEM)
        if re.findall(r'\bUSE\s+(\w+)\s*;', isolated) != targets:
            raise RuntimeError('Invalid isolated migration targets')
        for _ in range(2):
            command(['docker', 'exec', '-i', '-e', 'MYSQL_PWD='+PASSWORD, 'mtrip-mysql-1',
                     'mysql', '-u'+DBUSER, '--default-character-set=utf8mb4'], isolated)
    check('affiliate migration reruns and creates the dedicated permission once',
          mysql(f"SELECT COUNT(*) FROM `{SYSTEM}`.sys_menu WHERE perm_key='affiliate:partner:manage-consumer';") == '1')
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
        _, MARKETING = start_service('marketing', 9507, directory)
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
    affiliate_checks(MARKETING)
    payout_account_checks(MARKETING)
    print('PASS_COUNT=' + str(len(PASSED)), flush=True)
finally:
    for container in CONTAINERS:
        subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
    mysql(f'DROP DATABASE IF EXISTS `{BUSINESS}`; DROP DATABASE IF EXISTS `{SYSTEM}`; DROP USER IF EXISTS \'{DBUSER}\'@\'%\';')
