"""
福岡市 R8（2026年4月1日）通学区域 完全照合スクリプト
町名別PDF → 構造化レコード → 569件JSONとの全件照合

出力:
  - 完全一致 (confirmed_match)
  - 差異あり (difference)
  - JSONにあってPDFで未抽出 (unverified)
  - PDFにあってJSONにない (pdf_only)

無料ツールのみ使用 (PyMuPDF)
"""
import fitz
import json, re, os
from collections import defaultdict

# ─── 列 x 座標しきい値（町名別PDF）
# x < 130: 町名
# 130 <= x < 430: 区域
# 430 <= x < 490: 小学校（短縮名）
# x >= 490: 中学校（短縮名）
# x >= 510 かつ text が区名: 区名（ページヘッダー）

WARDS = ['東区', '西区', '南区', '北区', '博多区', '中央区', '城南区', '早良区']
HIRAGANA_KANA = set('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん')
KATAKANA_KANA = set('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン')

def get_page_items(page):
    """ページから (y, x, text) のリストを返す"""
    page_dict = page.get_text("dict")
    items = []
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

def is_kana_only(text):
    """ひらがな1文字 or 五十音見出し（例: 'あ', 'か', 'わ'）か"""
    clean = text.replace('行', '').strip()
    return len(clean) == 1 and (clean in HIRAGANA_KANA or clean in KATAKANA_KANA)

def is_header_text(text):
    return text in ['町名', '区域', '小学校', '中学校', '学校別通学区域一覧表',
                    '町名別通学区域一覧表', '教育委員会 教育環境部 学校計画第１課・第２課',
                    'この一覧は令和８年４月１日現在のものです。']

def col_type(x, text):
    if x >= 510 and any(w in text for w in WARDS):
        return 'ward'
    if x < 130:
        if is_kana_only(text):
            return 'kana_separator'
        if is_header_text(text):
            return 'header'
        return 'town'
    if x < 430:
        if is_header_text(text):
            return 'header'
        return 'range'
    if x < 490:
        if text == '小学校':
            return 'header'
        return 'elem'
    if text == '中学校':
        return 'header'
    return 'jh'

