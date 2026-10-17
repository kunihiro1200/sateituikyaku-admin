"""
未照合174件を正確に抽出する（50件制限なし）
full-pdf-json-comparison.py の制限を取り除いて再実行し、全未照合を特定する。
"""
import fitz
import json, re, os
from collections import defaultdict

script_dir = os.path.dirname(os.path.abspath(__file__))
tmp_dir  = os.path.join(script_dir, '..', 'tmp-pdf')
data_dir = os.path.join(script_dir, '..', 'src', 'data')

choumei_pdf  = os.path.join(tmp_dir,  'R8choumeibetu.pdf')
current_json = os.path.join(data_dir, 'fukuoka-school-address-map.json')

# ---- PDF テキスト抽出 ----
def get_page_items(page):
    page_dict = page.get_text("dict")
    items = []
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0: continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans: continue
            text = ''.join(s["text"] for s in spans).strip()
            if not text: continue
            x0 = round(line["bbox"][0])
            y0 = round(line["bbox"][1])
            items.append((y0, x0, text))
    items.sort()
    return items

WARDS = ['東区', '西区', '南区', '北区', '博多区', '中央区', '城南区', '早良区']
HIRAGANA_KANA = set('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん')

def col_type(x, text):
    if x >= 510 and any(w in text for w in WARDS): return 'ward'
    if x < 130:
        if len(text) == 1 and text in HIRAGANA_KANA: return 'kana_separator'
        if text in ['町名', '区域', '小学校', '中学校']: return 'header'
        return 'town'
    if x < 430: return 'range' if text not in ['町名', '区域', '小学校', '中学校'] else 'header'
    if x < 490: return 'elem' if text != '小学校' else 'header'
    return 'jh' if text != '中学校' else 'header'

def parse_choumei_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    records = []
    current_ward = ''
    for page_num in range(doc.page_count):
        if page_num == 0: continue
        page = doc[page_num]
        items = get_page_items(page)
        ward_items = []; town_items = []; range_items = []; elem_items = []; jh_items = []
        for y, x, text in items:
            ct = col_type(x, text)
            if ct == 'ward': ward_items.append((y, text))
            elif ct == 'town': town_items.append((y, text))
            elif ct == 'range': range_items.append((y, text))
            elif ct == 'elem': elem_items.append((y, text))
            elif ct == 'jh': jh_items.append((y, text))
        if ward_items:
            current_ward = next((w for _, t in ward_items for w in WARDS if w in t), current_ward)
        def find_nearest(ty, lst, th=30):
            best, bd = None, th+1
            for y, t in lst:
                d = abs(y-ty)
                if d < bd: bd=d; best=t
            return best
        matched_ranges = [(y, r, find_nearest(y, elem_items) or '', find_nearest(y, jh_items) or '') for y, r in range_items]
        def assign(towns, ranges):
            if not towns: return []
            result = []
            for i, (ty, tt) in enumerate(towns):
                yf = (towns[i-1][0]+ty)/2 if i > 0 else 0
                yt = (ty+towns[i+1][0])/2 if i < len(towns)-1 else 99999
                tr = [(y,r,e,j) for y,r,e,j in ranges if yf<=y<=yt]
                if tr: result.append((tt, tr))
                else:
                    nb = min(ranges, key=lambda x: abs(x[0]-ty), default=None)
                    if nb: result.append((tt, [nb]))
            return result
        for town_text, town_ranges in assign(town_items, matched_ranges):
            sg = defaultdict(list)
            for _, r, e, j in town_ranges:
                if r.startswith('※'): continue
                sg[(e,j)].append(r)
            for (e, j), parts in sg.items():
                rt = '、'.join(p.strip() for p in parts if p.strip())
                records.append({'ward': current_ward, 'town': town_text, 'range': rt, 'elem_short': e, 'jh_short': j})
    doc.close()
    return records

def normalize_name(n):
    return re.sub(r'^.*立', '', (n or '')).replace('小学校','小').replace('中学校','中').replace('義務教育学校','').strip()

def names_match(jn, ps):
    if not jn or not ps: return False
    a = normalize_name(jn); b = ps.strip()
    return a == b or a.startswith(b) or b in a

def normalize_range(r):
    return re.sub(r'\s+', '', (r or '')).replace('　','').replace('（','(').replace('）',')').strip()

# ---- 実行 ----
print("解析中...")
pdf_records = parse_choumei_pdf(choumei_pdf)
print(f"PDF: {len(pdf_records)}件")

with open(current_json, encoding='utf-8') as f:
    data = json.load(f)
json_records = data.get('records', [])
print(f"JSON: {len(json_records)}件")

# 照合
def make_key(ward, town):
    return (ward.strip(), town.strip())

json_by_wt = defaultdict(list)
for jr in json_records:
    json_by_wt[make_key(jr.get('ward',''), jr.get('town',''))].append(jr)

