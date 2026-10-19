#!/usr/bin/env python3
"""Run after realtime-attachments.cjs and start-ui-qa.py on the same isolated fixtures."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

s = json.loads(Path(sys.argv[1]).read_text())
assert re.fullmatch(r'[a-f0-9]{8}', s['run'])
db = s['business']
assert db == 'mtrip_chat_qa_' + s['run']
passes = 0


def sql(query):
    return subprocess.run(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N --default-character-set=utf8mb4'], input=f'USE `{db}`; ' + query, text=True, check=True, capture_output=True).stdout.strip()


def request(route, data=None, token=None, port=19502):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/{route}', data=None if data is None else json.dumps(data).encode(), headers={'Authorization': 'Bearer ' + (token or s['owner']), 'Content-Type': 'application/json', 'X-Site-Id': '1'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def ok(*args, **kwargs):
    result = request(*args, **kwargs)
    assert result['code'] == 0, result
    return result['data']


def check(label, value):
    global passes
    assert value, label
    passes += 1
    print('PASS', label, flush=True)


c = s['conversationId']
order = s['orderConversationId']
old = ok('merchant/order/guest-thread?id=1', port=19504)
check('legacy order entry reuses the same booking thread', old['conversationId'] == order)
reply = ok('merchant/order/guest-message', {'id': 1, 'content': 'Reply through the existing order entry', 'clientMessageId': 'qa-old-entry-01'}, port=19504)
check('legacy order reply reaches consumer history', any(m['id'] == reply['messageId'] for m in ok(f'app/chat/messages?conversationId={order}&cursor=1', token=s['consumer'])['list']))
check('offline order reports unavailable messaging', request('merchant/order/guest-thread?id=3', port=19504)['code'] != 0)

target = s['secondConversationId']
sql(f"DELETE FROM chat_message WHERE conversation_id={target} AND sender_name='QA Guest' AND content LIKE 'History %';")
rows = ','.join(f"(1,{target},1,'user',1,'QA Guest','History {n}')" for n in range(215))
sql('INSERT INTO chat_message(site_id,conversation_id,sender_type,sender_role,sender_id,sender_name,content) VALUES ' + rows)
ids = []
before = 0
while True:
    page = ok(f'merchant/chat/messages?conversationId={target}&beforeId={before}')['list']
    if not page:
        break
    ids = [m['id'] for m in page] + ids
    before = page[0]['id']
check('cursor history retrieves all 215 messages once in order', len(ids) == 215 and ids == sorted(set(ids)))
tail = ok(f'app/chat/messages?conversationId={target}&cursor=1&afterId={ids[-6]}', token=s['consumer'])['list']
check('consumer reconnect cursor returns only missing messages', [m['id'] for m in tail] == ids[-5:])

with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda index: request('merchant/chat/receipt', {'conversationId': target, 'messageId': ids[-1-index], 'read': index % 2}), range(8)))
check('concurrent receipts all succeed without submit mutex errors', all(r['code'] == 0 for r in results))
receipt = next(r for r in ok(f'merchant/chat/messages?conversationId={target}')['receipts'] if r['actor_role'] == 'merchant')
check('concurrent read and delivery remain monotonic', receipt['delivered_id'] == ids[-1] and receipt['read_id'] == ids[-2])

prefs = ok('merchant/chat/preferences')
ok('merchant/chat/preferences', {'inappEnabled': 0, 'soundEnabled': 1})
check('personal notification preferences persist', ok('merchant/chat/preferences') == {'inapp_enabled': False, 'sound_enabled': True})
ok('merchant/chat/summary')
check('revoked employee assignment returns to unassigned queue', ok(f'merchant/chat/detail?conversationId={c}')['assignee_id'] == 0)
before_count = int(sql('SELECT COUNT(*) FROM merchant_notify WHERE recipient_id=1;'))
ok('app/chat/send', {'conversationId': c, 'content': 'Preference disabled', 'clientMessageId': 'qa-pref-disabled'}, token=s['consumer'])
check('disabled in-app preference suppresses personal notification', int(sql('SELECT COUNT(*) FROM merchant_notify WHERE recipient_id=1;')) == before_count)
ok('merchant/chat/preferences', {'inappEnabled': int(prefs['inapp_enabled']), 'soundEnabled': int(prefs['sound_enabled'])})
ok('app/chat/send', {'conversationId': c, 'content': 'Open this notification', 'clientMessageId': 'qa-notification-deep-link'}, token=s['consumer'])
notifications = ok('merchant/notifications/list', port=19506)['list']
notification = next(n for n in notifications if n['deep_link_type'] == 'guest_chat' and n['deep_link_value'] == str(c))
destination = ok('merchant/notifications/destination?id=' + str(notification['id']), port=19506)
check('merchant notification opens its authorized chat thread', destination == {'path': '/guest-messaging', 'query': {'conversationId': str(c)}})
unread = ok('merchant/chat/summary')['unread']
# Give the synthetic owner token its normal notifications-read permission.
env = dict(line.split('=', 1) for line in (Path(s['qaDirectory']) / 'env').read_text().splitlines() if '=' in line)
claims = json.loads(base64.urlsafe_b64decode(s['owner'].split('.')[1] + '=='))
claims['permissions'] += ['mch:notifications:read', 'mch:order:guest-contact']
encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')
raw = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode(claims)
owner = raw + '.' + base64.urlsafe_b64encode(hmac.new(env['MTRIP_JWT_SECRET'].encode(), raw.encode(), hashlib.sha256).digest()).decode().rstrip('=')
ok('merchant/notifications/read', {'id': notification['id']}, token=owner, port=19506)
check('reading notification does not clear chat unread', ok('merchant/chat/summary')['unread'] == unread)
check('other merchant cannot resolve chat notification deep link', request('merchant/notifications/destination?id=' + str(notification['id']), token=s['outsider'], port=19506)['code'] != 0)
audit_count = int(sql("SELECT COUNT(*) FROM chat_audit WHERE action='guest_contact_viewed';"))
check('scoped contact action returns only phone and writes audit', ok('merchant/chat/contact', {'conversationId': order}, token=owner) == {'phone': ''} and int(sql("SELECT COUNT(*) FROM chat_audit WHERE action='guest_contact_viewed';")) == audit_count + 1)

sql("UPDATE merchant_role SET status=1 WHERE id=90; INSERT IGNORE INTO merchant_employee_property(site_id,admin_id,property_id,created_at) VALUES(1,2,1,'2020-01-01');")
detail = ok(f'merchant/chat/detail?conversationId={order}', token=s['staff'])
check('chat role cannot read booking payment or guest contact', detail['booking'] is None and request('merchant/chat/contact', {'conversationId': order}, token=s['staff'])['code'] != 0)
sql("DELETE rm FROM merchant_role_menu rm JOIN merchant_menu m ON m.id=rm.menu_id WHERE rm.role_id=90 AND m.perm_key IN('mch:chat:reply','mch:chat:note');")
check('read-only employee keeps history but cannot reply or edit note', ok(f'merchant/chat/messages?conversationId={c}', token=s['staff'])['list'] and request('merchant/chat/send', {'conversationId': c, 'content': 'Denied', 'clientMessageId': 'qa-readonly-denied'}, token=s['staff'])['code'] != 0 and request('merchant/chat/note', {'conversationId': c, 'content': 'Denied', 'version': 2}, token=s['staff'])['code'] != 0)
sql('UPDATE merchant_role SET status=0 WHERE id=90;')
check('role revocation blocks stale JWT immediately', request(f'merchant/chat/detail?conversationId={c}', token=s['staff'])['code'] != 0)
check('more than five attachments rejected before persistence', request('app/chat/send', {'conversationId': c, 'content': 'Too many files', 'attachmentIds': [1,2,3,4,5,6], 'clientMessageId': 'qa-attachment-limit'}, token=s['consumer'])['code'] != 0)
for n in range(35):
    sql(f"INSERT INTO chat_conversation(site_id,user_id,type,property_id,title,last_time) VALUES(1,1,1,1,'Summary fixture {n}','2000-01-01'); SET @c=LAST_INSERT_ID(); INSERT INTO chat_message(site_id,conversation_id,sender_type,sender_role,sender_id,content) VALUES(1,@c,2,'merchant',1,'Summary fixture');")
all_unread = ok('app/chat/summary', token=s['consumer'])['unread']
first_page = ok('app/chat/conversations?type=1&page=1&pageSize=30', token=s['consumer'])
check('consumer badge includes unread beyond first 30 conversations', all_unread > sum(c['unread'] for c in first_page['list']))
check('consumer summary cannot see another account unread', ok('app/chat/summary', token=s['otherUser'])['unread'] == 0)
consumer_unread = all_unread
notice = next(n for n in ok('app/user/notify/list', token=s['consumer'])['list'] if n['biz_type'] == 4)
ok('app/user/notify/read', {'id': notice['id']}, token=s['consumer'])
check('consumer notification read also preserves chat unread', ok('app/chat/summary', token=s['consumer'])['unread'] == consumer_unread)
note_first = ok(f'merchant/chat/note-history?conversationId={c}&page=1&pageSize=1')
note_second = ok(f'merchant/chat/note-history?conversationId={c}&page=2&pageSize=1')
check('note history keeps full total on later pages', note_first['total'] >= 2 and note_second['total'] == note_first['total'])
check('note history pages preserve newest-first version order', note_first['list'][0]['version'] > note_second['list'][0]['version'])
print('PASS_COUNT=' + str(passes), flush=True)