def parse_choumei_pdf(pdf_path):
    """
    町名別PDFを全ページ解析して DistrictRecord のリストを返す。
    
    アルゴリズム:
    1. 各ページのアイテムを収集
    2. y座標の近いアイテムを「行バンド」にグループ化
    3. 行バンドを [town, range, elem, jh] の列に分類
    4. 町名が複数の区域行を持つ場合、前後の行バンドを同じ町に割り当て
    """
    doc = fitz.open(pdf_path)
    records = []
    
    current_ward = ''
    
    for page_num in range(doc.page_count):
        if page_num == 0:  # 表紙
            continue
        
        page = doc[page_num]
        items = get_page_items(page)
        
        # ── ステップ1: アイテムを列分類 ──
        ward_items = []
        town_items = []   # (y, text)
        range_items = []  # (y, text)
        elem_items = []   # (y, text)
        jh_items = []     # (y, text)
        
        for y, x, text in items:
            ct = col_type(x, text)
            if ct == 'ward':
                ward_items.append((y, text))
            elif ct == 'town':
                town_items.append((y, text))
            elif ct == 'range':
                range_items.append((y, text))
            elif ct == 'elem':
                elem_items.append((y, text))
            elif ct == 'jh':
                jh_items.append((y, text))
        
        # 区名更新
        if ward_items:
            current_ward = next((w for _, t in ward_items for w in WARDS if w in t), current_ward)
        
        # ── ステップ2: y座標で行バンドに統合 ──
        # 各 range 行に対して、最も近い elem/jh を対応付け
        # 各 town に対して、前後の range 行を割り当て
        
        # range行とelem/jh行を y近傍でマッチ
        def find_nearest(target_y, items_list, threshold=30):
            best = None
            best_dist = threshold + 1
            for y, text in items_list:
                dist = abs(y - target_y)
                if dist < best_dist:
                    best_dist = dist
                    best = text
            return best
        
        # 各 range 行に (elem, jh) を割り当て
        matched_ranges = []  # [(y, range_text, elem, jh)]
        for y, rng_text in range_items:
            elem = find_nearest(y, elem_items)
            jh   = find_nearest(y, jh_items)
            matched_ranges.append((y, rng_text, elem or '', jh or ''))
        
        # ── ステップ3: 町名と range 行をマッチ ──
        # 各町名の y に最も近い matched_range のグループを割り当て
        # 隣の町名との中点で区切る
        
        if not matched_ranges:
            continue
        
        # 町名が出現したとき、次の町名まですべての range 行をその町に割り当て
        # ただし、最初の range 行が町名より前に出る場合（垂直センタリング）も考慮
        # → 「現在の町名の y」と「次の町名の y」の間の range 行を全部この町に割り当て
        
        def assign_ranges_to_towns(towns, ranges):
            """各町名に range 行を割り当てる（境界は隣の町の中点）"""
            if not towns:
                return []
            
            result = []
            n = len(towns)
            
            for i, (ty, town_text) in enumerate(towns):
                # この町の「担当 y 範囲」を決定
                # 前の境界: 前の町の最後の range 行と今の町の最初の range 行の中点
                # 後の境界: 今の町の最後の range 行と次の町の最初の range 行の中点
                
                if i == 0:
                    y_from = 0
                else:
                    y_from = (towns[i-1][0] + ty) / 2
                
                if i == n - 1:
                    y_to = 99999
                else:
                    y_to = (ty + towns[i+1][0]) / 2
                
                # y_from ≤ range_y ≤ y_to の range 行をこの町に割り当て
                town_ranges = [(y, r, e, j) for y, r, e, j in ranges
                               if y_from <= y <= y_to]
                
                if town_ranges:
                    result.append((town_text, town_ranges))
                else:
                    # range なし → 前後の range を探す（近傍検索）
                    nearest = find_nearest(ty, [(y, r) for y, r, _, _ in ranges], threshold=50)
                    if nearest:
                        # 近傍の range + elem/jh を取得
                        nearby = min(ranges, key=lambda x: abs(x[0] - ty))
                        result.append((town_text, [nearby]))
            
            return result
        
        assignments = assign_ranges_to_towns(town_items, matched_ranges)
        
        # ── ステップ4: レコードを生成 ──
        for town_text, town_ranges in assignments:
            # 同じ (elem, jh) の range 行をまとめる
            school_ranges = defaultdict(list)
            for y, rng, elem, jh in town_ranges:
                # 注釈行（※...）はメモとして扱う
                if rng.startswith('※') or rng.startswith('ただし'):
                    continue
                school_ranges[(elem, jh)].append(rng)
            
            for (elem_short, jh_short), range_parts in school_ranges.items():
                # 区域テキストを連結（改行区切り → 、区切りに変換）
                range_text = '、'.join(p.strip() for p in range_parts if p.strip())
                
                records.append({
                    'ward': current_ward,
                    'town': town_text,
                    'range': range_text,
                    'elementary_short': elem_short,  # 短縮名（例: "青葉"）
                    'juniorHigh_short': jh_short,    # 短縮名（例: "青葉"）
                })
    
    doc.close()
    return records

def normalize_name(name):
    """比較用: 市区町村・市立等の接頭辞、「小学校」「中学校」サフィックスを除去"""
    return re.sub(r'^.*立', '', name.strip()) \
             .replace('小学校', '小').replace('中学校', '中') \
             .replace('義務教育学校', '').strip()

def names_match(json_name, pdf_short_name):
    """
    JSON の完全名（例: "福岡市立警固小学校"）と
    PDF の短縮名（例: "警固小"）が一致するか
    """
    if not json_name or not pdf_short_name:
        return False
    norm_json = normalize_name(json_name)
    norm_pdf  = pdf_short_name.strip()
    # 短縮名 → 完全名の一部
    return norm_json == norm_pdf or norm_json.startswith(norm_pdf) or norm_pdf in norm_json

def normalize_range(r):
    """区域テキストの正規化（比較用）"""
    return re.sub(r'\s+', '', r).replace('　', '').strip() if r else ''

