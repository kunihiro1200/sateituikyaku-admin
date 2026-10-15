"""
周船寺中学校（2025年新設）の完全データを R8 PDF から抽出する
"""
import fitz
import json, os

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

def extract_school_section(g_lines, school_name, after_rows=50):
    """指定した中学校のセクション全体を抽出"""
    for i, (pg, y, x, text) in enumerate(g_lines):
        if text == school_name and 100 <= x < 200:
            # このJH名から次のJH名（x≈100-200）まで抽出
            section = []
            j = i - 20  # 少し前から
            while j < min(len(g_lines), i + after_rows):
                if j >= 0:
                    section.append(g_lines[j])
                j += 1
            return section, i
    return [], -1

script_dir = os.path.dirname(os.path.abspath(__file__))
tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
data_dir = os.path.join(script_dir, '..', 'src', 'data')

gakkou_pdf = os.path.join(tmp_dir, 'R8gakkoubetu.pdf')
g_lines = get_all_text_positioned(gakkou_pdf)

# 周船寺中セクション
print("=== 周船寺中 完全セクション ===")
section, idx = extract_school_section(g_lines, '周船寺中', after_rows=40)
for pg, y, x, text in section:
    col = '小学校' if x < 100 else '中学校' if x < 200 else '町名  ' if x < 265 else '区域  '
    print(f"  {col} p{pg} y={y:4d} x={x:3d}: {text[:80]}")

# 周船寺中の元データ（元岡中と比較）
print("\n=== 元岡中 確認（周船寺中と分離された部分）===")
section2, idx2 = extract_school_section(g_lines, '元岡中', after_rows=60)
for pg, y, x, text in section2:
    col = '小学校' if x < 100 else '中学校' if x < 200 else '町名  ' if x < 265 else '区域  '
    print(f"  {col} p{pg} y={y:4d} x={x:3d}: {text[:80]}")

# 周船寺地区が現在のJSONに含まれているか確認
print("\n=== 現在JSONに「周船寺」「徳永」「北原」が含まれるか ===")
with open(os.path.join(data_dir, 'fukuoka-school-address-map.json'), encoding='utf-8') as f:
    data = json.load(f)

for town in ['周船寺', '徳永', '北原', '徳永北']:
    matches = [r for r in data['records'] if r.get('town','').startswith(town) or r.get('town','') == town]
    print(f"  {town}: {len(matches)}件 - {[r.get('juniorHigh','') for r in matches]}")

# GeoJSONに周船寺中があるか
print("\n=== 福岡市中学校GeoJSONに周船寺中があるか ===")
geojson_path = os.path.join(data_dir, 'fukuoka-middle-school-districts.json')
with open(geojson_path, encoding='utf-8') as f:
    geojson = json.load(f)
shussen = [f for f in geojson['features'] if '周船寺' in (f['properties'].get('name',''))]
print(f"  周船寺中: {len(shussen)}件")
if shussen:
    print(f"  名称: {[f['properties'].get('name') for f in shussen]}")
