# HKeL\scripts\fetch_hkel.py
# 用法：py -3 G:\HKeL\scripts\fetch_hkel.py --lang zh-Hant --out G:\HKeL\data\xml\zh-Hant --list-url https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hant.json --log G:\HKeL\logs\fetch_zh-Hant.log --clean
import argparse, os, sys, json, hashlib, zipfile, re, urllib.request, shutil, time
from urllib.parse import urlparse
from datetime import datetime

DATASET_REFERER = 'https://data.gov.hk/en-data/dataset/hk-doj-hkel-list-of-legislation-current'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Python/3.9'

# zh-Hant 直接 ZIP（fallback 用）
ZH_HANT_ZIPS = [
    ('caps_1_300',     'https://resource.data.one.gov.hk/doj/data/hkel_c_leg_cap_1_cap_300_zh-Hant.zip'),
    ('caps_301_600',   'https://resource.data.one.gov.hk/doj/data/hkel_c_leg_cap_301_cap_600_zh-Hant.zip'),
    ('caps_601_end',   'https://resource.data.one.gov.hk/doj/data/hkel_c_leg_cap_601_cap_end_zh-Hant.zip'),
    ('instruments',    'https://resource.data.one.gov.hk/doj/data/hkel_c_instruments_zh-Hant.zip'),
]

def log(msg, logf=None):
    line = f'{datetime.now().isoformat(timespec="seconds")} {msg}'
    print(line)
    if logf:
        os.makedirs(os.path.dirname(logf), exist_ok=True)
        with open(logf, 'a', encoding='utf-8') as f:
            f.write(line + '\n')

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1<<20), b''):
            h.update(chunk)
    return h.hexdigest().lower()

def http_get(url, accept='*/*', referer=DATASET_REFERER, timeout=60):
    req = urllib.request.Request(url)
    req.add_header('User-Agent', UA)
    req.add_header('Accept', accept)
    if referer:
        req.add_header('Referer', referer)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def ensure_dir(p): os.makedirs(p, exist_ok=True)

def clean_filename(name): return re.sub(r'[^A-Za-z0-9._-]+', '_', name)

def safe_clean(dirpath, patterns=('.xml','.zip'), logf=None):
    if not os.path.isdir(dirpath):
        return
    for name in os.listdir(dirpath):
        p = os.path.join(dirpath, name)
        if os.path.isfile(p) and p.lower().endswith(patterns):
            try:
                os.remove(p)
            except Exception as e:
                log(f'[!] 無法刪除 {p}: {e}', logf)
        elif os.path.isdir(p):
            try:
                shutil.rmtree(p)
            except Exception:
                pass

def download_and_extract_zip(url, out_dir, logf=None):
    fn = clean_filename(os.path.basename(urlparse(url).path))
    local_path = os.path.join(out_dir, fn)
    log(f'[↓] 下載（ZIP）：{fn}', logf)
    blob = http_get(url, accept='application/zip')
    with open(local_path, 'wb') as f:
        f.write(blob)
    with zipfile.ZipFile(local_path, 'r') as z:
        for m in z.infolist():
            if m.filename.lower().endswith('.xml'):
                target = os.path.join(out_dir, os.path.basename(m.filename))
                with z.open(m, 'r') as zr, open(target, 'wb') as wf:
                    wf.write(zr.read())


def try_fetch_list_json(list_url, logf=None):
    # 嘗試抓取清單 JSON，加 UA/Referer 頭；403 時回傳 None
    try:
        raw = http_get(list_url, accept='application/json')
        return json.loads(raw.decode('utf-8'))
    except urllib.error.HTTPError as e:
        log(f'[!] 清單請求失敗：HTTP {e.code} {e.reason}', logf)
        if e.code == 403:
            return None
        raise


