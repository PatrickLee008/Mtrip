#!/usr/bin/env python3
"""Real HTTP/Redis regression in empty schema clones; never copies customer rows."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
from pathlib import Path
import re
import secrets
import shutil
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
RUN = secrets.token_hex(4)
SYSTEM = 'mtrip_session_qa_' + RUN
BUSINESS = SYSTEM + '_business'
DBUSER = 'session_qa_' + RUN
JWT = 'session-qa-jwt-' + RUN
AES = 'session-qa-aes-' + RUN
PASSWORD = 'SessionQA2026!'
TOTP = 'JBSWY3DPEHPK3PXP'
QA = Path(tempfile.mkdtemp(prefix='mtrip-session-qa-'))
QA.chmod(0o700)
CONTAINERS = []
RESULTS = []


def command(args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(args[:3]) + '\n' + result.stderr[-1800:] + result.stdout[-1200:])
    return result.stdout


def mysql(sql):
    return command(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], sql)


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    RESULTS.append(label)
    print('PASS', label, flush=True)


def request(realm, path, data=None, token=None, cookie=None, headers=None, port_override=None):
    port = port_override or (19601 if realm == 'admin' else 19605)
    h = {'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    if cookie:
        h['Cookie'] = 'mtrip_' + realm + '_refresh=' + cookie
    h.update(headers or {})
    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/{realm}/' + path,
                                 data=json.dumps(data).encode() if data is not None else None, headers=h)
    try:
        response = urllib.request.urlopen(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    try:
        body = json.loads(raw)
    except ValueError:
        raise AssertionError(f'{realm}/{path}: non-JSON HTTP {response.status}: {raw[:200]!r}')
    return body, response.headers


def ok(realm, path, **kwargs):
    body, headers = request(realm, path, **kwargs)
    assert body['code'] == 0, f'{realm}/{path}: {body}'
    return body['data'], headers


def cookie_value(headers):
    return headers.get('Set-Cookie', '').split(';', 1)[0].split('=', 1)[-1]


def claims(token):
    return json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '=='))


def signed(payload):
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')
    raw = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc(payload)
    return raw + '.' + base64.urlsafe_b64encode(hmac.new(JWT.encode(), raw.encode(), hashlib.sha256).digest()).decode().rstrip('=')


def login(realm, username=None, headers=None):
    if realm == 'admin':
        return ok(realm, 'auth/login', data={'username': username or 'session-super', 'password': PASSWORD}, headers=headers)
    username = username or 'session-owner'
    assert username in ['session-owner', 'session-employee']
    mysql(f"UPDATE `{BUSINESS}`.merchant_admin SET last_accepted_totp_step=0 WHERE username='{username}';")
    challenge, _ = ok(realm, 'auth/login', data={'username': username, 'password': PASSWORD})
    counter = int(time.time()) // 30
    digest = hmac.new(base64.b32decode(TOTP), struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    code = str((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000).zfill(6)
    return ok(realm, 'auth/2fa/verify', data={'challengeToken': challenge['challengeToken'], 'twoFaCode': code})


def refresh(realm, cookie, **kwargs):
    return request(realm, 'auth/refresh', data={}, cookie=cookie, headers={'X-Mtrip-Refresh': '1', **kwargs})


def redis_get(key):
    return command(['docker', 'exec', REDIS, 'redis-cli', '--raw', 'GET', key]).strip()


def redis_set(key, value):
    command(['docker', 'exec', REDIS, 'redis-cli', 'SETEX', key, '604800', json.dumps(value)])


try:
    mysql(f"CREATE DATABASE `{SYSTEM}`; CREATE DATABASE `{BUSINESS}`;")
    for source, target in [('mtrip_system', SYSTEM), ('mtrip_business', BUSINESS)]:
        tables = mysql(f"SELECT table_name FROM information_schema.tables WHERE table_schema='{source}' AND table_type='BASE TABLE';").splitlines()
        assert all(re.fullmatch(r'[a-zA-Z0-9_]+', table) for table in tables)
        mysql('\n'.join(f'CREATE TABLE `{target}`.`{table}` LIKE `{source}`.`{table}`;' for table in tables))
    db_password = secrets.token_hex(20)
    mysql(f"CREATE USER '{DBUSER}'@'%' IDENTIFIED BY '{db_password}'; GRANT ALL ON `{SYSTEM}`.* TO '{DBUSER}'@'%'; GRANT ALL ON `{BUSINESS}`.* TO '{DBUSER}'@'%';")
    values = json.loads(command(['docker', 'exec', 'mtrip-system-service-1', 'php', '-r',
        'require "/shared/src/Support/CryptoHelper.php"; echo json_encode(["password"=>password_hash($argv[1], PASSWORD_BCRYPT), "totp"=>\\Mtrip\\Shared\\Support\\CryptoHelper::encrypt($argv[2],$argv[3])]);', PASSWORD, TOTP, AES]))
    mysql(f"""USE `{SYSTEM}`;