def ranges_match(json_range, pdf_range):
    """区域テキストの一致チェック（正規化後）"""
    a = normalize_range(json_range)
    b = normalize_range(pdf_range)
    return a == b

def ranges_mostly_match(json_range, pdf_range):
    """区域テキストの大部分一致（PDF側の改行結合アーティファクトを考慮）"""
    a = normalize_range(json_range)
    b = normalize_range(pdf_range)
    if a == b:
        return True
    # 一方が他方を90%以上含む
    if len(a) > 0 and len(b) > 0:
        shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
        return shorter in longer
    return False

def run_comparison(pdf_records, json_records):
    """
    pdf_records と json_records を照合して差分を返す
    
    Returns:
        {
            'confirmed_match': [(pdf_rec, json_rec), ...],
            'range_difference': [(pdf_rec, json_rec), ...],
            'pdf_only': [pdf_rec, ...],
            'unverified': [json_rec, ...],
        }
    """
    confirmed_match = []
    range_difference = []
    pdf_only = []
    
    # PDF レコードを検索しやすくインデックス化
    # キー: (ward, town_normalized)
    def make_key(ward, town):
        return (ward.strip(), town.strip())
    
    json_by_ward_town = defaultdict(list)
    for jr in json_records:
        key = make_key(jr.get('ward', ''), jr.get('town', ''))
        json_by_ward_town[key].append(jr)
    
    pdf_matched_json_ids = set()
    
    for pr in pdf_records:
        key = make_key(pr.get('ward', ''), pr.get('town', ''))
        candidates = json_by_ward_town.get(key, [])
        
        # 小学校・中学校・区域が一致するものを探す
        full_match = None
        school_match = None
        any_match = None
        
        for jr in candidates:
            elem_ok = names_match(jr.get('elementary', ''), pr.get('elementary_short', ''))
            jh_ok   = names_match(jr.get('juniorHigh', ''), pr.get('juniorHigh_short', ''))
            rng_ok  = ranges_match(jr.get('range', ''), pr.get('range', ''))
            rng_ok2 = ranges_mostly_match(jr.get('range', ''), pr.get('range', ''))
            
            if elem_ok and jh_ok and rng_ok:
                full_match = jr
                break
            elif elem_ok and jh_ok and rng_ok2:
                school_match = jr
            elif (elem_ok or jh_ok) and any_match is None:
                any_match = jr
        
        if full_match:
            confirmed_match.append((pr, full_match))
            pdf_matched_json_ids.add(id(full_match))
        elif school_match:
            # 学校名は一致するが区域に差異
            range_difference.append((pr, school_match))
            pdf_matched_json_ids.add(id(school_match))
        elif any_match:
            range_difference.append((pr, any_match))
            pdf_matched_json_ids.add(id(any_match))
        else:
            pdf_only.append(pr)
    
    # JSONにあってPDFで照合できなかった (unverified)
    unverified = [jr for jr in json_records if id(jr) not in pdf_matched_json_ids]
    
    return {
        'confirmed_match': confirmed_match,
        'range_difference': range_difference,
        'pdf_only': pdf_only,
        'unverified': unverified,
    }

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir  = os.path.join(script_dir, '..', 'tmp-pdf')
    data_dir = os.path.join(script_dir, '..', 'src', 'data')
    
    choumei_pdf  = os.path.join(tmp_dir,  'R8choumeibetu.pdf')
    current_json = os.path.join(data_dir, 'fukuoka-school-address-map.json')
    
    print("町名別PDFを解析中...")
    pdf_records = parse_choumei_pdf(choumei_pdf)
    print(f"PDF レコード数: {len(pdf_records)}")
    
    with open(current_json, encoding='utf-8') as f:
        data = json.load(f)
    json_records = data.get('records', [])
    print(f"JSON レコード数: {len(json_records)}")
    
    print("\n照合中...")
    result = run_comparison(pdf_records, json_records)
    
    cm  = result['confirmed_match']
    rd  = result['range_difference']
    po  = result['pdf_only']
    uv  = result['unverified']
    
    print("\n" + "="*60)
    print("  照合結果サマリー")
    print("="*60)
    print(f"✅ 完全一致 (confirmed_match)  : {len(cm)}件")
    print(f"⚠️  区域差異あり (difference)   : {len(rd)}件")
    print(f"📄 PDFのみ・JSON未収録          : {len(po)}件")
    print(f"❓ 未検証 (unverified)          : {len(uv)}件  ← PDFで対応行を抽出できず")
    print(f"   合計JSON件数: {len(json_records)}, PDF件数: {len(pdf_records)}")
    
    if rd:
        print(f"\n{'='*60}")
        print(f"  区域差異あり詳細 (先頭20件)")
        print(f"{'='*60}")
        for pr, jr in rd[:20]:
            print(f"\n  [{jr.get('ward','')} {jr.get('town','')}]")
            print(f"    小学校: JSON={jr.get('elementary','')} / PDF短縮={pr.get('elementary_short','')}")
            print(f"    中学校: JSON={jr.get('juniorHigh','')} / PDF短縮={pr.get('juniorHigh_short','')}")
            print(f"    JSON区域: {jr.get('range','')[:70]}")
            print(f"    PDF区域:  {pr.get('range','')[:70]}")
    
    if po:
        print(f"\n{'='*60}")
        print(f"  PDFのみ・JSON未収録 ({len(po)}件)")
        print(f"{'='*60}")
        for pr in po[:30]:
            print(f"  {pr.get('ward','')} {pr.get('town','')} / {pr.get('elementary_short','')} / {pr.get('juniorHigh_short','')} | {pr.get('range','')[:50]}")
    
    if uv:
        print(f"\n{'='*60}")
        print(f"  未検証 ({len(uv)}件) ← PDFで対応行を抽出できなかった可能性")
        print(f"{'='*60}")
        for jr in uv[:30]:
            print(f"  {jr.get('ward','')} {jr.get('town','')} / {jr.get('elementary','')} / {jr.get('juniorHigh','')} | {jr.get('range','')[:60]}")
    
    # 中学校別サマリー
    print(f"\n{'='*60}")
    print("  中学校別 確認状況サマリー")
    print(f"{'='*60}")
    
    jh_stats = defaultdict(lambda: {'confirmed': 0, 'difference': 0, 'unverified': 0})
    for _, jr in cm:
        jh_stats[jr.get('juniorHigh','')][ 'confirmed'] += 1
    for _, jr in rd:
        jh_stats[jr.get('juniorHigh','')]['difference'] += 1
    for jr in uv:
        jh_stats[jr.get('juniorHigh','')]['unverified'] += 1
    
    for jh in sorted(jh_stats.keys()):
        s = jh_stats[jh]
        flags = []
        if s['difference'] > 0:
            flags.append(f"⚠️ 差異{s['difference']}件")
        if s['unverified'] > 0:
            flags.append(f"❓ 未検証{s['unverified']}件")
        status = ' '.join(flags) if flags else '✅'
        total = s['confirmed'] + s['difference'] + s['unverified']
        print(f"  {jh:20s} (計{total:3d}件) {status}")
    
    # 結果をJSONに保存
    out = {
        'summary': {
            'confirmed_match': len(cm),
            'range_difference': len(rd),
            'pdf_only': len(po),
            'unverified': len(uv),
            'json_total': len(json_records),
            'pdf_total': len(pdf_records),
        },
        'range_differences': [
            {
                'ward': jr.get('ward'), 'town': jr.get('town'),
                'elementary': jr.get('elementary'), 'juniorHigh': jr.get('juniorHigh'),
                'json_range': jr.get('range'), 'pdf_range': pr.get('range'),
            }
            for pr, jr in rd[:50]
        ],
        'pdf_only': po[:50],
        'unverified': [
            {'ward': jr.get('ward'), 'town': jr.get('town'),
             'elementary': jr.get('elementary'), 'juniorHigh': jr.get('juniorHigh'),
             'range': jr.get('range')}
            for jr in uv[:50]
        ],
    }
    out_path = os.path.join(tmp_dir, 'comparison-result.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\n詳細を保存: {out_path}")