matched_ids = set()
for pr in pdf_records:
    key = make_key(pr.get('ward',''), pr.get('town',''))
    for jr in json_by_wt.get(key, []):
        eo = names_match(jr.get('elementary',''), pr.get('elem_short',''))
        jo = names_match(jr.get('juniorHigh',''), pr.get('jh_short',''))
        if eo or jo:
            matched_ids.add(id(jr))

unverified = [jr for jr in json_records if id(jr) not in matched_ids]
print(f"未照合: {len(unverified)}件")

# 3種別に分類
def get_source(jh):
    hc=['博多中','箱崎中','箱崎清松中','花畑中','原中','原北中','原中央中','春吉中','東住吉中','平尾中','福岡中']
    mc=['舞鶴中','松崎中','三宅中','宮竹中','席田中','姪浜中','元岡中','百道中']
    ac=['青葉中','壱岐中','壱岐丘中','板付中','内浜中','梅林中','曰佐中','小呂中']
    kc=['香椎第１中','香椎第1中','香椎第２中','香椎第2中','香椎第３中','香椎第3中','柏原中','片江中','金武中','北崎中','警固中','玄界中','玄洋中']
    sc=['早良中','三筑中','志賀中','下山門中','城香中','城西中','城南中','次郎丸中','住吉中','西陵中']
    tc=['高取中','高宮中','田隈中','多々良中','多々良中央中','千代中','照葉中','東光中','当仁中','筑紫丘中','友泉中']
    nc=['那珂中','長尾中','長丘中','西福岡中','能古中','野間中']
    yc=['横手中','吉塚中','老司中','和白中','和白丘中']
    pdf=['周船寺中']
    if jh in hc: return 'hc(live 2026-08)'
    if jh in mc: return 'mc(live 2026-08)'
    if jh in ac: return 'ac(WB 2026-01)'
    if jh in kc: return 'kc(WB 2025-04)'
    if jh in sc: return 'sc(WB 2025-04)'
    if jh in tc: return 'tc(WB 2025-04)'
    if jh in nc: return 'nc(WB 2025-04)'
    if jh in yc: return 'yc(WB 2025-04)'
    if jh in pdf: return 'R8-PDF'
    return 'unknown'

WB2025 = {'kc(WB 2025-04)','sc(WB 2025-04)','tc(WB 2025-04)','nc(WB 2025-04)','yc(WB 2025-04)'}

kind_a, kind_b, kind_c, unknown_list = [], [], [], []
for jr in unverified:
    rng = jr.get('range','') or ''
    src = get_source(jr.get('juniorHigh',''))
    has_exc = '照会' in rng or 'の一部' in rng
    if has_exc:
        kind_c.append({'r': jr, 'src': src})
    elif src in WB2025:
        kind_b.append({'r': jr, 'src': src})
    elif src != 'unknown':
        kind_a.append({'r': jr, 'src': src})
    else:
        unknown_list.append({'r': jr, 'src': src})

print()
print('=== 未照合の3種別分類（正確な件数）===')
print(f'種別A（文字表記・PDF抽出問題のみ）: {len(kind_a)}件')
print(f'種別B（WB 2025-04、変更の可能性）  : {len(kind_b)}件')
print(f'種別C（照会・の一部、例外区域）     : {len(kind_c)}件')
print(f'未分類（JH名マッピング漏れ）        : {len(unknown_list)}件')
print(f'合計                               : {len(unverified)}件')

print()
print('--- 種別B 代表例 ---')
by_jh = defaultdict(int)
for item in kind_b: by_jh[item['r'].get('juniorHigh','')] += 1
for jh, cnt in sorted(by_jh.items(), key=lambda x:-x[1])[:8]:
    print(f'  {jh}: {cnt}件')

if unknown_list:
    print()
    print('--- 未分類 ---')
    by_jh2 = defaultdict(int)
    for item in unknown_list: by_jh2[item['r'].get('juniorHigh','')] += 1
    for jh, cnt in sorted(by_jh2.items(), key=lambda x:-x[1])[:5]:
        print(f'  {jh}: {cnt}件')

# 結果保存
out = {
    'unverified_total': len(unverified),
    'kind_a': len(kind_a),
    'kind_b': len(kind_b),
    'kind_c': len(kind_c),
    'unknown': len(unknown_list),
    'kind_b_details': [{'ward':i['r'].get('ward'),'town':i['r'].get('town'),
                        'elem':i['r'].get('elementary'),'jh':i['r'].get('juniorHigh'),
                        'range':i['r'].get('range','')[:60],'src':i['src']} for i in kind_b],
    'kind_c_details': [{'ward':i['r'].get('ward'),'town':i['r'].get('town'),
                        'elem':i['r'].get('elementary'),'jh':i['r'].get('juniorHigh'),
                        'range':i['r'].get('range','')[:60]} for i in kind_c],
}
out_path = os.path.join(tmp_dir, 'unverified-174-exact.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"\n詳細を保存: {out_path}")
