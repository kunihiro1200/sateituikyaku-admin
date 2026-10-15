"""
R8 PDF vs 現在の562件JSON の体系的差分比較
- 中学校名の過不足確認
- 特定エントリの詳細比較
- 2026年版に含まれるが2025年版Wayback Machineには含まれない項目
"""
import sys, os, json, re
import fitz

def get_all_text_positioned(pdf_path):
    doc = fitz.open(pdf_path)
    lines = []
    for page_num in range(doc.page_count):
        page = doc[page_num]
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
                lines.append((page_num+1, y0, x0, text))
    doc.close()
    lines.sort()
    return lines

def get_jh_from_pdf(g_lines):
    """学校別PDFから中学校名一覧を取得（x=100-200の範囲）"""
    jh_set = set()
    for pg, y, x, text in g_lines:
        if 100 <= x < 200 and '中' in text and not text.startswith('※'):
            # 中学校名のみ (末尾が「中」または「学校」)
            if text.endswith('中') or text.endswith('学校'):
                jh_set.add(text)
    return jh_set

def get_jh_from_json(json_path):
    """現在のJSONから中学校名一覧を取得"""
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)
    return set(r.get('juniorHigh', '') for r in data.get('records', []) if r.get('juniorHigh'))

def get_context_for(g_lines, keyword, x_range=(0, 9999), before=6, after=6):
    """キーワードの前後コンテキストをテキストで返す"""
    results = []
    for i, (pg, y, x, text) in enumerate(g_lines):
        if keyword in text and x_range[0] <= x < x_range[1]:
            start = max(0, i - before)
            end = min(len(g_lines), i + after + 1)
            context = g_lines[start:end]
            results.append({
                'page': pg, 'y': y, 'x': x, 'text': text,
                'context': context
            })
    return results

def format_context(ctx):
    lines = []
    for pg, y, x, text in ctx['context']:
        marker = '>>>' if (y == ctx['y'] and text == ctx['text']) else '   '
        lines.append(f"{marker} p{pg} y={y:4d} x={x:3d}: {text[:70]}")
    return '\n'.join(lines)

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
    data_dir = os.path.join(script_dir, '..', 'src', 'data')
    current_json = os.path.join(data_dir, 'fukuoka-school-address-map.json')
    
    gakkou_pdf = os.path.join(tmp_dir, 'R8gakkoubetu.pdf')
    g_lines = get_all_text_positioned(gakkou_pdf)
    
    # ① 中学校名の比較
    print("=" * 60)
    print("① 中学校名の比較 (PDF R8 vs 現在JSON)")
    print("=" * 60)
    
    pdf_jh = get_jh_from_pdf(g_lines)
    json_jh = get_jh_from_json(current_json)
    
    only_in_pdf = sorted(pdf_jh - json_jh)
    only_in_json = sorted(json_jh - pdf_jh)
    common = sorted(pdf_jh & json_jh)
    
    print(f"PDF中学校数: {len(pdf_jh)}, JSON中学校数: {len(json_jh)}, 共通: {len(common)}")
    
    if only_in_pdf:
        print(f"\n★ PDFにあってJSONにない ({len(only_in_pdf)}件) ← 2026年新設/追加の可能性:")
        for s in only_in_pdf:
            print(f"  - {s}")
    
    if only_in_json:
        print(f"\n★ JSONにあってPDFにない ({len(only_in_json)}件) ← 廃校/統合の可能性:")
        for s in only_in_json:
            print(f"  - {s}")
    
    # ② 「周船寺中」の詳細確認（2026年版に含まれる）
    if '周船寺中' in only_in_pdf:
        print("\n" + "="*60)
        print("② 周船寺中 詳細（2026年新設校確認）")
        print("="*60)
        results = get_context_for(g_lines, '周船寺中', x_range=(100, 200))
        for r in results[:2]:
            print(format_context(r))
    
    # ③ 警固中エリアの完全なテキスト抽出（渡辺通含む）
    print("\n" + "="*60)
    print("③ 警固中（渡辺通5丁目）2026年版レンジ確認")
    print("="*60)
    
    # 警固中セクションのページを特定
    kego_results = get_context_for(g_lines, '警固中', x_range=(100, 200), before=20, after=30)
    for r in kego_results[:1]:
        # 警固中の前後30行を出力
        for pg, y, x, text in r['context']:
            marker = '>>>' if text == '警固中' else '   '
            print(f"{marker} p{pg} y={y:4d} x={x:3d}: {text[:80]}")
    
    # ④ 金武中エリア（重留）2026年版レンジ確認
    print("\n" + "="*60)
    print("④ 金武中（重留）2026年版レンジ確認")
    print("="*60)
    
    kinmu_results = get_context_for(g_lines, '金武中', x_range=(100, 200), before=20, after=20)
    for r in kinmu_results[:1]:
        for pg, y, x, text in r['context']:
            marker = '>>>' if text == '金武中' else '   '
            print(f"{marker} p{pg} y={y:4d} x={x:3d}: {text[:80]}")
    
    # ⑤ 現在の562件のJSONで、Wayback Machineデータ（か行〜や行）と
    #    R8 PDFの間で変更があるか確認
    print("\n" + "="*60)
    print("⑤ 主要検索対象エントリの2026年版確認")
    print("="*60)
    
    key_checks = [
        ('渡辺通', '5丁目20番'),
        ('重留', '1丁目'),
        ('小笹', '1丁目'),
    ]
    
    with open(current_json, encoding='utf-8') as f:
        current_data = json.load(f)
    
    choumei_pdf = os.path.join(tmp_dir, 'R8choumeibetu.pdf')
    c_lines = get_all_text_positioned(choumei_pdf)
    
    for town, expected in key_checks:
        print(f"\n  【{town}】（期待: {expected}を含む）")
        # 学校別PDFで探す
        town_results = get_context_for(g_lines, town, x_range=(200, 265), before=3, after=5)
        for r in town_results[:2]:
            print(f"    PDF: p{r['page']} y={r['y']}: {r['text']}")
            for pg, y, x, text in r['context']:
                if x >= 265:  # 区域列
                    print(f"      区域(x={x}): {text[:70]}")
        
        # 現在JSONで確認
        json_matches = [rec for rec in current_data['records'] if rec.get('town') == town]
        print(f"    現在JSON: {len(json_matches)}件")
        for rec in json_matches[:2]:
            print(f"      {rec.get('ward')} {rec.get('town')} / {rec.get('elementary')}/{rec.get('juniorHigh')}")
            print(f"      range: {rec.get('range','')[:70]}")
