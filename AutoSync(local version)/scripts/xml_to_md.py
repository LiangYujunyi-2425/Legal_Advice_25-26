# HKeL\scripts\xml_to_md.py
# 用法：py -3 G:\HKeL\scripts\xml_to_md.py --in G:\HKeL\data\xml\zh-Hant --out G:\HKeL\data\md\zh-Hant --log G:\HKeL\logs\convert_zh-Hant.log --clean
import argparse, os, re, sys, xml.etree.ElementTree as ET, shutil
from datetime import datetime
from pathlib import Path

def log(msg, logf=None):
    line = f"{datetime.now().isoformat(timespec='seconds')} {msg}"
    print(line)
    if logf:
        os.makedirs(os.path.dirname(logf), exist_ok=True)
        with open(logf, 'a', encoding='utf-8') as f:
            f.write(line + '\n')

def strip_ns(tag):
    return tag.split('}',1)[1] if '}' in tag else tag

def text_content(elem):
    return ''.join(elem.itertext()).strip()

def gather_meta(root):
    meta = {}
    for m in root.findall('.//{*}meta//{*}property'):
        k = m.get('name') or m.get('ref') or strip_ns(m.tag)
        v = (m.text or '').strip()
        if k:
            meta[k] = v
    return meta

def heading_md(level, text):
    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        return ''
    level = max(1, min(level, 6))
    return ('#' * level) + ' ' + text + '\n\n'

def safe_clean_md(dirpath, logf=None):
    Path(dirpath).mkdir(parents=True, exist_ok=True)
    for name in os.listdir(dirpath):
        p = os.path.join(dirpath, name)
        if os.path.isfile(p) and p.lower().endswith('.md'):
            try:
                os.remove(p)
            except Exception as e:
                log(f'[!] 無法刪除 {p}: {e}', logf)

def convert_one(xml_path, out_dir, logf=None):
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        meta = gather_meta(root)

        fname = os.path.basename(xml_path)
        m = re.match(r'^(cap|a)_(.+?)_([0-9-]{14}|--------------)_(en|zh-Hant|zh-Hans)_(c|p)\.xml$', fname, re.I)
        cap_no = meta.get('CapNo') or (m.group(2) if m else '')
        lang = meta.get('lang') or (m.group(4) if m else '')
        point = meta.get('pointOfTime') or (m.group(5) if m else '')
        ver = meta.get('versionDate') or ((m.group(3) if m else '--------------'))
        chap_title = meta.get('ChapterTitle') or meta.get('CapTitle') or ''

        # Front matter（避免在 f-string 表達式中使用反斜線）
        front_matter_lines = []
        for k, v in {'cap_no': cap_no, 'chapter_title': chap_title, 'lang': lang, 'point_of_time': ('current' if point=='c' else 'past'), 'version': ('current' if ver=='--------------' else ver)}.items():
            s = str(v).replace('"', '\\"').replace('\n', '\\n')
            front_matter_lines.append('{}: "{}"'.format(k, s))
        front_matter = '---\n' + '\n'.join(front_matter_lines) + '\n---\n\n'

        body = []
        if chap_title:
            body.append(heading_md(1, f'{chap_title} (Cap. {cap_no})'))

        for elem in root.iter():
            tag = strip_ns(elem.tag).lower()
            if tag in ('part','division','subdivision','schedule'):
                title = elem.get('title') or elem.get('name') or ''
                if title:
                    level = {'part':2,'division':3,'subdivision':4,'schedule':2}[tag]
                    body.append(heading_md(level, title))
            elif tag in ('section','rule','regulation','article'):
                title = elem.get('title') or elem.get('name') or ''
                num = elem.get('num') or elem.get('number') or ''
                head = f'{num} {title}'.strip()
                if head:
                    body.append(heading_md(4, head))
            elif tag in ('heading',):
                head = text_content(elem)
                if head and head != chap_title:
                    body.append(heading_md(3, head))

        for xpath in ('.//{*}para', './/{*}p', './/{*}block', './/{*}content'):
            for e in root.findall(xpath):
                t = text_content(e)
                if t:
                    if not body or (t.strip() not in body[-1]):
                        body.append(t + '\n\n')

        md = front_matter + ''.join(body).strip() + '\n'
        out_name = 'cap_{}_{}_{}.md'.format(cap_no, ('current' if ('current' in front_matter) else ver), lang)
        Path(out_dir).mkdir(parents=True, exist_ok=True)
        out_path = os.path.join(out_dir, out_name)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(md)
        return out_path
    except Exception as e:
        log(f'[!] 轉檔失敗：{xml_path} -> {e}', logf)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='in_dir', required=True)
    ap.add_argument('--out', dest='out_dir', required=True)
    ap.add_argument('--log', help='log 檔路徑', default=None)
    ap.add_argument('--clean', action='store_true', help='先清空 out 目錄中的 .md')
    args = ap.parse_args()

    if args.clean:
        log(f'[*] 先清空舊的 MD：{args.out_dir}', args.log)
        safe_clean_md(args.out_dir, args.log)

    files = [os.path.join(args.in_dir, f) for f in os.listdir(args.in_dir) if f.lower().endswith('.xml')]
    log(f'[*] 待轉檔 XML：{len(files)} 筆', args.log)
    ok = 0
    for i, fp in enumerate(sorted(files), 1):
        outp = convert_one(fp, args.out_dir, args.log)
        if outp:
            ok += 1
            log(f'[✓] ({i}/{len(files)}) -> {outp}', args.log)
    log(f'完成。成功：{ok}，失敗：{len(files)-ok}', args.log)

if __name__ == '__main__':
    main()
