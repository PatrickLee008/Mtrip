#!/usr/bin/env python3
"""HTTP regression against temporary schema clones and a disposable user-service.

Run: python3 test/user-balance/integration.py (requires the local Docker stack).
Only synthetic users are created. Temporary databases and container are removed.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
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
BUSINESS = 'balance_qa_' + RUN
SYSTEM = BUSINESS + '_system'
DBUSER = BUSINESS
CONTAINER = 'mtrip-balance-qa-' + RUN
SECRET = secrets.token_hex(24)
PERMISSION = 'user:list:adjust-balance'
PASSED = []


def command(args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:] + result.stdout[-2000:])
    return result.stdout.strip()


def mysql(sql):
    return command(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], sql)


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    PASSED.append(label)
    print('PASS', label, flush=True)


def token(admin_id=41, site=1, permissions=None, super_admin=False):
    claims = dict(aud='admin', admin_id=admin_id, admin_name='Balance QA', site_id=site,
                  permissions=[PERMISSION] if permissions is None else permissions,
                  is_super=super_admin, iat=int(time.time()), exp=int(time.time()) + 3600)
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    body = encode(dict(alg='HS256', typ='JWT')) + '.' + encode(claims)
    signature = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return body + '.' + base64.urlsafe_b64encode(signature).decode().rstrip('=')


def adjust(amount='1.00', user=1, auth=None, reason='QA adjustment'):
    payload = dict(id=user, amount=amount, reason=reason)
    headers = {'Content-Type': 'application/json'}
    if auth is not None:
        headers['Authorization'] = 'Bearer ' + auth
    request = urllib.request.Request(BASE + '/api/v1/admin/user/adjust-balance',
                                     json.dumps(payload).encode(), headers)
    try:
        response = urllib.request.urlopen(request, timeout=12)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def state(user=1):
    return mysql(f'SELECT balance FROM `{BUSINESS}`.user_info WHERE id={user}; '
                 f'SELECT COUNT(*) FROM `{BUSINESS}`.user_balance_log WHERE user_id={user};')


try:
    password = secrets.token_hex(20)
    mysql(f"CREATE DATABASE `{BUSINESS}`; CREATE DATABASE `{SYSTEM}`; "
          f"CREATE USER '{DBUSER}'@'%' IDENTIFIED BY '{password}'; "
          f"GRANT ALL ON `{BUSINESS}`.* TO '{DBUSER}'@'%'; "
          f"GRANT ALL ON `{SYSTEM}`.* TO '{DBUSER}'@'%'; "
          f'CREATE TABLE `{BUSINESS}`.user_info LIKE mtrip_business.user_info; '
          f'CREATE TABLE `{BUSINESS}`.user_balance_log LIKE mtrip_business.user_balance_log; '
          f'CREATE TABLE `{SYSTEM}`.sys_operation_log LIKE mtrip_system.sys_operation_log; '
          f"INSERT INTO `{BUSINESS}`.user_info(id,site_id,mobile,mobile_hash,nickname,balance,deleted_at) VALUES "
          "(1,1,'qa-1','qa-1','QA One',100,NULL),(2,2,'qa-2','qa-2','QA Two',10,NULL),"
          "(3,1,'qa-3','qa-3','QA Deleted',10,NOW());")
    info = json.loads(command(['docker', 'inspect', 'mtrip-user-service-1']))[0]
    env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    env.update(DB_BUSINESS_DATABASE=BUSINESS, DB_SYSTEM_DATABASE=SYSTEM,
               DB_USERNAME=DBUSER, DB_PASSWORD=password, MTRIP_JWT_SECRET=SECRET,
               SCAN_CACHEABLE='false', WORKER_NUM='2', REDIS_DB='14',
               MTRIP_CLIENT_SIGN='false', MTRIP_PAYLOAD_ENCRYPT='false', MTRIP_SUBMIT_LOCK='true')
    with tempfile.TemporaryDirectory(prefix='mtrip-balance-qa-') as directory:
        envfile = Path(directory) / 'env'
        envfile.write_text('\n'.join(key + '=' + value for key, value in env.items()) + '\n')
        envfile.chmod(0o600)
        args = ['docker', 'run', '-d', '--name', CONTAINER, '--network',
                next(iter(info['NetworkSettings']['Networks'])), '--env-file', str(envfile),
                '-p', '127.0.0.1::9502']
        for source, dest in [('backend/shared/src', '/shared/src'),
                             ('backend/services/user-service/app', '/opt/www/app'),
                             ('backend/services/user-service/config', '/opt/www/config')]:
            args += ['-v', str(ROOT / source) + ':' + dest + ':ro']
        command(args + [info['Config']['Image']])
    BASE = 'http://' + command(['docker', 'port', CONTAINER, '9502/tcp'])
    for attempt in range(40):
        try:
            urllib.request.urlopen(BASE + '/healthz', timeout=1)
            break
        except Exception:
            time.sleep(0.5)
    else:
        raise RuntimeError('QA service failed to start')

    admin = token()
    check('unauthenticated request rejected', adjust()['code'] == 40101)
    check('dedicated permission enforced by HTTP aspect', adjust(auth=token(permissions=[]))['code'] == 40301)
    check('cross-site request rejected', adjust(user=2, auth=admin)['code'] == 40302)
    check('deleted user rejected', adjust(user=3, auth=admin)['code'] == 40401)
    check('missing user rejected', adjust(user=999, auth=admin)['code'] == 40401)
    before = state()
    for amount in ['0', '-0.00', '1.001', '1e2', '10000000000', 'abc', None, [], True]:
        check('invalid amount rejected: ' + repr(amount), adjust(amount, auth=admin)['code'] == 40001)
    check('blank reason rejected', adjust(auth=admin, reason='  ')['code'] == 40001)
    check('oversized reason rejected', adjust(auth=admin, reason='x' * 201)['code'] == 40001)
    check('invalid requests preserve balance and logs', state() == before)
    check('increase returns exact balance', adjust('0.10', auth=admin)['data']['balance'] == '100.10')
    check('deduct returns exact balance', adjust('-0.20', auth=admin)['data']['balance'] == '99.90')
    log = mysql(f'SELECT site_id,user_id,change_type,amount,before_balance,after_balance,operator_id,remark '
                f'FROM `{BUSINESS}`.user_balance_log ORDER BY id DESC LIMIT 1;')
    check('log contains signed amount, snapshots, site, operator and reason',
          log == '1\t1\t4\t-0.20\t100.10\t99.90\t41\tQA adjustment')
    before = state()
    check('insufficient balance rejected', adjust('-99.91', auth=admin)['code'] == 40901)
    check('insufficient balance leaves no log', state() == before)
    check('deduction to zero allowed', adjust('-99.90', auth=admin)['data']['balance'] == '0.00')
    check('maximum decimal balance supported', adjust('9999999999.99', auth=admin)['data']['balance'] == '9999999999.99')
    check('balance overflow rejected', adjust('0.01', auth=admin)['code'] == 40901)
    check('super administrator can adjust another site',
          adjust(user=2, auth=token(site=0, super_admin=True))['data']['balance'] == '11.00')
    mysql(f'UPDATE `{BUSINESS}`.user_info SET balance=10 WHERE id=1;')
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda i: adjust('0.10', auth=token(admin_id=i)), [51, 52]))
    check('concurrent administrators both succeed', all(result['code'] == 0 for result in results))
    check('row lock prevents lost updates', state().splitlines()[0] == '10.20')
    before = state()
    mysql(f"CREATE TRIGGER `{BUSINESS}`.qa_fail_log BEFORE INSERT ON `{BUSINESS}`.user_balance_log "
          "FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA rollback';")
    check('log failure reports failure', adjust(auth=admin)['code'] != 0)
    check('log failure rolls back balance update', state() == before)
    mysql(f'DROP TRIGGER `{BUSINESS}`.qa_fail_log;')
    check('service remains usable after rollback', adjust(auth=admin)['code'] == 0)
    print('PASS_COUNT=' + str(len(PASSED)), flush=True)
finally:
    subprocess.run(['docker', 'rm', '-f', CONTAINER], capture_output=True)
    mysql(f'DROP DATABASE IF EXISTS `{BUSINESS}`; DROP DATABASE IF EXISTS `{SYSTEM}`; '
          f"DROP USER IF EXISTS '{DBUSER}'@'%';")
