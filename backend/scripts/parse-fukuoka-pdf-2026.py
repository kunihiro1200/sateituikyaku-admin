"""
福岡市 R8（2026年4月1日）通学区域PDF 完全パーサー
PyMuPDF を使用して列構造を読み取り、JSONに変換する

列構造（学校別PDF）:
  x <  100: 小学校名
  x < 200:  中学校名
  x < 265:  町名
  x >= 265: 区域

区名は x >= 500 の右端ヘッダーに出現
"""
import sys, os, json, re
import fitz  # PyMuPDF

# 列 x 座標しきい値（学校別PDFのレイアウト）
COL_ELEM  = (0,   100)  # 小学校名
COL_JH    = (100, 200)  # 中学校名
COL_TOWN  = (200, 265)  # 町名
COL_RANGE = (265, 9999) # 区域
COL_WARD  = (500, 9999) # 区名（右端）

WARDS = ['東区', '西区', '南区', '北区', '博多区', '中央区', '城南区', '早良区']

def col_type(x):
    if x >= 500:
        return 'ward_header'
    if x < 100:
        return 'elem'
    if x < 200:
        return 'jh'
    if x < 265:
        return 'town'
    return 'range'

def is_ward(text):
    return any(text.strip().startswith(w) for w in WARDS)

def extract_page_items(page):
    """ページから (y, x, text, col_type) のリストを取得"""
    items = []
    page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            text = ''.join(s["text"] for s in spans).strip()
            if not text:
                continue
            x0 = round(line["bbox"][0])
            y0 = round(line["bbox"][1])
            items.append((y0, x0, text))
    items.sort()
    return items

def parse_gakkoubetsu(pdf_path):
    """学校別PDF → DistrictRecord のリストを返す"""
    doc = fitz.open(pdf_path)
    records = []
    
    current_ward = ''
    current_elem = ''
    current_jh   = ''
    current_town = ''
    current_range_parts = []
    
    def flush_record():
        """現在のレコードをリストに追加"""
        if current_elem and current_town:
            # 区域を結合
            range_text = ''.join(current_range_parts).strip()
            # town に範囲が混入している場合を分離
            town, rng = split_town_range(current_town, range_text)
            records.append({
                'ward': current_ward,
                'town': town,
                'range': rng if rng else range_text,
                'elementary': current_elem,
                'juniorHigh': current_jh,
                'note': '',
            })
    
    for page_num in range(doc.page_count):
        if page_num == 0:  # 表紙スキップ
            continue
        
        page = doc[page_num]
        items = extract_page_items(page)
        
        # 前のページの続きの可能性を考慮して町名行を先に収集
        for y, x, text in items:
            ctype = col_type(x)
            
            if ctype == 'ward_header' and is_ward(text):
                # 区名更新（右側ヘッダー）
                current_ward = next((w for w in WARDS if text.startswith(w)), text.strip())
                continue
            
            if text in ['小学校', '中学校', '町名', '区域', '学校別通学区域一覧表']:
                continue  # ヘッダー行スキップ
            
            if ctype == 'elem':
                # 新しい小学校 → 前の町レコードを確定
                flush_record()
                current_elem = text
                current_town = ''
                current_range_parts = []
                # JHは変更しない（同じJH下に複数の小学校）
            
            elif ctype == 'jh':
                # 中学校変更
                current_jh = text
            
            elif ctype == 'town':
                # 新しい町名行 → 前の町レコードを確定
                flush_record()
                current_town = text
                current_range_parts = []
            
            elif ctype == 'range':
                # 区域テキスト（複数行になる場合あり）
                if current_range_parts and not current_range_parts[-1].endswith('\n'):
                    # 改行区切り
                    current_range_parts.append(text)
                else:
                    current_range_parts.append(text)
        
        # ページ末尾の未確定レコード
        flush_record()
        current_town = ''
        current_range_parts = []
    
    flush_record()
    doc.close()
    return records

def split_town_range(town, range_text):
    """town テキストに範囲が混入している場合を分離"""
    # "大字志賀島全域" → town="大字志賀島", range="全域"
    # "全域", "1丁目～3丁目" などを分離
    range_patterns = ['全域', r'\d+丁目', r'\d+番']
    for p in range_patterns:
        m = re.search(p, town)
        if m:
            return town[:m.start()].strip(), town[m.start():].strip()
    return town, range_text

def compare_with_current(records, current_json_path):
    """現在のJSONと比較して差分を報告"""
    with open(current_json_path, encoding='utf-8') as f:
        current = json.load(f)
    current_records = current.get('records', [])
    
    # インデックス作成: (ward, town, elementary, juniorHigh) → range
    def make_key(r):
        return (r.get('ward',''), r.get('town',''), r.get('elementary',''), r.get('juniorHigh',''))
    
    current_map = {make_key(r): r.get('range','') for r in current_records}
    pdf_map = {make_key(r): r.get('range','') for r in records if r.get('ward') and r.get('town')}
    
    current_keys = set(current_map.keys())
    pdf_keys = set(pdf_map.keys())
    
    added = pdf_keys - current_keys
    removed = current_keys - pdf_keys
    changed = {k for k in pdf_keys & current_keys if pdf_map[k] != current_map[k] and pdf_map[k]}
    
    return {
        'added': sorted(list(added)),
        'removed': sorted(list(removed)),
        'range_changed': sorted(list(changed)),
        'pdf_count': len(pdf_keys),
        'current_count': len(current_keys),
    }

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
    data_dir = os.path.join(script_dir, '..', 'src', 'data')
    current_json = os.path.join(data_dir, 'fukuoka-school-address-map.json')
    
    gakkou_pdf = os.path.join(tmp_dir, 'R8gakkoubetu.pdf')
    
    print("学校別PDF パース中...")
    records = parse_gakkoubetsu(gakkou_pdf)
    
    print(f"パース結果: {len(records)} 件")
    print("\n--- サンプル（最初の20件）---")
    for r in records[:20]:
        print(f"  {r['ward']} {r['town']} | {r['elementary']} / {r['juniorHigh']} | {r['range'][:50]}")
    
    # 差分比較
    print("\n--- 現在のJSONとの差分 ---")
    diff = compare_with_current(records, current_json)
    print(f"PDF件数: {diff['pdf_count']}, 現在: {diff['current_count']}")
    print(f"新規追加: {len(diff['added'])}件")
    print(f"削除(PDF未記載): {len(diff['removed'])}件")
    print(f"範囲変更: {len(diff['range_changed'])}件")
    
    if diff['range_changed']:
        print("\n変更された範囲（最初の10件）:")
        with open(current_json, encoding='utf-8') as f:
            current = json.load(f)
        current_map = {}
        for r in current['records']:
            key = (r.get('ward',''), r.get('town',''), r.get('elementary',''), r.get('juniorHigh',''))
            current_map[key] = r.get('range','')
        pdf_map = {}
        for r in records:
            key = (r.get('ward',''), r.get('town',''), r.get('elementary',''), r.get('juniorHigh',''))
            pdf_map[key] = r.get('range','')
        for key in list(diff['range_changed'])[:10]:
            print(f"  {key[0]} {key[1]} / {key[2]} / {key[3]}")
            print(f"    現在: {current_map.get(key,'')[:80]}")
            print(f"    PDF:  {pdf_map.get(key,'')[:80]}")
    
    # 結果をJSONに保存
    output = {
        'records': records,
        'pdf_count': len(records),
    }
    out_path = os.path.join(tmp_dir, 'R8gakkoubetu-parsed.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n保存: {out_path}")
