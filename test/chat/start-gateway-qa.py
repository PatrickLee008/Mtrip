#!/usr/bin/env python3
"""Exercise the actual gateway configuration against this task's isolated user services."""
import json
from pathlib import Path
import re
import subprocess
import sys

p = Path(sys.argv[1])
s = json.loads(p.read_text())
assert re.fullmatch(r'[a-f0-9]{8}', s['run'])
root = Path(__file__).resolve().parents[2]
qa = Path(s['qaDirectory'])
conf = (root / 'deploy/openresty/conf.d/mtrip.conf').read_text()
conf = conf.replace('server user-service:9502;', 'server ' + s['containers'][0] + ':9502;')
conf = conf.replace('server user-service-app:9502;', 'server ' + s['containers'][1] + ':9502;')
directory = qa / 'nginx'
directory.mkdir(exist_ok=True)
(directory / 'mtrip.conf').write_text(conf)
info = json.loads(subprocess.check_output(['docker', 'inspect', 'mtrip-gateway-1'], text=True))[0]
network = next(iter(info['NetworkSettings']['Networks']))
name = 'mtrip-chat-qa-' + s['run'] + '-gateway'
assert name not in s['containers']
subprocess.run(['docker', 'run', '-d', '--name', name, '--network', network, '-p', '127.0.0.1:19500:80', '-p', '127.0.0.1:19591:8091', '-p', '127.0.0.1:19593:8093', '-v', str(root / 'deploy/openresty/nginx.conf') + ':/usr/local/openresty/nginx/conf/nginx.conf:ro', '-v', str(directory) + ':/etc/nginx/conf.d:ro', info['Config']['Image']], check=True, stdout=subprocess.DEVNULL)
s['containers'].append(name)
p.write_text(json.dumps(s))
subprocess.run(['docker', 'exec', name, 'nginx', '-t'], check=True)
print('Isolated gateway ready on 19500/19591/19593; only user-service upstreams point to QA.')
