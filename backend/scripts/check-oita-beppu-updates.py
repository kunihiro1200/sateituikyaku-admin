"""
大分市・別府市 通学区域データの更新確認スクリプト

1. 大分市 CSV の Last-Modified ヘッダーを確認
2. 別府市 Excel の変更を確認（URL 変更にも対応）
3. 変更があれば新データをダウンロードして解析
4. 現行データとの差分を出力

⑦ データ鮮度管理: 取得元URL・取得日・公式データ日付を記録
⑥ 取得失敗時は既存データを維持し、エラーを stdout に出力
"""
import sys, os, json, re
import requests
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'src', 'data')
TMP_DIR  = os.path.join(SCRIPT_DIR, '..', 'tmp-update')
META_FILE = os.path.join(SCRIPT_DIR, 'school-data-metadata.json')
OITA_JSON = os.path.join(DATA_DIR, 'oita-beppu-school-address-map.json')

os.makedirs(TMP_DIR, exist_ok=True)

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def check_url_headers(url, timeout=15):
    """URL の Last-Modified・ETag・Content-Length を取得"""
    try:
        res = requests.head(url, timeout=timeout, allow_redirects=True)
        return {
            'status': res.status_code,
            'last_modified': res.headers.get('last-modified', ''),
            'etag': res.headers.get('etag', ''),
            'content_length': res.headers.get('content-length', ''),
        }
    except Exception as e:
        return {'error': str(e)}

def check_oita_csv(metadata):
    """大分市 CSV の更新確認"""
    csv_url = metadata['oita']['csv_url']
    prev_lm = metadata['oita'].get('last_modified_header', '')
    prev_et = metadata['oita'].get('etag', '')

    print(f"[Oita] CSV URL: {csv_url}")
    headers = check_url_headers(csv_url)

    if 'error' in headers:
        return {'changed': False, 'error': f"大分市 CSV 取得失敗: {headers['error']}"}

    if headers['status'] != 200:
        return {'changed': False, 'error': f"大分市 CSV HTTP {headers['status']}"}

    curr_lm = headers.get('last_modified', '')
    curr_et = headers.get('etag', '')

    print(f"[Oita] Last-Modified: {curr_lm} (prev: {prev_lm})")

    changed = (curr_lm and curr_lm != prev_lm) or (curr_et and curr_et != prev_et)
    return {
        'changed': changed,
        'last_modified': curr_lm,
        'etag': curr_et,
    }

def check_beppu_excel(metadata):
    """別府市 Excel の更新確認（URL 変更にも対応）"""
    excel_url = metadata['beppu']['excel_url']
    prev_lm = metadata['beppu'].get('last_modified_header', '')

    print(f"[Beppu] Excel URL: {excel_url}")
    headers = check_url_headers(excel_url)

    if 'error' in headers:
        # URL が変わった可能性あり → 代替 URL を試行
        # 別府市のパターン: tuugaku{N}.xlsx (N=2,3,4...)
        base = '/'.join(excel_url.split('/')[:-1])
        current_num = int(re.search(r'tuugaku(\d+)', excel_url).group(1))
        next_url = f"{base}/tuugaku{current_num + 1}.xlsx"

        print(f"[Beppu] 元の URL が失敗。代替を試行: {next_url}")
        headers2 = check_url_headers(next_url)
        if headers2.get('status') == 200:
            return {
                'changed': True,
                'new_url': next_url,
                'last_modified': headers2.get('last_modified', ''),
                'note': f'URL が変更されました: {excel_url} → {next_url}',
            }
        return {'changed': False, 'error': f"別府市 Excel 取得失敗: {headers['error']}（代替 URL も失敗）"}

    if headers['status'] != 200:
        return {'changed': False, 'error': f"別府市 Excel HTTP {headers['status']}"}

    curr_lm = headers.get('last_modified', '')
    changed = bool(curr_lm and curr_lm != prev_lm)
    print(f"[Beppu] Last-Modified: {curr_lm} (prev: {prev_lm})")
    return {
        'changed': changed,
        'last_modified': curr_lm,
    }

def main():
    try:
        metadata = load_json(META_FILE)
    except Exception as e:
        print(f"ERROR: メタデータ読み込み失敗: {e}")
        sys.exit(1)

    today = datetime.now().strftime('%Y-%m-%d')
    results = {
        'checked_at': today,
        'oita': {},
        'beppu': {},
        'has_changes': False,
        'errors': [],
    }

    # 大分市
    print("\n=== 大分市 CSV 確認 ===")
    oita_result = check_oita_csv(metadata)
    results['oita'] = oita_result
    if 'error' in oita_result:
        results['errors'].append(oita_result['error'])
        print(f"  ⚠️  {oita_result['error']}")
    elif oita_result['changed']:
        results['has_changes'] = True
        print(f"  📝 変更を検出")
    else:
        print(f"  ✅ 変更なし")

    # 別府市
    print("\n=== 別府市 Excel 確認 ===")
    beppu_result = check_beppu_excel(metadata)
    results['beppu'] = beppu_result
    if 'error' in beppu_result:
        results['errors'].append(beppu_result['error'])
        print(f"  ⚠️  {beppu_result['error']}")
    elif beppu_result.get('changed'):
        results['has_changes'] = True
        print(f"  📝 変更を検出")
        if beppu_result.get('new_url'):
            print(f"  ℹ️  {beppu_result['note']}")
    else:
        print(f"  ✅ 変更なし")

    # メタデータを更新（ヘッダー情報を保存）
    metadata['oita']['last_checked'] = today
    if oita_result.get('last_modified'):
        metadata['oita']['last_modified_header'] = oita_result['last_modified']
    if oita_result.get('etag'):
        metadata['oita']['etag'] = oita_result['etag']

    metadata['beppu']['last_checked'] = today
    if beppu_result.get('last_modified'):
        metadata['beppu']['last_modified_header'] = beppu_result['last_modified']
    if beppu_result.get('new_url'):
        metadata['beppu']['excel_url'] = beppu_result['new_url']
        metadata['beppu']['notes'] = f"URL 変更: {today}"

    save_json(META_FILE, metadata)

    # 結果を tmp-update に保存
    result_path = os.path.join(TMP_DIR, 'oita-beppu-check.json')
    save_json(result_path, results)
    print(f"\n結果保存: {result_path}")

    # GitHub Actions 出力
    gh_output = os.environ.get('GITHUB_OUTPUT', '')
    if gh_output:
        with open(gh_output, 'a') as f:
            f.write(f"oita_beppu_changed={'true' if results['has_changes'] else 'false'}\n")
            if results['errors']:
                f.write(f"oita_beppu_errors={'; '.join(results['errors'])}\n")

    print(f"\n=== 完了 ===")
    print(f"変更あり: {results['has_changes']}")
    print(f"エラー: {len(results['errors'])}件")

    # エラーがあっても終了コード 0（既存データを維持するため）
    # エラーはレポートに記録される

if __name__ == '__main__':
    main()
