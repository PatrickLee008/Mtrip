# -*- coding: utf-8 -*-
import zipfile, re, sys, os

def extract(path, out):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    # paragraphs
    paras = re.split(r'</w:p>', xml)
    lines = []
    for p in paras:
        # table cell separator
        texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
        line = ''.join(texts).strip()
        if line:
            lines.append(line)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(out, len(lines), 'paragraphs')

base = r'd:\GIT\jiaxu\MTrip\设计文档'
outdir = r'd:\GIT\jiaxu\MTrip\_tmp_docs'
os.makedirs(outdir, exist_ok=True)
files = [
    ('Mtrip海外旅游项目完整版技术方案V1.docx', 'tech.txt'),
    ('Mtrip海外旅游平台管理后台完整功能设计文档_最终开发版.docx', 'admin_func.txt'),
    ('Mtrip海外旅游SaaS管理后台UI设计方案.docx', 'ui.txt'),
]
for src, dst in files:
    extract(os.path.join(base, src), os.path.join(outdir, dst))
