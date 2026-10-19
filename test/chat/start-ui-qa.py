#!/usr/bin/env python3
"""Extend an isolated integration session with real merchant/order services for browser QA."""
import json
from pathlib import Path
import re
import subprocess
import sys
s=json.loads(Path(sys.argv[1]).read_text()); assert re.fullmatch(r'[a-f0-9]{8}',s['run'])
root=Path(__file__).resolve().parents[2]; qa=Path(s['qaDirectory'])
def run(args,data=None):
 return subprocess.run(args,input=data,text=True,check=True,stdout=subprocess.PIPE).stdout.strip()
info=json.loads(run(['docker','inspect',s['containers'][0]]))[0]; network=next(iter(info['NetworkSettings']['Networks']))
for kind,port in [('merchant',19506),('order',19504)]:
 original=json.loads(run(['docker','inspect','mtrip-'+kind+'-service-1']))[0]
 name='mtrip-chat-qa-'+s['run']+'-'+kind
 if name not in s['containers']:
  run(['docker','run','-d','--name',name,'--network',network,'--env-file',str(qa/'env'),'-e','HTTP_PORT=9502','-p',f'127.0.0.1:{port}:9502','-v',str(root/'backend/shared/src')+':/shared/src:ro','-v',str(root/f'backend/services/{kind}-service/app')+':/opt/www/app:ro','-v',str(root/f'backend/services/{kind}-service/config')+':/opt/www/config:ro',original['Config']['Image']])
  s['containers'].append(name)
  Path(sys.argv[1]).write_text(json.dumps(s))
encoded=run(['docker','exec',s['containers'][0],'php','-r', '''require '/opt/www/vendor/autoload.php'; echo json_encode(['password'=>password_hash('Chat-QA-Only-2026!',PASSWORD_BCRYPT),'secret'=>Mtrip\\Shared\\Support\\CryptoHelper::encrypt('JBSWY3DPEHPK3PXP',getenv('MTRIP_AES_KEY'))]);'''])
a=json.loads(encoded)
sql=f"USE `{s['business']}`; UPDATE merchant_admin SET password='{a['password']}',two_fa_status=1,two_fa_method='google_authenticator',two_fa_secret_enc='{a['secret']}' WHERE id=1; UPDATE merchant_info SET access_code='CHATQA' WHERE id=1;"
run(['docker','exec','-i','mtrip-mysql-1','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'],sql)
print('Isolated merchant/order services ready on 19506/19504. QA access code CHATQA; use test TOTP secret from this script.')
