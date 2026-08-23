# -*- coding: utf-8 -*-
"""
从 Figma 导出 client-app 用到的位图素材(PNG @3x):
    - 首页快捷入口 4 个功能图标 → client-app/assets/images/home/
    - 顶部栏 mTrip 字标         → client-app/assets/images/logo.png

用法(在仓库根目录):二选一
    1) 环境变量:  set FIGMA_TOKEN=<personal access token>
    2) 本地文件:  在 .env.local 里写一行 FIGMA_TOKEN=<personal access token>(该文件已被 .gitignore 忽略)
    python scripts/figma-home-icons.py

素材来源:Figma M-Trip / Home,file key k6yJOiDvU0fqkmrHUGBfyT。
"""

import io
import json
import os
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

FILE_KEY = 'k6yJOiDvU0fqkmrHUGBfyT'
OUT_DIR = os.path.join('client-app', 'assets', 'images', 'home')
# 品牌资源(非首页专用),单独放 assets/images/
BRAND_DIR = os.path.join('client-app', 'assets', 'images')

# 顶部栏 mTrip 字标(Header - TopAppBar 里的 Rectangle 67,48x39 图片填充)
BRAND_NODES = {
    '452:2188': 'logo',
}

# 首页快捷入口:设计稿只显示这 4 个(其余入口所在容器带 visible=false,是隐藏稿)
NODES = {
    '81:2477': 'hotels',
    '81:2778': 'food',
    '412:2211': 'cars',
    '440:1513': 'package',
}

# 设计稿里被隐藏的其余入口,后续要放开时把对应项并进 NODES 即可:
#   '81:2776': 'bus', '81:2784': 'tours', '412:2217': 'flights',
#   '81:2794': 'parks', '81:2799': 'support'


def read_token():
    """优先取环境变量,其次取仓库根目录 .env.local 里的 FIGMA_TOKEN=xxx"""
    token = os.environ.get('FIGMA_TOKEN', '').strip()
    if token:
        return token
    if os.path.exists('.env.local'):
        with open('.env.local', encoding='utf-8') as fp:
            for line in fp:
                line = line.strip()
                if line.startswith('FIGMA_TOKEN='):
                    return line.split('=', 1)[1].strip().strip('"\'')
    return ''


def export(token, nodes, out_dir):
    """按 node id → 文件名映射批量导出 PNG@3x 到 out_dir"""
    os.makedirs(out_dir, exist_ok=True)
    url = 'https://api.figma.com/v1/images/%s?ids=%s&format=png&scale=3' % (
        FILE_KEY,
        ','.join(nodes),
    )
    req = urllib.request.Request(url, headers={'X-Figma-Token': token})
    data = json.load(urllib.request.urlopen(req, timeout=60))
    if data.get('err'):
        print('Figma 返回错误:', data['err'])
        return False

    for node_id, name in nodes.items():
        link = data.get('images', {}).get(node_id)
        if not link:
            print('未取到图片:', node_id, name)
            continue
        blob = urllib.request.urlopen(link, timeout=60).read()
        with open(os.path.join(out_dir, name + '.png'), 'wb') as fp:
            fp.write(blob)
        print('已保存', os.path.join(out_dir, name + '.png'), len(blob), 'bytes')
    return True


def main():
    token = read_token()
    if not token:
        print('缺少 FIGMA_TOKEN(环境变量或 .env.local 均未提供)')
        return 1

    if not export(token, NODES, OUT_DIR):
        return 1
    if not export(token, BRAND_NODES, BRAND_DIR):
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
