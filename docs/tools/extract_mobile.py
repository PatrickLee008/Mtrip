# -*- coding: utf-8 -*-
import zipfile, re, os

def extract(path, out):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    paras = re.split(r'</w:p>', xml)
    lines = []
    for p in paras:
        texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
        line = ''.join(texts).strip()
        if line:
            lines.append(line)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(out, len(lines), 'paragraphs')

base = r'd:\GIT\jiaxu\MTrip\设计文档'
outdir = r'd:\GIT\jiaxu\MTrip\docs\reference'
extract(os.path.join(base, 'Mtrip海外旅游平台-移动端前端框架设计方案.docx'),
        os.path.join(outdir, '移动端前端框架设计方案_提取文本.txt'))
