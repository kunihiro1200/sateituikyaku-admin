"""
福岡市 R8 PDF テキスト直接検索
特定の学校・町名エントリを検索して2026年版との差異を確認する
"""
import sys, os, re
import fitz

def get_all_text_positioned(pdf_path):
    """PDFから位置情報付きテキスト全量を取得"""
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

def search_nearby(lines, keyword, context=5):
    """キーワードを含む行とその前後を返す"""
    results = []
    for i, (pg, y, x, text) in enumerate(lines):
        if keyword in text:
            start = max(0, i - context)
            end = min(len(lines), i + context + 1)
            ctx = lines[start:end]
            results.append({
                'match': (pg, y, x, text),
                'context': ctx,
            })
    return results

def print_context(result, highlight_kw=''):
    pg, y, x, text = result['match']
    print(f"\n  [p{pg} y={y} x={x}] >>> {text}")
    for pg2, y2, x2, txt2 in result['context']:
        marker = '>>>' if txt2 == text else '   '
        hl = ' *** CHANGED? ***' if highlight_kw and highlight_kw in txt2 else ''
        print(f"    {marker} p{pg2} y={y2:4d} x={x2:3d}: {txt2[:80]}{hl}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
    
    gakkou_pdf = os.path.join(tmp_dir, 'R8gakkoubetu.pdf')
    choumei_pdf = os.path.join(tmp_dir, 'R8choumeibetu.pdf')
    
    print("=== 学校別PDF テキスト検索 ===\n")
    g_lines = get_all_text_positioned(gakkou_pdf)
    c_lines = get_all_text_positioned(choumei_pdf)
    
    # 重要エントリの検索
    checks = [
        # (PDF種別, キーワード, 説明)
        ('g', '渡辺通', 'FI637エリア（渡辺通5丁目24番→警固小/警固中）'),
        ('g', '警固中', '警固中 校区確認'),
        ('g', '重留', 'FI1256エリア（重留5丁目13番→入部小/金武中）'),
        ('g', '金武中', '金武中 校区確認'),
        ('g', '小笹', 'FI89エリア（小笹1丁目8番→小笹小/平尾中）'),
        ('g', '照葉中', '新設校 照葉中（2022年開校）'),
        ('g', '元岡中', '新設校 元岡中'),
        ('c', '渡辺通', '町名別: 渡辺通'),
        ('c', '重留', '町名別: 重留'),
        ('c', '小笹', '町名別: 小笹'),
    ]
    
    for pdf_type, kw, desc in checks:
        lines = g_lines if pdf_type == 'g' else c_lines
        pdf_label = '学校別' if pdf_type == 'g' else '町名別'
        results = search_nearby(lines, kw, context=4)
        print(f"\n[{pdf_label}] {kw} ({desc}) → {len(results)}件ヒット")
        for r in results[:2]:  # 最初の2件のみ表示
            print_context(r, kw)

    # 学校の新規追加チェック
    print("\n\n=== R8版に含まれる全中学校名 ===")
    jh_names = set()
    for pg, y, x, text in g_lines:
        if 100 <= x < 200 and '中' in text and text.endswith('中'):
            jh_names.add(text)
    for name in sorted(jh_names):
        print(f"  {name}")
    
    print(f"\n合計: {len(jh_names)}校")