def iter_resources_from_listing(data):
    """將清單 JSON 中的下載資源（ZIP/XML URL）一一產出。
    相容以下結構：
    - 頂層含 DataSet -> DataResource
    - 舊式 Listing -> DataSet -> DataResource
    - DataResource 為 dict 或 string
    - DataResource 為單一物件或陣列
    產出 (url, sha256) tuple，若無 sha256 則為 ('', '')
    """
    if not isinstance(data, dict):
        return
    datasets = data.get('DataSet')
    if not datasets:
        datasets = data.get('Listing', {}).get('DataSet')
    if not datasets:
        return
    if isinstance(datasets, dict):
        datasets = [datasets]
    for ds in datasets:
        # ds 可能是字串（直接就是 URL）或 dict
        if isinstance(ds, str):
            yield ds, ''
            continue
        if not isinstance(ds, dict):
            continue
        items = ds.get('DataResource') or ds.get('dataResource')
        if not items:
            continue
        if isinstance(items, dict):
            items = [items]
        for res in items:
            if isinstance(res, str):
                yield res, ''
            elif isinstance(res, dict):
                url = res.get('url') or res.get('@url') or ''
                sha = (res.get('sha256') or res.get('@sha256') or '').lower()
                if url:
                    yield url, sha


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', required=True, choices=['en','zh-Hant','zh-Hans'])
    ap.add_argument('--out', required=True, help='輸出資料夾（XML 將解壓到此）')
    ap.add_argument('--list-url', required=True, help='法例清單 JSON 下載網址')
    ap.add_argument('--log', help='log 檔路徑', default=None)
    ap.add_argument('--clean', action='store_true', help='先清空 out 目錄中的 .xml/.zip')
    args = ap.parse_args()

    ensure_dir(args.out)
    if args.clean:
        log(f'[*] 先清空舊檔於：{args.out}', args.log)
        safe_clean(args.out, logf=args.log)

    log(f'[*] 嘗試下載法例清單: {args.list_url}', args.log)
    data = try_fetch_list_json(args.list_url, logf=args.log)

    resources = []
    if data is not None:
        for url, sha in iter_resources_from_listing(data):
            # 僅接受 .zip 或 .xml
            if isinstance(url, str) and (url.lower().endswith('.zip') or url.lower().endswith('.xml')):
                resources.append((url, sha))

    if not resources:
        # 解析不到任何資源 → 啟動後備 ZIP
        if args.lang != 'zh-Hant':
            log('[!] 清單解析結果為 0 且語言不是 zh-Hant，結束。', args.log)
            sys.exit(1)
        log('[*] 清單無資源，使用後備方案（直接下載 zh-Hant ZIP 分段包）', args.log)
        for key, url in ZH_HANT_ZIPS:
            try:
                download_and_extract_zip(url, args.out, logf=args.log)
                time.sleep(0.5)
            except Exception as e:
                log(f'[!] 後備 ZIP 下載失敗：{url} -> {e}', args.log)
        log('[✓] 後備方案完成（已解壓 XML）', args.log)
        return

    total_items = len(resources)
    updated = 0
    errors = 0

    for url, sha in resources:
        fn = clean_filename(os.path.basename(urlparse(url).path))
        local_path = os.path.join(args.out, fn)
        try:
            need_fetch = True
            if os.path.exists(local_path) and sha:
                local_sha = sha256_file(local_path)
                if local_sha == sha:
                    need_fetch = False
                    log(f'[=] 未變更（SHA 相同）：{fn}', args.log)

            if need_fetch:
                log(f'[↓] 下載：{fn}', args.log)
                blob = http_get(url)
                with open(local_path, 'wb') as f:
                    f.write(blob)
                updated += 1

            if local_path.lower().endswith('.zip'):
                with zipfile.ZipFile(local_path, 'r') as z:
                    for m in z.infolist():
                        if m.filename.lower().endswith('.xml'):
                            target = os.path.join(args.out, os.path.basename(m.filename))
                            with z.open(m, 'r') as zr, open(target, 'wb') as wf:
                                wf.write(zr.read())
        except Exception as e:
            errors += 1
            log(f'[!] 失敗：{url} -> {e}', args.log)

    log(f'完成。資源：{total_items}，下載/更新：{updated}，錯誤：{errors}', args.log)

if __name__ == '__main__':
    main()
