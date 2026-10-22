#!/usr/bin/env python3
"""Real HTTP/MySQL/Redis with a test-only Facebook transport; no provider credentials or real users.

Run: python3 test/facebook/integration.py. Temporary schemas/container are removed in finally.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import itertools
import json
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
BUSINESS = 'facebook_qa_' + RUN
SYSTEM = BUSINESS + '_system'
CONTAINER = 'mtrip-facebook-qa-' + RUN
ORIGIN = 'https://facebook-qa.example'
AES = 'facebook-qa-aes-' + RUN
PASSED = []
REDIS_KEYS = set()
IP_SEQUENCE = itertools.count(1)


def command(args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2500:] + result.stdout[-2500:])
    return result.stdout.strip()


def mysql(sql):
    return command(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'], sql)


def redis(*args):
    return command(['docker', 'exec', 'mtrip-redis-1', 'redis-cli', '-n', '14', *map(str, args)])


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    PASSED.append(label)
    print('PASS', label, flush=True)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


HTTP = urllib.request.build_opener(NoRedirect)


def request(path, data=None, cookie='', site=1, origin=ORIGIN, token=''):
    headers = {'Origin': origin, 'X-Site-Id': str(site), 'Content-Type': 'application/json',
               'X-Real-IP': '192.0.2.' + str(next(IP_SEQUENCE) % 254 + 1)}
    if cookie:
        headers['Cookie'] = cookie
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, None if data is None else json.dumps(data).encode(), headers)
    try:
        response = HTTP.open(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    body = response.read().decode()
    try:
        body = json.loads(body)
    except ValueError:
        pass
    return response.status, response.headers, body


def credential_key(kind, value):
    key = 'mtrip:facebook:' + kind + ':' + hashlib.sha256(value.encode()).hexdigest()
    REDIS_KEYS.add(key)
    return key


def start(site=1):
    status, headers, body = request('/api/v1/app/auth/facebook/start',
                                    dict(consentVersion='2026-10-21', returnTo='home'), site=site)
    if status != 200:
        raise AssertionError('start failed: ' + str(body))
    cookie = headers['Set-Cookie'].split(';')[0]
    url = urllib.parse.urlparse(body['data']['authorizationUrl'])
    params = urllib.parse.parse_qs(url.query)
    state = params['state'][0]
    credential_key('state', state)
    return state, cookie, params


def callback(state, cookie, code='100', error=''):
    return request('/api/v1/auth/facebook/callback?' + urllib.parse.urlencode(dict(state=state, code=code, error=error)), cookie=cookie)


def ticket(site=1, code='100'):
    state, cookie, _ = start(site)
    status, headers, body = callback(state, cookie, code)
    if status != 302 or '#ticket=' not in headers.get('Location', ''):
        raise AssertionError('callback failed: ' + str((status, dict(headers), body)))
    value = urllib.parse.parse_qs(urllib.parse.urlparse(headers['Location']).fragment)['ticket'][0]
    credential_key('ticket', value)
    return value, cookie


def exchange(value, cookie, site=1, origin=ORIGIN):
    return request('/api/v1/app/auth/facebook/exchange', dict(ticket=value), cookie, site, origin)[2]


def count_users():
    return int(mysql(f'SELECT COUNT(*) FROM `{BUSINESS}`.user_info;'))


try:
    password = secrets.token_hex(20)
    mysql(f'CREATE DATABASE `{BUSINESS}`; CREATE DATABASE `{SYSTEM}`; '
          f"CREATE USER '{BUSINESS}'@'%' IDENTIFIED BY '{password}'; "
          f"GRANT ALL ON `{BUSINESS}`.* TO '{BUSINESS}'@'%'; "
          f"GRANT ALL ON `{SYSTEM}`.* TO '{BUSINESS}'@'%';")
    for table in ['user_info', 'user_referral', 'user_member_level', 'user_action_log']:
        mysql(f'CREATE TABLE `{BUSINESS}`.{table} LIKE mtrip_business.{table};')
    for table in ['sys_site', 'sys_config', 'sys_sms_channel']:
        mysql(f'CREATE TABLE `{SYSTEM}`.{table} LIKE mtrip_system.{table};')
    mysql(f"INSERT INTO `{SYSTEM}`.sys_site(id,site_name) VALUES(1,'QA One'),(2,'QA Two');")
    migration = (ROOT / 'database/migrations/V20261021010000__add-facebook-user-identities.sql').read_text()
    migration = migration.replace('`mtrip_business`', '`' + BUSINESS + '`')
    # Ambiguous phone records must abort before changing nullable semantics.
    mysql(f"ALTER TABLE `{BUSINESS}`.user_info MODIFY mobile_hash CHAR(64) NOT NULL DEFAULT ''; "
          f"INSERT INTO `{BUSINESS}`.user_info(mobile,mobile_hash) VALUES('ambiguous','');")
    try:
        mysql(migration)
    except RuntimeError as error:
        check('migration refuses ambiguous phone/hash data', 'Audit required' in str(error))
    else:
        raise AssertionError('ambiguous migration unexpectedly succeeded')
    mysql(f'DELETE FROM `{BUSINESS}`.user_info; '
          f"INSERT INTO `{BUSINESS}`.user_info(site_id,mobile,mobile_hash) VALUES(9,'','');")
    mysql(migration)
    check('migration converts only a genuinely unbound hash', mysql(f'SELECT mobile_hash IS NULL FROM `{BUSINESS}`.user_info;') == '1')
    mysql(migration)
    check('migration can safely rerun', mysql(f'SELECT COUNT(*) FROM `{BUSINESS}`.user_social_identity;') == '0')
    mysql(f'DELETE FROM `{BUSINESS}`.user_info;')
    info = json.loads(command(['docker', 'inspect', 'mtrip-user-service-1']))[0]
    env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    # Override every Facebook setting: the QA container never receives the user's Meta secret.
    env.update(DB_BUSINESS_DATABASE=BUSINESS, DB_SYSTEM_DATABASE=SYSTEM, DB_USERNAME=BUSINESS,
               DB_PASSWORD=password, MTRIP_JWT_SECRET=secrets.token_hex(24), MTRIP_AES_KEY=AES,
               SCAN_CACHEABLE='false', WORKER_NUM='4', REDIS_DB='14', MTRIP_CLIENT_SIGN='false',
               MTRIP_PAYLOAD_ENCRYPT='false', MTRIP_SUBMIT_LOCK='true', MTRIP_REQUEST_LOG='true',
               MTRIP_FACEBOOK_ENABLED='true', MTRIP_FACEBOOK_APP_ID='123', MTRIP_FACEBOOK_APP_SECRET='qa-only',
               MTRIP_FACEBOOK_WEB_ORIGINS=ORIGIN, MTRIP_FACEBOOK_GRAPH_VERSION='v24.0',
               MTRIP_FACEBOOK_TERMS_URL=ORIGIN + '/terms', MTRIP_FACEBOOK_PRIVACY_URL=ORIGIN + '/privacy',
               MTRIP_FACEBOOK_CONSENT_VERSION='2026-10-21')
    with tempfile.TemporaryDirectory(prefix='mtrip-facebook-qa-') as directory:
        temp = Path(directory)
        envfile = temp / 'env'
        envfile.write_text('\n'.join(key + '=' + value for key, value in env.items()) + '\n')
        envfile.chmod(0o600)
        shutil.copytree(ROOT / 'backend/services/user-service/app', temp / 'app')
        shutil.copytree(ROOT / 'backend/services/user-service/config', temp / 'config')
        (temp / 'app/Service/FacebookQaClient.php').write_text('''<?php
namespace App\\Service;
class FacebookQaClient extends FacebookClient {
    public function identity(string $code, string $redirectUri): array {
        if (!preg_match('/^\\d+$/D', $code)) throw new \\Mtrip\\Shared\\Exception\\BusinessException(40001, 'QA rejected');
        return ['id' => $code, 'name' => $code === '200' ? '' : 'QA Facebook'];
    }
}
''')
        (temp / 'config/autoload/dependencies.php').write_text('<?php return [App\\Service\\FacebookClient::class => App\\Service\\FacebookQaClient::class];')
        args = ['docker', 'run', '-d', '--name', CONTAINER, '--network', next(iter(info['NetworkSettings']['Networks'])),
                '--env-file', str(envfile), '-p', '127.0.0.1::9502']
        for source, dest in [(ROOT / 'backend/shared/src', '/shared/src'),
                             (temp / 'app', '/opt/www/app'), (temp / 'config', '/opt/www/config')]:
            args += ['-v', str(source) + ':' + dest + ':ro']
        command(args + [info['Config']['Image']])
        BASE = 'http://' + command(['docker', 'port', CONTAINER, '9502/tcp'])
        for attempt in range(60):
            try:
                urllib.request.urlopen(BASE + '/healthz', timeout=1)
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError('QA service failed to start: ' + command(['docker', 'logs', CONTAINER])[-2000:])

        check('settings returns policy URLs and consent version', request('/api/v1/app/auth/facebook/settings', {})[2]['data']['consentVersion'] == '2026-10-21')
        for origin in ['http://facebook-qa.example', 'https://evil.example', ORIGIN + '/', 'null', '']:
            check('unapproved origin refused: ' + repr(origin), request('/api/v1/app/auth/facebook/start', dict(consentVersion='2026-10-21'), origin=origin)[2]['code'] == 40001)
        check('consent version is required', request('/api/v1/app/auth/facebook/start', {})[2]['code'] == 40001)
        check('external return destination refused', request('/api/v1/app/auth/facebook/start', dict(consentVersion='2026-10-21', returnTo='https://evil.example'))[2]['code'] == 40001)
        check('unknown site refused', request('/api/v1/app/auth/facebook/start', dict(consentVersion='2026-10-21'), site=999)[2]['code'] == 40001)
        state, cookie, params = start()
        _, headers, extra = request('/api/v1/app/auth/facebook/start', dict(consentVersion='2026-10-21'))
        credential_key('state', urllib.parse.parse_qs(urllib.parse.urlparse(extra['data']['authorizationUrl']).query)['state'][0])
        check('browser cookie is host-only Secure HttpOnly SameSite Lax', all(part in headers['Set-Cookie'] for part in ['__Host-mtrip_fb=', 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax']) and 'Domain=' not in headers['Set-Cookie'])
        check('exact same-origin callback and minimal scope', params['redirect_uri'] == [ORIGIN + '/api/v1/auth/facebook/callback'] and params['scope'] == ['public_profile'])
        check('authorization state has ten minute TTL', 590 <= int(redis('TTL', credential_key('state', state))) <= 600)
        check('wrong browser cannot consume state', callback(state, '__Host-mtrip_fb=' + '0' * 64)[0] == 400)
        check('correct browser can still cancel after rejected attack', callback(state, cookie, error='access_denied')[1]['Location'].endswith('#error=cancelled'))
        check('state cannot be replayed', callback(state, cookie)[0] == 400)
        check('cancelled authorization creates no users', count_users() == 0)
        state, cookie, _ = start()
        check('provider failure returns safe error', callback(state, cookie, code='invalid')[1]['Location'].endswith('#error=failed'))
        check('provider failure creates no users', count_users() == 0)
        state, cookie, _ = start()
        redis('DEL', credential_key('state', state))
        check('expired state rejected', callback(state, cookie)[0] == 400)

        value, cookie = ticket()
        check('ticket TTL is one minute', 50 <= int(redis('TTL', credential_key('ticket', value))) <= 60)
        check('wrong browser cannot exchange', exchange(value, '__Host-mtrip_fb=' + '0' * 64)['code'] == 40001)
        check('wrong site cannot exchange', exchange(value, cookie, site=2)['code'] == 40001)
        check('wrong origin cannot exchange', exchange(value, cookie, origin='https://evil.example')['code'] == 40001)
        result = exchange(value, cookie)
        check('valid exchange creates usable Mtrip session', result['code'] == 0 and request('/api/v1/app/user/me', token=result['data']['token'])[2]['code'] == 0)
        uid = result['data']['user']['id']
        check('new account has no fabricated phone or password', result['data']['user']['mobile'] == '' and result['data']['user']['hasPassword'] is False and result['data']['user']['mobileBound'] is False)
        check('first login reports new user', result['data']['isNewUser'] is True)
        check('consent recorded and referral code initialized', mysql(f'SELECT consent_version FROM `{BUSINESS}`.user_social_identity WHERE user_id={uid};') == '2026-10-21' and mysql(f'SELECT referral_code FROM `{BUSINESS}`.user_info WHERE id={uid};').startswith('MT'))
        check('ticket is single use', exchange(value, cookie)['code'] == 40001)
        value, cookie = ticket()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: exchange(value, cookie), range(2)))
        check('concurrent exchanges consume a ticket exactly once', sorted(x['code'] for x in results) == [0, 40001])
        mysql(f"UPDATE `{BUSINESS}`.user_info SET nickname='User edited' WHERE id={uid};")
        value, cookie = ticket()
        result = exchange(value, cookie)
        check('repeat login uses same account without overwriting nickname', result['data']['user']['id'] == uid and result['data']['user']['nickname'] == 'User edited' and result['data']['isNewUser'] is False)
        value, cookie = ticket(code='200')
        second = exchange(value, cookie)
        check('second phone-less identity and missing provider name supported', second['code'] == 0 and second['data']['user']['id'] != uid and second['data']['user']['nickname'] == 'Facebook User')
        value, cookie = ticket(site=2)
        check('same provider identity is isolated by site', exchange(value, cookie, site=2)['data']['user']['id'] != uid)
        value, cookie = ticket(code='300')
        redis('DEL', credential_key('ticket', value))
        check('expired login ticket rejected', exchange(value, cookie)['code'] == 40001)

        sessions = [start()[:2] for _ in range(2)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda pair: callback(*pair, code='400'), sessions))
        check('concurrent first authorizations both finish', all(x[0] == 302 and '#ticket=' in x[1]['Location'] for x in results))
        for _, headers, _ in results:
            credential_key('ticket', urllib.parse.parse_qs(urllib.parse.urlparse(headers['Location']).fragment)['ticket'][0])
        check('concurrent identity creates one account and no orphan', mysql(f"SELECT COUNT(*) FROM `{BUSINESS}`.user_social_identity WHERE provider_user_id='400';") == '1' and count_users() == 5)

        for status in [2, 3]:
            mysql(f'UPDATE `{BUSINESS}`.user_info SET user_status={status} WHERE id={uid};')
            state, cookie, _ = start()
            check('restricted account rejected: ' + str(status), callback(state, cookie)[1]['Location'].endswith('#error=restricted'))
        mysql(f'UPDATE `{BUSINESS}`.user_info SET user_status=1 WHERE id={uid};')
        value, cookie = ticket()
        mysql(f'UPDATE `{BUSINESS}`.user_info SET user_status=2 WHERE id={uid};')
        check('status rechecked when ticket exchanged', exchange(value, cookie)['code'] == 40301)
        mysql(f'UPDATE `{BUSINESS}`.user_info SET user_status=1, deleted_at=NOW() WHERE id={uid};')
        before = count_users()
        state, cookie, _ = start()
        check('deleted identity cannot recreate account', callback(state, cookie)[1]['Location'].endswith('#error=restricted') and count_users() == before)

        mysql(f"CREATE TRIGGER `{BUSINESS}`.qa_identity_fail BEFORE INSERT ON `{BUSINESS}`.user_social_identity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA rollback';")
        state, cookie, _ = start()
        check('identity insert failure returns safe error', callback(state, cookie, code='500')[1]['Location'].endswith('#error=failed'))
        check('identity insert failure rolls back provisional user', count_users() == before)
        mysql(f'DROP TRIGGER `{BUSINESS}`.qa_identity_fail;')

        registered = request('/api/v1/app/auth/register', dict(mobile='09912345678', password='QaPass123'))[2]
        check('phone registration still works', registered['code'] == 0 and registered['data']['user']['mobileBound'] is True)
        check('phone password login still works', request('/api/v1/app/auth/login', dict(mobile='09912345678', password='QaPass123'))[2]['code'] == 0)
        check('phone uniqueness retained', request('/api/v1/app/auth/register', dict(mobile='09912345678', password='QaPass123'))[2]['code'] == 40901)
        for scene, path in [('login', 'login-by-sms'), ('reset', 'reset-password')]:
            sms = secrets.token_hex(24)
            key = 'mtrip:otp:ticket:' + sms
            REDIS_KEYS.add(key)
            redis('SETEX', key, 600, json.dumps(dict(siteId=1, scene=scene, mobileHash=hmac.new(AES.encode(), b'09912345678', hashlib.sha256).hexdigest())))
            payload = dict(mobile='09912345678', verifyToken=sms, password='NewPass123')
            check('existing SMS ticket flow still works: ' + scene, request('/api/v1/app/auth/' + path, payload)[2]['code'] == 0)
        check('reset password is effective', request('/api/v1/app/auth/login', dict(mobile='09912345678', password='NewPass123'))[2]['code'] == 0)

        logs = command(['docker', 'exec', CONTAINER, 'sh', '-c', 'cat runtime/logs/request*.log'])
        check('authentication logs redact callback and ticket values', value not in logs and state not in logs and 'protected authentication params' in logs)
        print('PASS_COUNT=' + str(len(PASSED)), flush=True)
finally:
    subprocess.run(['docker', 'rm', '-f', CONTAINER], capture_output=True)
    for key in REDIS_KEYS:
        redis('DEL', key)
    mysql(f'DROP DATABASE IF EXISTS `{BUSINESS}`; DROP DATABASE IF EXISTS `{SYSTEM}`; '
          f"DROP USER IF EXISTS '{BUSINESS}'@'%';")
