#!/usr/bin/env python3
"""Remove only resources created by run-integration.py, after browser QA."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
p=Path(sys.argv[1])
s=json.loads(p.read_text())
assert re.fullmatch(r'[a-f0-9]{8}',s['run'])
assert s['business']=='mtrip_chat_qa_'+s['run']
assert s['system']==s['business']+'_system'
assert s['dbUser']=='chat_qa_'+s['run']
qa=Path(s['qaDirectory']).resolve()
assert qa==p.resolve().parent and qa.name.startswith('mtrip-chat-qa-')
assert qa.parent==Path(tempfile.gettempdir()).resolve()
for name in s['containers']:
    assert name.startswith('mtrip-chat-qa-'+s['run']+'-')
    subprocess.run(['docker','rm','-f',name],check=True)
script=f"DROP DATABASE `{s['business']}`; DROP DATABASE `{s['system']}`; DROP USER '{s['dbUser']}'@'%';"
subprocess.run(['docker','exec','-i','mtrip-mysql-1','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'],input=script,text=True,check=True)
shutil.rmtree(qa)
print('Removed isolated QA services, databases, DB user, private files and temporary credentials.')