INSERT INTO sys_config(config_group,config_key,config_value,value_type,config_name,default_value) VALUES
('security','jwt_expire_minutes','120',2,'Access minutes','120'),('security','jwt_refresh_days','7',2,'Session days','7');
INSERT INTO sys_admin(id,site_id,username,password,real_name,is_super,status) VALUES
(1,0,'session-super','{values['password']}','QA Super',1,1),(2,1,'session-staff','{values['password']}','QA Staff',0,1);
INSERT INTO sys_role(id,site_id,role_name,status) VALUES(10,1,'Session QA',1);
INSERT INTO sys_admin_role(admin_id,role_id) VALUES(2,10);
INSERT INTO sys_menu(id,parent_id,menu_name,perm_key,menu_type) VALUES(10,0,'QA','qa:test',3);
INSERT INTO sys_role_menu(role_id,menu_id) VALUES(10,10);
USE `{BUSINESS}`;
INSERT INTO merchant_info(id,site_id,merchant_name,credit_code,legal_person,contact_name,contact_phone,status)
VALUES(1,1,'Session QA','SESSION-QA','QA','QA','',3);
INSERT INTO merchant_admin(id,site_id,merchant_id,account_type,username,password,real_name,is_owner,status,auth_version,two_fa_status,two_fa_secret_enc)
VALUES(1,1,1,2,'session-owner','{values['password']}','QA Owner',1,1,1,1,'{values['totp']}');
INSERT INTO merchant_admin(id,site_id,merchant_id,account_type,username,password,real_name,is_owner,status,auth_version,two_fa_status,two_fa_secret_enc)
VALUES(2,1,1,2,'session-employee','{values['password']}','QA Employee',0,1,1,1,'{values['totp']}');
INSERT INTO merchant_menu(id,parent_id,menu_name,perm_key,menu_type,account_scope) VALUES
(10,0,'Role edit','mch:role:edit',3,'2'),(11,0,'Role assign','mch:role:assign',3,'2'),(12,0,'Role grant','mch:role:grant',3,'2');
INSERT INTO merchant_role(id,site_id,merchant_id,account_type,role_name,is_builtin,status) VALUES(10,1,1,2,'QA Employee',0,1);
INSERT INTO merchant_admin_role(admin_id,role_id) VALUES(2,10);
INSERT INTO merchant_role_menu(role_id,menu_id) VALUES(10,10);
""")
    migration = (ROOT / 'database/migrations/V20261028090000__browser-session-policy.sql').read_text().replace('`mtrip_system`', '`' + SYSTEM + '`')
    mysql(migration)
    mysql(migration)
    check('policy migration is idempotent and selects 30 minutes', mysql(f"SELECT config_value FROM `{SYSTEM}`.sys_config WHERE config_key='jwt_expire_minutes';").strip() == '30')
    merchant_info = json.loads(command(['docker', 'inspect', 'mtrip-merchant-service-1']))[0]
    network = next(iter(merchant_info['NetworkSettings']['Networks']))
    REDIS = 'mtrip-session-qa-' + RUN + '-redis'
    redis_image = json.loads(command(['docker', 'inspect', 'mtrip-redis-1']))[0]['Config']['Image']
    CONTAINERS.append(REDIS)
    command(['docker', 'run', '-d', '--name', REDIS, '--network', network, redis_image, 'redis-server', '--save', '', '--appendonly', 'no'])
    for service, port, http_port in [('system', 19601, 9501), ('merchant', 19605, 9505)]:
        info = json.loads(command(['docker', 'inspect', f'mtrip-{service}-service-1']))[0]
        env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
        env.update(DB_SYSTEM_DATABASE=SYSTEM, DB_BUSINESS_DATABASE=BUSINESS, DB_USERNAME=DBUSER, DB_PASSWORD=db_password,
                   MTRIP_JWT_SECRET=JWT, MTRIP_AES_KEY=AES, REDIS_HOST=REDIS, REDIS_AUTH='', REDIS_DB='0',
                   MTRIP_CLIENT_SIGN='false', MTRIP_PAYLOAD_ENCRYPT='false', MTRIP_REQUEST_LOG='false',
                   MTRIP_SUBMIT_LOCK='true', SCAN_CACHEABLE='false', WORKER_NUM='2', HTTP_PORT=str(http_port))
        envfile = QA / (service + '.env')
        envfile.write_text('\n'.join(key + '=' + str(value) for key, value in env.items()))
        envfile.chmod(0o600)
        name = 'mtrip-session-qa-' + RUN + '-' + service
        CONTAINERS.append(name)
        command(['docker', 'run', '-d', '--name', name, '--network', network, '--env-file', str(envfile),
                 '-p', f'127.0.0.1:{port}:{http_port}', '-v', str(ROOT / 'backend/shared/src') + ':/shared/src:ro',
                 '-v', str(ROOT / f'backend/services/{service}-service/app') + ':/opt/www/app:ro',
                 '-v', str(ROOT / f'backend/services/{service}-service/config') + ':/opt/www/config:ro', info['Config']['Image']])
    for port in [19601, 19605]:
        for _ in range(80):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{port}/healthz', timeout=1)
                break
            except OSError:
                time.sleep(0.25)
        else:
            raise RuntimeError(f'QA service {port} did not start')

    for realm in ['admin', 'merchant']:
        session, headers = login(realm)
        token, cookie = session['token'], cookie_value(headers)
        payload = claims(token)
        check(realm + ' full login creates a managed 30-minute JWT', payload['exp'] - payload['iat'] == 1800 and payload['aud'] == realm and bool(payload['sid']))
        check(realm + ' refresh credential is HttpOnly, Strict and auth-path scoped', all(value in headers['Set-Cookie'] for value in ['HttpOnly', 'SameSite=Strict', f'Path=/api/v1/{realm}/auth']))
        check(realm + ' response exposes expiry metadata and is never cached', 604795 <= session['sessionExpiresAt'] - time.time() <= 604800 and headers['Cache-Control'] == 'no-store')
        key = f"mtrip:browser-session:{realm}:{payload['sid']}"
        stored = redis_get(key)
        check(realm + ' Redis stores a hash rather than the refresh credential', cookie not in stored and hashlib.sha256(cookie.encode()).hexdigest() == json.loads(stored)['refresh_hash'])
        check(realm + ' access token works', request(realm, 'auth/me', token=token)[0]['code'] == 0)
        check(realm + ' CSRF marker is required', request(realm, 'auth/refresh', data={}, cookie=cookie)[0]['code'] == 40301)
        check(realm + ' hostile same-site origin is rejected', refresh(realm, cookie, Origin='https://evil.example.com')[0]['code'] == 40301)
        check(realm + ' cross-site request is rejected', refresh(realm, cookie, **{'Sec-Fetch-Site': 'cross-site'})[0]['code'] == 40301)
        other_realm = 'merchant' if realm == 'admin' else 'admin'
        check(realm + ' cookie cannot enter the other realm', refresh(other_realm, cookie)[0]['code'] == 40101)
        check(realm + ' access JWT cannot enter the other realm', request(other_realm, 'auth/me', token=token)[0]['code'] == 40101)
        expired_token = signed(dict(payload, exp=int(time.time()) - 5))
        check(realm + ' expired access JWT is rejected', request(realm, 'auth/me', token=expired_token)[0]['code'] == 40102)
        with ThreadPoolExecutor(max_workers=6) as pool:
            parallel = list(pool.map(lambda _: refresh(realm, cookie), range(6)))
        check(realm + ' six simultaneous refreshes all succeed with one cookie rotation', all(body['code'] == 0 for body, _ in parallel) and len({cookie_value(h) for _, h in parallel}) == 1)
        fresh, fresh_headers = parallel[0]
        next_cookie = cookie_value(fresh_headers)
        check(realm + ' refresh works without a valid access JWT and keeps the absolute deadline', fresh['data']['sessionExpiresAt'] == session['sessionExpiresAt'] and next_cookie != cookie)
        check(realm + ' refreshed JWT works', request(realm, 'auth/me', token=fresh['data']['token'])[0]['code'] == 0)
        check(realm + ' lost response can retry within the grace window', refresh(realm, cookie)[0]['code'] == 0)
        state = json.loads(redis_get(key))
        state['rotated_at'] = int(time.time()) - 16
        redis_set(key, state)
        check(realm + ' replay outside grace revokes the session', refresh(realm, cookie)[0]['code'] == 40101 and refresh(realm, next_cookie)[0]['code'] == 40101)
        check(realm + ' revocation also rejects already issued access JWTs', request(realm, 'auth/me', token=fresh['data']['token'])[0]['code'] == 40101)
        session, headers = login(realm)
        _, logout_headers = ok(realm, 'auth/logout', data={}, token=session['token'], cookie=cookie_value(headers))
        check(realm + ' logout clears the cookie', 'Max-Age=0' in logout_headers['Set-Cookie'])
        check(realm + ' logout revokes both credentials', request(realm, 'auth/me', token=session['token'])[0]['code'] == 40101 and refresh(realm, cookie_value(headers))[0]['code'] == 40101)
        session, headers = login(realm)
        payload = claims(session['token'])
        key = f"mtrip:browser-session:{realm}:{payload['sid']}"
        state = json.loads(redis_get(key))
        state['expires_at'] = int(time.time()) - 1
        redis_set(key, state)
        check(realm + ' absolute expiry rejects refresh and access', refresh(realm, cookie_value(headers))[0]['code'] == 40101 and request(realm, 'auth/me', token=session['token'])[0]['code'] == 40101)

    root, _ = login('admin')
    staff, staff_headers = login('admin', 'session-staff')
    ok('admin', 'sys/admin/toggle-status', data={'id': 2}, token=root['token'])
    ok('admin', 'sys/admin/toggle-status', data={'id': 2}, token=root['token'])
    check('admin disable/enable cannot resurrect an old session', request('admin', 'auth/me', token=staff['token'])[0]['code'] == 40101 and refresh('admin', cookie_value(staff_headers))[0]['code'] == 40101)
    staff, staff_headers = login('admin', 'session-staff')
    ok('admin', 'sys/role/assign-perms', data={'roleId': 10, 'menuIds': []}, token=root['token'])
    ok('admin', 'sys/role/assign-perms', data={'roleId': 10, 'menuIds': [10]}, token=root['token'])
    check('admin permission removal/restoration cannot resurrect a session', request('admin', 'auth/me', token=staff['token'])[0]['code'] == 40101)
    staff, staff_headers = login('admin', 'session-staff')
    ok('admin', 'sys/admin/reset-password', data={'id': 2, 'password': 'ChangedQA2026!'}, token=root['token'])
    check('admin password reset revokes access and refresh', request('admin', 'auth/me', token=staff['token'])[0]['code'] == 40101 and refresh('admin', cookie_value(staff_headers))[0]['code'] == 40101)
    merchant, merchant_headers = login('merchant')
    mysql(f'UPDATE `{BUSINESS}`.merchant_admin SET auth_version=auth_version+1 WHERE id=1;')
    check('merchant security version revokes access and refresh', request('merchant', 'auth/me', token=merchant['token'])[0]['code'] == 40101 and refresh('merchant', cookie_value(merchant_headers))[0]['code'] == 40101)
    owner, _ = login('merchant')
    employee, employee_headers = login('merchant', 'session-employee')
    ok('merchant', 'role/update', data={'id': 10, 'status': 0}, token=owner['token'])
    ok('merchant', 'role/update', data={'id': 10, 'status': 1}, token=owner['token'])
    check('merchant role disable/enable cannot resurrect employee sessions', request('merchant', 'auth/me', token=employee['token'])[0]['code'] == 40101)
    employee, employee_headers = login('merchant', 'session-employee')
    ok('merchant', 'role/assign', data={'id': 10, 'menuIds': []}, token=owner['token'])
    check('merchant permission changes revoke access and refresh', request('merchant', 'auth/me', token=employee['token'])[0]['code'] == 40101 and refresh('merchant', cookie_value(employee_headers))[0]['code'] == 40101)
    employee, employee_headers = login('merchant', 'session-employee')
    ok('merchant', 'role/grant', data={'adminId': 2, 'roleIds': []}, token=owner['token'])
    check('merchant account-role changes revoke the employee session', refresh('merchant', cookie_value(employee_headers))[0]['code'] == 40101)
    support, _ = ok('admin', 'merchant/impersonate/start', port_override=19605,
                    data={'merchantId': 1, 'accountId': 1, 'reason': 'Isolated session QA'}, token=root['token'])
    support_session, support_headers = ok('merchant', 'auth/impersonation/exchange', data={'exchangeCode': support['exchangeCode']})
    support_claims = claims(support_session['token'])
    check('support login remains limited to 30 minutes without refresh credentials', 'sid' not in support_claims and 1795 <= support_claims['exp'] - time.time() <= 1800 and not support_headers.get('Set-Cookie'))
    check('support login remains usable', request('merchant', 'auth/me', token=support_session['token'])[0]['code'] == 0)
    _, support_logout_headers = ok('merchant', 'auth/logout', data={}, token=support_session['token'])
    check('support logout does not clear the ordinary refresh cookie', not support_logout_headers.get('Set-Cookie'))
    mysql(f'UPDATE `{BUSINESS}`.merchant_admin SET last_accepted_totp_step=0 WHERE id=1;')
    challenge, _ = ok('merchant', 'auth/login', data={'username': 'session-owner', 'password': PASSWORD})
    digest = hmac.new(base64.b32decode(TOTP), struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    code = str((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000).zfill(6)
    app_session, app_headers = ok('app/merchant', 'auth/2fa/verify', data={'challengeToken': challenge['challengeToken'], 'twoFaCode': code})
    check('native merchant App keeps its existing token contract without browser cookies', 'sid' not in claims(app_session['token']) and not app_headers.get('Set-Cookie') and 'sessionExpiresAt' not in app_session)
    for key, value in [('jwt_expire_minutes', '4'), ('jwt_expire_minutes', '30.5'), ('jwt_refresh_days', '31')]:
        check('invalid policy rejected: ' + key + '=' + value, request('admin', 'sys/config/save', data={'configs': [{'key': key, 'value': value}]}, token=root['token'])[0]['code'] == 40002)
    secure, secure_headers = login('admin', headers={'X-Forwarded-Proto': 'https'})
    check('HTTPS sets Secure on the refresh cookie', '; Secure' in secure_headers['Set-Cookie'])
    ok('admin', 'sys/config/save', data={'configs': [{'key': 'jwt_expire_minutes', 'value': '45'}]}, token=root['token'])
    renewed, _ = refresh('admin', cookie_value(secure_headers))
    check('saved policy participates in the next token issuance', renewed['code'] == 0 and claims(renewed['data']['token'])['exp'] - claims(renewed['data']['token'])['iat'] == 2700)
    print('PASS_COUNT=' + str(len(RESULTS)), flush=True)
finally:
    for name in reversed(CONTAINERS):
        command(['docker', 'rm', '-f', name])
    assert re.fullmatch(r'mtrip_session_qa_[a-f0-9]{8}', SYSTEM)
    mysql(f"DROP DATABASE IF EXISTS `{BUSINESS}`; DROP DATABASE IF EXISTS `{SYSTEM}`; DROP USER IF EXISTS '{DBUSER}'@'%';")
    shutil.rmtree(QA)
