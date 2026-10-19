#!/usr/bin/env python3
"""Property operating status must not revoke an employee's chat authorization."""
import json
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

s = json.loads(Path(sys.argv[1]).read_text())
passes = 0


def sql(query):
    subprocess.run(['docker', 'exec', '-i', 'mtrip-mysql-1', 'sh', '-c',
                    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 -N'],
                   input=f"USE `{s['business']}`; {query}", text=True, capture_output=True, check=True)


def request(path, actor='owner', data=None, property_id=1):
    headers = {'Content-Type': 'application/json', 'X-Site-Id': '1',
               'Authorization': 'Bearer ' + s[actor], 'X-Mtrip-Property-Id': str(property_id)}
    req = urllib.request.Request('http://127.0.0.1:19502/api/v1/' + path,
                                 data=None if data is None else json.dumps(data).encode(), headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=12)
    except urllib.error.HTTPError as error:
        response = error
    return json.loads(response.read())


def check(label, condition):
    global passes
    assert condition, label
    passes += 1
    print('PASS', label, flush=True)


c = s['conversationId']
try:
    sql('UPDATE merchant_store SET status=2, operating_status=2 WHERE id=1;')
    listing = request('merchant/chat/list')
    check('owner can list history of selected closed property',
          listing['code'] == 0 and listing['data']['total'] >= 3)
    check('authorized employee can read closed property history',
          request(f'merchant/chat/messages?conversationId={c}', 'staff')['code'] == 0)
    check('closed property permits unread summary and preferences',
          request('merchant/chat/summary')['code'] == 0 and request('merchant/chat/preferences')['code'] == 0)
    check('closed property permits connection ticket', request('merchant/chat/ticket', data={})['code'] == 0)
    check('authorized employee can reply to existing closed property thread',
          request('merchant/chat/send', 'staff', {'conversationId': c, 'content': 'Existing booking support',
                                                'clientMessageId': 'qa-closed-property-reply'})['code'] == 0)
    check('closed property still rejects another merchant',
          request(f'merchant/chat/detail?conversationId={c}', 'outsider')['code'] == 40302)
    check('employee still cannot select unassigned property',
          request('merchant/chat/summary', 'staff', property_id=3)['code'] == 40302)
    check('closed property still blocks new consumer consultation',
          request('app/chat/start', 'consumer', {'type': 1, 'propertyId': 1})['code'] == 40901)
    sql('UPDATE merchant_store SET deleted_at=NOW() WHERE id=1;')
    check('deleted property remains inaccessible', request('merchant/chat/summary')['code'] == 40302)
finally:
    sql('UPDATE merchant_store SET status=1, operating_status=1, deleted_at=NULL WHERE id=1;')

print('PASS_COUNT=' + str(passes), flush=True)
