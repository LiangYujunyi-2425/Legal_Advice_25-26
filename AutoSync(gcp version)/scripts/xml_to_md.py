# HKeL\scripts\xml_to_md.py
# 用法（落地＋上傳）：
#   py -3 G:\HKeL\scripts\xml_to_md.py ^
#     --in  G:\HKeL\data\xml\zh-Hant ^
#     --out G:\HKeL\data\md\zh-Hant ^
#     --log G:\HKeL\logs\convert_zh-Hant.log ^
#     --gcs-bucket autobucket1718 ^
#     --gcs-prefix md/zh-Hant/ ^
#     --gcs-delete-existing
#
# 若要「只上傳不落地」，再加上： --no-local-md
#
# 需要：pip install google-cloud-storage
# 建議用 Application Default Credentials（ADC）：
#   gcloud auth application-default login
#   gcloud auth application-default set-quota-project <YOUR_PROJECT_ID>

import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# Google Cloud Storage（可選）
GCS_AVAILABLE = False
try:
    from google.cloud import storage
    GCS_AVAILABLE = True
except Exception:
    pass


def log(msg, logf=None):
    line = f"{datetime.now().isoformat(timespec='seconds')} {msg}"
    print(line)
    if logf:
        os.makedirs(os.path.dirname(logf), exist_ok=True)
        with open(logf, 'a', encoding='utf-8') as f:
            f.write(line + '\n')


def strip_ns(tag):
    return tag.split('}', 1)[1] if '}' in tag else tag


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


def build_markdown(xml_path, logf=None):
    """將單一 XML 轉為 Markdown 字串，並回傳 (out_name, md_text)"""
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

    fm = {
        'cap_no': cap_no,
        'chapter_title': chap_title,
        'lang': lang,
        'point_of_time': 'current' if point == 'c' else 'past',
        'version': 'current' if ver == '--------------' else ver
    }
    front_matter_lines = []
    for k, v in fm.items():
        s = str(v).replace('"', '\\"').replace('\n', '\\n')
        front_matter_lines.append(f'{k}: "{s}"')
    front_matter = '---\n' + '\n'.join(front_matter_lines) + '\n---\n\n'

    body = []
    if chap_title:
        body.append(heading_md(1, f'{chap_title} (Cap. {cap_no})'))

    for elem in root.iter():
        tag = strip_ns(elem.tag).lower()
        if tag in ('part', 'division', 'subdivision', 'schedule'):
            title = elem.get('title') or elem.get('name') or ''
            if title:
                level = {'part': 2, 'division': 3, 'subdivision': 4, 'schedule': 2}[tag]
                body.append(heading_md(level, title))
        elif tag in ('section', 'rule', 'regulation', 'article'):
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
    out_name = f'cap_{cap_no}_{"current" if fm["version"] == "current" else fm["version"]}_{lang}.md'
    return out_name, md


def delete_gcs_prefix_md(bucket, prefix, logf=None):
    """僅刪除指定 prefix 下的 .md 物件（避免誤刪其他檔）。"""
    count = 0
    for blob in bucket.list_blobs(prefix=prefix):
        if blob.name.lower().endswith('.md'):
            try:
                blob.delete()
                count += 1
            except Exception as e:
                log(f'[!] 刪除 {blob.name} 失敗：{e}', logf)
    log(f'[*] 已清除雲端現有 .md：{count} 檔', logf)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='in_dir', required=True)
    ap.add_argument('--out', dest='out_dir', default=None, help='如未加 --no-local-md 時，寫出 MD 的資料夾')
    ap.add_argument('--log', default=None)
    ap.add_argument('--clean', action='store_true', help='先清空 out 目錄中的 .md（僅本地）')

    # GCS 相關
    ap.add_argument('--gcs-bucket', help='要上傳的目標 Bucket 名稱')
    ap.add_argument('--gcs-prefix', default='', help='物件名稱前綴（例如 md/zh-Hant/）')
    ap.add_argument('--gcs-delete-existing', action='store_true', help='上傳前刪除該 prefix 內既有 .md（請謹慎）')
    ap.add_argument('--no-local-md', action='store_true', help='不在本地寫出 .md，只上傳至 GCS')

    args = ap.parse_args()

    # 啟用 GCS（若有指定 bucket）
    gcs_bucket = None
    if args.gcs_bucket:
        if not GCS_AVAILABLE:
            log('[!] 未安裝 google-cloud-storage，請先 pip install google-cloud-storage', args.log)
            sys.exit(1)
        # 使用 ADC：會自動讀取 gcloud auth application-default login 建立的憑證檔
        gcs_client = storage.Client()
        gcs_bucket = gcs_client.bucket(args.gcs_bucket)
        if args.gcs_delete_existing:
            delete_gcs_prefix_md(gcs_bucket, args.gcs_prefix, args.log)

    # 本地清理（如需要）
    if (not args.no_local_md) and args.out_dir:
        if args.clean:
            log(f'[*] 先清空舊的 MD：{args.out_dir}', args.log)
            safe_clean_md(args.out_dir, args.log)
        Path(args.out_dir).mkdir(parents=True, exist_ok=True)

    files = [os.path.join(args.in_dir, f) for f in os.listdir(args.in_dir) if f.lower().endswith('.xml')]
    log(f'[*] 待轉檔 XML：{len(files)} 筆', args.log)

    ok = 0
    for i, fp in enumerate(sorted(files), 1):
        try:
            out_name, md_text = build_markdown(fp, args.log)

            # 上傳到 GCS（如指定）
            if gcs_bucket:
                blob = gcs_bucket.blob((args.gcs_prefix or '') + out_name)
                blob.upload_from_string(md_text, content_type='text/markdown; charset=utf-8')
                log(f'[☁] ({i}/{len(files)}) -> gs://{args.gcs_bucket}/{(args.gcs_prefix or "") + out_name}', args.log)

            # 寫本地（除非 --no-local-md）
            if (not args.no_local_md) and args.out_dir:
                out_path = os.path.join(args.out_dir, out_name)
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(md_text)

            ok += 1
        except Exception as e:
            log(f'[!] 轉檔/上傳失敗：{fp} -> {e}', args.log)

    log(f'完成。成功：{ok}，失敗：{len(files)-ok}', args.log)


if __name__ == '__main__':
    main()
